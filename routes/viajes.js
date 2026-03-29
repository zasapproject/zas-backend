const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

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
    res.json({ ok: true, viaje: data[0] });
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
    res.json({ ok: true, viaje: data[0] });
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

module.exports = router;