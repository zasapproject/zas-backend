const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { notificarUsuario, notificarConductor, notificarConductoresCercanos } = require('../pushNotifications');
const { asignarConductor } = require('../services/asignacionService');
// Estados válidos de un viaje
const ESTADOS_VALIDOS = ['solicitado', 'aceptado', 'en_curso', 'completado', 'cancelado'];

// ─────────────────────────────────────────────
// Crear nuevo viaje
// ─────────────────────────────────────────────
router.post('/nuevo', async (req, res) => {
  const { usuario_id, origen, destino, origen_lat, origen_lng, destino_lat, destino_lng, precio } = req.body;

  if (!usuario_id || !origen || !destino) {
    return res.status(400).json({ ok: false, error: 'usuario_id, origen y destino son obligatorios' });
  }
  if (precio !== undefined && (isNaN(precio) || precio < 0)) {
    return res.status(400).json({ ok: false, error: 'El precio debe ser un número positivo' });
  }

  try {
    const { data, error } = await supabase
      .from('viajes')
      .insert([{
        usuario_id, origen, destino,
        origen_lat: origen_lat || null,
        origen_lng: origen_lng || null,
        destino_lat: destino_lat || null,
        destino_lng: destino_lng || null,
        precio: precio || null,
        estado: 'solicitado',
      }])
      .select();

 if (error) throw error;

    const viaje = data[0];
    await asignarConductor(viaje);

    res.json({ ok: true, viaje });

  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// Viajes de un usuario (con paginación)
// ─────────────────────────────────────────────
router.get('/usuario/:usuario_id', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  try {
    const { data, error, count } = await supabase
      .from('viajes')
      .select('*, conductores(nombre, telefono, foto_url, placa_moto, modelo_moto)', { count: 'exact' })
      .eq('usuario_id', req.params.usuario_id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    const viajes = data.map(v => ({
      ...v,
      conductor_nombre: v.conductores?.nombre || '',
      conductor_telefono: v.conductores?.telefono || '',
      conductor_foto: v.conductores?.foto_url || '',
      conductor_placa: v.conductores?.placa_moto || '',
      conductor_modelo: v.conductores?.modelo_moto || '',
      conductores: undefined,
    }));

    res.json({ ok: true, viajes, total: count, page, limit });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// Viajes de un conductor (con paginación)
// ─────────────────────────────────────────────
router.get('/conductor/:conductor_id', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  try {
    const { data, error, count } = await supabase
      .from('viajes')
      .select('*', { count: 'exact' })
      .eq('conductor_id', req.params.conductor_id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    res.json({ ok: true, viajes: data, total: count, page, limit });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// Actualizar estado del viaje
// ─────────────────────────────────────────────
router.patch('/estado/:id', async (req, res) => {
  const { estado, conductor_id } = req.body;

  if (!estado) {
    return res.status(400).json({ ok: false, error: 'El estado es obligatorio' });
  }
  if (!ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({ ok: false, error: `Estado inválido. Válidos: ${ESTADOS_VALIDOS.join(', ')}` });
  }

  try {
    const { data, error } = await supabase
      .from('viajes')
      .update({ estado, ...(conductor_id && { conductor_id }) })
      .eq('id', req.params.id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ ok: false, error: 'Viaje no encontrado' });
    }
    const viaje = data[0];
    if (estado === 'aceptado' && viaje.usuario_id) {
      notificarUsuario(viaje.usuario_id, '🏍️ Conductor en camino', 'Tu conductor va hacia ti');
    }
    if (estado === 'cancelado') {
      if (conductor_id && viaje.usuario_id) notificarUsuario(viaje.usuario_id, '❌ Viaje cancelado', 'El conductor canceló el viaje. Solicita otro.');
      if (!conductor_id && viaje.conductor_id) notificarConductor(viaje.conductor_id, '❌ Viaje cancelado', 'El usuario canceló el viaje.');
    }
    if (estado === 'completado' && viaje.usuario_id) {
      notificarUsuario(viaje.usuario_id, '✅ Viaje completado', '¡Gracias por viajar con ZAS!');
    }
    res.json({ ok: true, viaje });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// Viajes por estado (con paginación)
// ─────────────────────────────────────────────
router.get('/estado/:estado', async (req, res) => {
  const { estado } = req.params;

  if (!ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({ ok: false, error: `Estado inválido. Válidos: ${ESTADOS_VALIDOS.join(', ')}` });
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  try {
    const { data, error, count } = await supabase
      .from('viajes')
      .select('*, usuarios(nombre, telefono, foto_url)', { count: 'exact' })
      .eq('estado', estado)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    const viajes = data.map(v => ({
      ...v,
      usuario_nombre: v.usuarios?.nombre || '',
      usuario_telefono: v.usuarios?.telefono || '',
      usuario_foto: v.usuarios?.foto_url || '',
      usuarios: undefined,
    }));

    res.json({ ok: true, viajes, total: count, page, limit });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// Obtener viaje por ID
// ─────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('viajes')
      .select('*, usuarios(nombre, telefono, foto_url), conductores(nombre, telefono, foto_url, placa_moto, modelo_moto)')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    res.json({ ok: true, viaje: data });
  } catch (error) {
    res.status(404).json({ ok: false, error: 'Viaje no encontrado' });
  }
});

// ─────────────────────────────────────────────
// Todos los viajes — dashboard (con paginación)
// ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  try {
    const { data, error, count } = await supabase
      .from('viajes')
      .select('*, usuarios(nombre, telefono), conductores(nombre, telefono)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    const viajes = data.map(v => ({
      ...v,
      usuario_nombre: v.usuarios?.nombre || '',
      usuario_telefono: v.usuarios?.telefono || '',
      conductor_nombre: v.conductores?.nombre || '',
      conductor_telefono: v.conductores?.telefono || '',
      usuarios: undefined,
      conductores: undefined,
    }));

    res.json({ ok: true, viajes, total: count, page, limit });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});
// ─────────────────────────────────────────────
// Viajes solicitados cerca del conductor (5km)
// ─────────────────────────────────────────────
router.get('/cercanos/:lat/:lng', async (req, res) => {
  const lat = parseFloat(req.params.lat);
  const lng = parseFloat(req.params.lng);
  const radioKm = 5;

  if (!lat || !lng) {
    return res.status(400).json({ ok: false, error: 'Latitud y longitud son obligatorios' });
  }

  try {
    const { data, error } = await supabase
      .from('viajes')
      .select('*, usuarios(nombre, telefono, foto_url)')
      .eq('estado', 'buscando')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const viajesCercanos = data.filter(v => {
      if (!v.origen_lat || !v.origen_lng) return true;
      const dLat = (v.origen_lat - lat) * Math.PI / 180;
      const dLng = (v.origen_lng - lng) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat * Math.PI / 180) * Math.cos(v.origen_lat * Math.PI / 180) *
        Math.sin(dLng/2) * Math.sin(dLng/2);
      const distancia = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return distancia <= radioKm;
    }).map(v => ({
      ...v,
      usuario_nombre: v.usuarios?.nombre || '',
      usuario_telefono: v.usuarios?.telefono || '',
      usuario_foto: v.usuarios?.foto_url || '',
      usuarios: undefined,
    }));

    res.json({ ok: true, viajes: viajesCercanos, total: viajesCercanos.length });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});
module.exports = router;