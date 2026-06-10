const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const authConductor = require('../middleware/authConductor');

async function obtenerRuta(origenLat, origenLng, destinoLat, destinoLng) {
  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json` +
      `?origin=${origenLat},${origenLng}` +
      `&destination=${destinoLat},${destinoLng}` +
      `&key=${process.env.GOOGLE_MAPS_API_KEY}&language=es`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== 'OK' || !data.routes.length) {
      console.error('Directions API error:', data.status, JSON.stringify(data.error_message));
      return null;
    }
    const ruta = data.routes[0].legs[0];
    return {
      polyline: data.routes[0].overview_polyline.points,
      distancia_km: parseFloat((ruta.distance.value / 1000).toFixed(2)),
      duracion_minutos: Math.ceil(ruta.duration.value / 60),
      origen_texto: ruta.start_address,
      destino_texto: ruta.end_address,
    };
  } catch (err) {
    console.error('Error obteniendo ruta:', err.message);
    return null;
  }
}

const { notificarUsuario, notificarConductor } = require('../pushNotifications');

const ESTADOS_VALIDOS = ['solicitado', 'buscando', 'asignado', 'aceptado', 'en_curso', 'completado', 'cancelado', 'sin_conductor'];

// ─────────────────────────────────────────────
// POST /api/viajes/nuevo
// ─────────────────────────────────────────────
router.post('/nuevo', async (req, res) => {
  const { usuario_id, origen, destino, origen_lat, origen_lng, destino_lat, destino_lng, precio, precio_usuario } = req.body;

  if (!usuario_id || !origen || !destino) {
    return res.status(400).json({ ok: false, error: 'usuario_id, origen y destino son obligatorios' });
  }
  if (precio !== undefined && (isNaN(precio) || precio < 0)) {
    return res.status(400).json({ ok: false, error: 'El precio debe ser un número positivo' });
  }

  try {
    const rutaData = await obtenerRuta(origen_lat, origen_lng, destino_lat, destino_lng);

    // Determinar si el viaje es negociable según distancia real de Google
    const distanciaReal = rutaData?.distancia_km || 0;
    const esInterurbano = distanciaReal > 6;

    const { data, error } = await supabase
      .from('viajes')
      .insert([{
        usuario_id, origen, destino,
        origen_lat: origen_lat || null,
        origen_lng: origen_lng || null,
        destino_lat: destino_lat || null,
        destino_lng: destino_lng || null,
        precio: precio || null,
        // precio_usuario: lo que el usuario está dispuesto a pagar (puede ser diferente al calculado)
        precio_usuario: precio_usuario || precio || null,
        estado: 'buscando',
        // estado_negociacion: solo aplica a interurbanos
        estado_negociacion: esInterurbano ? 'propuesto' : null,
        polyline: rutaData?.polyline || null,
        distancia_km: rutaData?.distancia_km || null,
        duracion_minutos: rutaData?.duracion_minutos || null,
        origen_texto: rutaData?.origen_texto || null,
        destino_texto: rutaData?.destino_texto || null,
      }])
      .select();

    if (error) throw error;

    const viaje = data[0];
    console.log(`✅ Viaje ${viaje.id} creado — ${esInterurbano ? 'interurbano (negociable)' : 'urbano (precio fijo)'}`);

    // Auto-cancelar si pasan 10 minutos sin conductor
    setTimeout(async () => {
      try {
        const { data: viajeActual } = await supabase
          .from('viajes').select('estado').eq('id', viaje.id).single();
        if (viajeActual?.estado === 'buscando') {
          await supabase.from('viajes').update({ estado: 'cancelado' }).eq('id', viaje.id);
          console.log(`⏱ Viaje ${viaje.id} cancelado por timeout`);
        }
      } catch (e) { console.error('Error auto-cancelando:', e.message); }
    }, 10 * 60 * 1000);

    res.json({ ok: true, viaje, negociable: esInterurbano });

  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// POST /api/viajes/contraoferta/:id
// Conductor propone un precio diferente al del usuario
// Solo aplica a viajes interurbanos (negociable: true)
// ─────────────────────────────────────────────
router.post('/contraoferta/:id', async (req, res) => {
  const { conductor_id, precio_conductor } = req.body;

  if (!conductor_id || !precio_conductor) {
    return res.status(400).json({ ok: false, error: 'conductor_id y precio_conductor son obligatorios' });
  }
  if (isNaN(precio_conductor) || precio_conductor <= 0) {
    return res.status(400).json({ ok: false, error: 'El precio debe ser mayor a 0' });
  }

  try {
    const { data: viaje, error: viajeError } = await supabase
      .from('viajes').select('*').eq('id', req.params.id).single();

    if (viajeError || !viaje) {
      return res.status(404).json({ ok: false, error: 'Viaje no encontrado' });
    }
    if (viaje.estado !== 'buscando') {
      return res.status(400).json({ ok: false, error: 'Este viaje ya no está disponible para negociar' });
    }
    if (viaje.estado_negociacion === null) {
      return res.status(400).json({ ok: false, error: 'Este viaje tiene precio fijo — no admite contraoferta' });
    }

    const { data, error } = await supabase
      .from('viajes')
      .update({
        conductor_id,
        precio_conductor: parseFloat(precio_conductor),
        estado_negociacion: 'contraoferta',
        estado: 'buscando', // sigue buscando hasta que usuario acepte
      })
      .eq('id', req.params.id)
      .eq('estado', 'buscando')
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(409).json({ ok: false, error: 'El viaje ya fue tomado por otro conductor' });

    // Notificar al usuario que hay una contraoferta
    if (viaje.usuario_id) {
      notificarUsuario(
        viaje.usuario_id,
        '💬 Conductor propone un precio',
        `Un conductor ofrece llevarte por ${Number(precio_conductor).toLocaleString('es-CO')} COP`
      );
    }

    console.log(`💬 Contraoferta en viaje ${req.params.id}: conductor propone ${precio_conductor} COP`);
    res.json({ ok: true, viaje: data });

  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// POST /api/viajes/responder-contraoferta/:id
// Usuario acepta o rechaza la contraoferta del conductor
// ─────────────────────────────────────────────
router.post('/responder-contraoferta/:id', async (req, res) => {
  const { acepta, usuario_id } = req.body;

  if (acepta === undefined || !usuario_id) {
    return res.status(400).json({ ok: false, error: 'acepta (boolean) y usuario_id son obligatorios' });
  }

  try {
    const { data: viaje, error: viajeError } = await supabase
      .from('viajes').select('*').eq('id', req.params.id).single();

    if (viajeError || !viaje) {
      return res.status(404).json({ ok: false, error: 'Viaje no encontrado' });
    }
    if (viaje.usuario_id !== usuario_id) {
      return res.status(403).json({ ok: false, error: 'No autorizado' });
    }
    if (viaje.estado_negociacion !== 'contraoferta') {
      return res.status(400).json({ ok: false, error: 'No hay contraoferta pendiente en este viaje' });
    }

    if (acepta) {
      // Usuario acepta — confirmar el viaje con el precio del conductor
      const { data, error } = await supabase
        .from('viajes')
        .update({
          estado: 'aceptado',
          estado_negociacion: 'aceptado',
          precio: viaje.precio_conductor, // precio final = lo que ofreció el conductor
        })
        .eq('id', req.params.id)
        .select()
        .single();

      if (error) throw error;

      // Notificar al conductor
      if (viaje.conductor_id) {
        notificarConductor(viaje.conductor_id, '✅ Usuario aceptó tu precio', 'El viaje está confirmado. Ve a recogerlo.');
      }

      console.log(`✅ Contraoferta aceptada — viaje ${req.params.id} confirmado a ${viaje.precio_conductor} COP`);
      res.json({ ok: true, viaje: data, precio_final: viaje.precio_conductor });

    } else {
      // Usuario rechaza — limpiar conductor y volver a buscar
      const { data, error } = await supabase
        .from('viajes')
        .update({
          conductor_id: null,
          precio_conductor: null,
          estado_negociacion: 'propuesto',
          estado: 'buscando',
        })
        .eq('id', req.params.id)
        .select()
        .single();

      if (error) throw error;

      // Notificar al conductor
      if (viaje.conductor_id) {
        notificarConductor(viaje.conductor_id, '❌ Usuario rechazó tu precio', 'El pasajero no aceptó la contraoferta.');
      }

      console.log(`❌ Contraoferta rechazada — viaje ${req.params.id} vuelve a buscar`);
      res.json({ ok: true, viaje: data, mensaje: 'Contraoferta rechazada — buscando otro conductor' });
    }

  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET /api/viajes/usuario/:usuario_id
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
// GET /api/viajes/conductor/:conductor_id
// ─────────────────────────────────────────────
router.get('/conductor/:conductor_id', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  try {
    const { data, error, count } = await supabase
      .from('viajes')
      .select('*, usuarios(nombre, telefono, foto_url)', { count: 'exact' })
      .eq('conductor_id', req.params.conductor_id)
      .eq('estado', req.query.estado || 'aceptado')
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
// PATCH /api/viajes/estado/:id
// ─────────────────────────────────────────────
router.patch('/estado/:id', async (req, res) => {
  const { estado, conductor_id } = req.body;

  if (!estado) return res.status(400).json({ ok: false, error: 'El estado es obligatorio' });
  if (!ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({ ok: false, error: `Estado inválido. Válidos: ${ESTADOS_VALIDOS.join(', ')}` });
  }

  try {
    let updateQuery = supabase
      .from('viajes')
      .update({ estado, ...(conductor_id && { conductor_id }) })
      .eq('id', req.params.id);

    if (estado === 'aceptado') {
      updateQuery = updateQuery.eq('estado', 'buscando');
    }

    const { data, error } = await updateQuery.select();
    if (error) throw error;

    if ((!data || data.length === 0) && estado === 'aceptado') {
      return res.status(409).json({ ok: false, error: 'Este viaje ya fue tomado por otro conductor.' });
    }
    if (!data || data.length === 0) {
      return res.status(404).json({ ok: false, error: 'Viaje no encontrado' });
    }

    const viaje = data[0];

    if (estado === 'aceptado' && viaje.usuario_id) {
      notificarUsuario(viaje.usuario_id, '🏍️ Conductor en camino', 'Tu conductor va hacia ti');
    }
    if (estado === 'completado') {
      if (viaje.usuario_id) notificarUsuario(viaje.usuario_id, '✅ Viaje completado', '¡Gracias por viajar con ZAS!');
      if (viaje.conductor_id) {
        await supabase.from('conductores').update({ estado: 'disponible' }).eq('id', viaje.conductor_id);
        console.log('🟢 Conductor liberado');
      }
    }
    if (estado === 'cancelado') {
      if (conductor_id && viaje.usuario_id) notificarUsuario(viaje.usuario_id, '❌ Viaje cancelado', 'El conductor canceló el viaje.');
      if (!conductor_id && viaje.conductor_id) notificarConductor(viaje.conductor_id, '❌ Viaje cancelado', 'El usuario canceló el viaje.');
      if (viaje.conductor_id) {
        await supabase.from('conductores').update({ estado: 'disponible' }).eq('id', viaje.conductor_id);
      }
    }

    res.json({ ok: true, viaje });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET /api/viajes/estado/:estado
// ─────────────────────────────────────────────
router.get('/estado/:estado', async (req, res) => {
  const { estado } = req.params;
  if (!ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({ ok: false, error: `Estado inválido` });
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
// GET /api/viajes/:id
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
// GET /api/viajes/
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
// GET /api/viajes/cercanos/:lat/:lng
// ─────────────────────────────────────────────
router.get('/cercanos/:lat/:lng', async (req, res) => {
  const lat = parseFloat(req.params.lat);
  const lng = parseFloat(req.params.lng);
  const radioKm = 3;

  if (!lat || !lng) return res.status(400).json({ ok: false, error: 'Latitud y longitud son obligatorios' });

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
// ═══════════════════════════════════════════
// AGREGAR AL FINAL DE routes/viajes.js
// ANTES del module.exports = router;
// ═══════════════════════════════════════════

// ─────────────────────────────────────────────
// POST /api/viajes/oferta/:id
// Conductor hace una oferta de precio en un viaje interurbano
// Reemplaza la contraoferta anterior — ahora guarda en tabla separada
// ─────────────────────────────────────────────
router.post('/oferta/:id', async (req, res) => {
  const { conductor_id, precio_oferta } = req.body;

  if (!conductor_id || !precio_oferta) {
    return res.status(400).json({ ok: false, error: 'conductor_id y precio_oferta son obligatorios' });
  }
  if (isNaN(precio_oferta) || precio_oferta <= 0) {
    return res.status(400).json({ ok: false, error: 'El precio debe ser mayor a 0' });
  }

  try {
    // Verificar que el viaje existe y está buscando
    const { data: viaje, error: viajeError } = await supabase
      .from('viajes').select('*').eq('id', req.params.id).single();

    if (viajeError || !viaje) {
      return res.status(404).json({ ok: false, error: 'Viaje no encontrado' });
    }
    if (viaje.estado !== 'buscando') {
      return res.status(400).json({ ok: false, error: 'Este viaje ya no está disponible' });
    }
    if (!viaje.estado_negociacion) {
      return res.status(400).json({ ok: false, error: 'Este viaje tiene precio fijo — no admite ofertas' });
    }

    // Obtener datos del conductor para mostrar en la lista
    const { data: conductor } = await supabase
      .from('conductores')
      .select('id, nombre, foto_url, calificacion, modelo_moto, placa_moto')
      .eq('id', conductor_id)
      .single();

    // Upsert — si ya hizo oferta la actualiza, si no la crea
    const { data, error } = await supabase
      .from('ofertas_viaje')
      .upsert({
        viaje_id: req.params.id,
        conductor_id,
        precio_oferta: parseFloat(precio_oferta),
        estado: 'pendiente',
      }, { onConflict: 'viaje_id,conductor_id' })
      .select()
      .single();

    if (error) throw error;

    // Notificar al usuario que hay nuevas ofertas
    if (viaje.usuario_id) {
      notificarUsuario(
        viaje.usuario_id,
        'Nueva oferta de conductor',
        `Un conductor ofrece llevarte por ${Number(precio_oferta).toLocaleString('es-CO')} COP`
      );
    }

    console.log(`💬 Oferta en viaje ${req.params.id}: conductor ${conductor?.nombre} propone ${precio_oferta} COP`);
    res.json({ ok: true, oferta: data, conductor });

  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET /api/viajes/:id/ofertas
// Usuario ve todas las ofertas activas de conductores para su viaje
// ─────────────────────────────────────────────
router.get('/:id/ofertas', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ofertas_viaje')
      .select(`
        *,
        conductores (
          id, nombre, foto_url, calificacion,
          modelo_moto, placa_moto
        )
      `)
      .eq('viaje_id', req.params.id)
      .eq('estado', 'pendiente')
      .order('precio_oferta', { ascending: true });

    if (error) throw error;

    const ofertas = data.map(o => ({
      id: o.id,
      viaje_id: o.viaje_id,
      precio_oferta: o.precio_oferta,
      estado: o.estado,
      created_at: o.created_at,
      conductor_id: o.conductores?.id,
      conductor_nombre: o.conductores?.nombre || '',
      conductor_foto: o.conductores?.foto_url || '',
      conductor_calificacion: o.conductores?.calificacion || 5,
      conductor_modelo: o.conductores?.modelo_moto || '',
      conductor_placa: o.conductores?.placa_moto || '',
    }));

    res.json({ ok: true, ofertas, total: ofertas.length });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// POST /api/viajes/:id/elegir-conductor
// Usuario elige una oferta específica de conductor
// ─────────────────────────────────────────────
router.post('/:id/elegir-conductor', async (req, res) => {
  const { oferta_id, usuario_id } = req.body;

  if (!oferta_id || !usuario_id) {
    return res.status(400).json({ ok: false, error: 'oferta_id y usuario_id son obligatorios' });
  }

  try {
    // Verificar que la oferta existe y está pendiente
    const { data: oferta, error: ofertaError } = await supabase
      .from('ofertas_viaje')
      .select('*, conductores(nombre, telefono, foto_url, placa_moto, modelo_moto)')
      .eq('id', oferta_id)
      .eq('viaje_id', req.params.id)
      .eq('estado', 'pendiente')
      .single();

    if (ofertaError || !oferta) {
      return res.status(404).json({ ok: false, error: 'Oferta no encontrada o ya no está disponible' });
    }

    // Verificar que el viaje pertenece al usuario
    const { data: viaje } = await supabase
      .from('viajes').select('usuario_id').eq('id', req.params.id).single();

    if (viaje?.usuario_id !== usuario_id) {
      return res.status(403).json({ ok: false, error: 'No autorizado' });
    }

    // Aceptar esta oferta — marcar viaje como aceptado con este conductor
    const { data: viajeActualizado, error: viajeError } = await supabase
      .from('viajes')
      .update({
        estado: 'aceptado',
        conductor_id: oferta.conductor_id,
        precio: oferta.precio_oferta,
        precio_conductor: oferta.precio_oferta,
        estado_negociacion: 'aceptado',
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (viajeError) throw viajeError;

    // Marcar esta oferta como aceptada
    await supabase
      .from('ofertas_viaje')
      .update({ estado: 'aceptada' })
      .eq('id', oferta_id);

    // Rechazar todas las demás ofertas del mismo viaje
    await supabase
      .from('ofertas_viaje')
      .update({ estado: 'rechazada' })
      .eq('viaje_id', req.params.id)
      .neq('id', oferta_id);

    // Notificar al conductor elegido
    notificarConductor(
      oferta.conductor_id,
      '✅ Usuario eligio tu oferta',
      'El pasajero acepto tu precio. Ve a recogerlo.'
    );

    console.log(`✅ Usuario eligio conductor ${oferta.conductor_id} para viaje ${req.params.id} — precio: ${oferta.precio_oferta} COP`);

    res.json({
      ok: true,
      viaje: viajeActualizado,
      conductor: {
        id: oferta.conductores?.id,
        nombre: oferta.conductores?.nombre,
        telefono: oferta.conductores?.telefono,
        foto_url: oferta.conductores?.foto_url,
        placa_moto: oferta.conductores?.placa_moto,
        modelo_moto: oferta.conductores?.modelo_moto,
      }
    });

  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET /api/viajes/:id/eta
// Calcula ETA desde ubicación del conductor al destino actual
// Se llama desde la app cada polling para actualizar cuenta regresiva
// ─────────────────────────────────────────────
router.get('/:id/eta', async (req, res) => {
  const { origen_lat, origen_lng, destino_lat, destino_lng } = req.query;

  if (!origen_lat || !origen_lng || !destino_lat || !destino_lng) {
    return res.status(400).json({ ok: false, error: 'origen_lat, origen_lng, destino_lat, destino_lng son obligatorios' });
  }

  try {
    const rutaData = await obtenerRuta(origen_lat, origen_lng, destino_lat, destino_lng);

    if (rutaData) {
      const duracion_segundos = rutaData.duracion_minutos * 60;
      const min = rutaData.duracion_minutos;
      return res.json({
        ok: true,
        duracion_segundos,
        duracion_texto: `${min} min`,
        distancia_texto: `${rutaData.distancia_km} km`,
      });
    }

    return res.json({ ok: false, error: 'No se pudo calcular ETA' });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get('/:id/ruta', async (req, res) => {
  const { origen_lat, origen_lng, destino_lat, destino_lng } = req.query;
  if (!origen_lat || !origen_lng || !destino_lat || !destino_lng) {
    return res.status(400).json({ ok: false, error: 'Faltan coordenadas' });
  }
  try {
    const rutaData = await obtenerRuta(origen_lat, origen_lng, destino_lat, destino_lng);
    if (rutaData) {
      return res.json({ ok: true, polyline: rutaData.polyline, distancia_km: rutaData.distancia_km, duracion_minutos: rutaData.duracion_minutos });
    }
    res.json({ ok: false, error: 'No se pudo calcular la ruta' });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = router;