const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const authAdmin = require('../middleware/authAdmin');
const { registrarHistorial } = require('../utils/historialPagos');


// GET /suscripciones/estado/:conductorId
router.get('/estado/:conductorId', async (req, res) => {
  const { conductorId } = req.params;
  
  const { data, error } = await supabase
    .from('conductores')
    .select('id, nombre, suscripcion_hasta')
    .eq('id', conductorId)
    .single();

  if (error) return res.status(404).json({ error: 'Conductor no encontrado' });

  const ahora = new Date();
  const hasta = data.suscripcion_hasta ? new Date(data.suscripcion_hasta) : null;
  const activo = hasta && hasta > ahora;

  res.json({
    conductor_id: data.id,
    nombre: data.nombre,
    suscripcion_hasta: data.suscripcion_hasta,
    activo,
    dias_restantes: activo 
      ? Math.ceil((hasta - ahora) / (1000 * 60 * 60 * 24)) 
      : 0
  });
});

// POST /suscripciones/activar
router.post('/activar', authAdmin, async (req, res) => {
  const { conductor_id, metodo_pago, monto, admin_nombre } = req.body;

  if (!conductor_id) {
    return res.status(400).json({ error: 'conductor_id requerido' });
  }

  const { data: conductor } = await supabase
    .from('conductores')
    .select('suscripcion_hasta, nombre, telefono')
    .eq('id', conductor_id)
    .single();

  const ahora = new Date();
  const base = conductor?.suscripcion_hasta && new Date(conductor.suscripcion_hasta) > ahora
    ? new Date(conductor.suscripcion_hasta)
    : ahora;

  const nueva_fecha = new Date(base);
  nueva_fecha.setDate(nueva_fecha.getDate() + 7);

  const { data, error } = await supabase
    .from('conductores')
    .update({ suscripcion_hasta: nueva_fecha.toISOString() })
    .eq('id', conductor_id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  let pagoSuscripcionId = null;
  let comprobanteUrl = null;

  if (metodo_pago !== 'efectivo') {
    const { data: pagosActualizados } = await supabase
      .from('pagos_suscripcion')
      .update({ estado: 'activa', suscripcion_hasta: nueva_fecha.toISOString() })
      .eq('conductor_id', conductor_id)
      .eq('estado', 'en_revision')
      .select();
    if (pagosActualizados && pagosActualizados[0]) {
      pagoSuscripcionId = pagosActualizados[0].id;
      comprobanteUrl = pagosActualizados[0].comprobante_url;
    }
  } else {
    const { data: nuevoPago } = await supabase.from('pagos_suscripcion').insert({
      conductor_id,
      monto: monto || 15000,
      moneda: 'COP',
      metodo_pago: metodo_pago || 'efectivo',
      suscripcion_hasta: nueva_fecha.toISOString()
    }).select().single();
    pagoSuscripcionId = nuevoPago?.id;
  }

  await registrarHistorial({
    tipo_pago: 'suscripcion',
    referencia_id: pagoSuscripcionId,
    conductor_id,
    nombre_persona: conductor?.nombre,
    telefono_persona: conductor?.telefono,
    monto: monto || 15000,
    metodo: metodo_pago || 'efectivo',
    accion: 'confirmado',
    estado_resultante: 'activa',
    comprobante_url: comprobanteUrl,
    admin_nombre: admin_nombre || 'sistema',
  });

  res.json({
    success: true,
    mensaje: `Suscripción activa hasta ${nueva_fecha.toLocaleDateString('es-CO')}`,
    suscripcion_hasta: nueva_fecha.toISOString(),
    dias_activos: 7
  });
});

// GET /suscripciones/vencimientos
router.get('/vencimientos', async (req, res) => {
  const en3dias = new Date();
  en3dias.setDate(en3dias.getDate() + 3);

  const { data, error } = await supabase
    .from('conductores')
    .select('id, nombre, telefono, suscripcion_hasta')
    .lte('suscripcion_hasta', en3dias.toISOString())
    .gte('suscripcion_hasta', new Date().toISOString())
    .order('suscripcion_hasta', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  res.json({ conductores: data, total: data.length });
});

// POST /suscripciones/registrar-solicitud — guarda pago pendiente y devuelve el ID
router.post('/registrar-solicitud', async (req, res) => {
  const { conductor_id, metodo_pago, monto } = req.body;
  if (!conductor_id) return res.status(400).json({ error: 'conductor_id requerido' });

  const { data, error } = await supabase
    .from('pagos_suscripcion')
    .insert({
      conductor_id,
      monto: monto || 15000,
      moneda: 'COP',
      metodo_pago: metodo_pago || 'efectivo',
      estado: 'pendiente',
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, pago_id: data.id });
});

// POST /suscripciones/subir-comprobante/:pagoId
router.post('/subir-comprobante/:pagoId', async (req, res) => {
  const { pagoId } = req.params;
  const { comprobante_url, referencia } = req.body;

  const { data, error } = await supabase
    .from('pagos_suscripcion')
    .update({ comprobante_url, referencia: referencia || null, estado: 'en_revision' })
    .eq('id', pagoId)
    .select('*, conductores(nombre, telefono)')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await registrarHistorial({
    tipo_pago: 'suscripcion',
    referencia_id: pagoId,
    conductor_id: data.conductor_id,
    nombre_persona: data.conductores?.nombre,
    telefono_persona: data.conductores?.telefono,
    monto: data.monto,
    metodo: data.metodo_pago,
    accion: 'comprobante_subido',
    estado_resultante: 'en_revision',
    comprobante_url,
    admin_nombre: 'sistema',
  });

  res.json({ ok: true });
});

// Historial de pagos
router.get('/historial', async (req, res) => {
  const { data, error } = await supabase
    .from('pagos_suscripcion')
    .select('*, conductores(nombre, telefono)')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  const pagos = data.map(p => ({
    ...p,
    conductor_nombre: p.conductores?.nombre || '',
    conductor_telefono: p.conductores?.telefono || '',
  }));
  res.json({ ok: true, pagos, total: pagos.length });
});
// PATCH /suscripciones/rechazar/:pagoId
router.patch('/rechazar/:pagoId', authAdmin, async (req, res) => {
  const { motivo, admin_nombre } = req.body;
  try {
    const { data: pago, error: pagoError } = await supabase
      .from('pagos_suscripcion')
      .select('*, conductores(nombre, telefono)')
      .eq('id', req.params.pagoId)
      .single();

    if (pagoError || !pago) {
      return res.status(404).json({ ok: false, error: 'Pago de suscripcion no encontrado' });
    }

    const { data, error } = await supabase
      .from('pagos_suscripcion')
      .update({ estado: 'rechazado', motivo_rechazo: motivo || 'Comprobante no valido' })
      .eq('id', req.params.pagoId)
      .select()
      .single();

    if (error) throw error;

    await registrarHistorial({
      tipo_pago: 'suscripcion',
      referencia_id: pago.id,
      conductor_id: pago.conductor_id,
      nombre_persona: pago.conductores?.nombre,
      telefono_persona: pago.conductores?.telefono,
      monto: pago.monto,
      metodo: pago.metodo_pago,
      accion: 'rechazado',
      estado_resultante: 'rechazado',
      motivo_rechazo: motivo || 'Comprobante no valido',
      comprobante_url: pago.comprobante_url,
      admin_nombre: admin_nombre || 'sistema',
    });

    res.json({ ok: true, pago: data });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

module.exports = router;