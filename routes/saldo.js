const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { notificarRetiroAprobado, notificarRetiroRechazado } = require('../notificaciones');

// ─────────────────────────────────────────────
// GET /api/saldo/:conductor_id
// Saldo disponible del conductor
// ─────────────────────────────────────────────
router.get('/:conductor_id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('saldo_conductores')
      .select('*')
      .eq('conductor_id', req.params.conductor_id)
      .single();

    if (error || !data) {
      // Si no tiene registro aún → saldo cero
      return res.json({
        ok: true,
        saldo: {
          conductor_id: req.params.conductor_id,
          saldo_disponible: 0,
          saldo_retenido: 0,
          total_ganado: 0,
        },
      });
    }

    res.json({ ok: true, saldo: data });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// POST /api/saldo/retiro/solicitar
// Conductor solicita cashout de su saldo
// ─────────────────────────────────────────────
router.post('/retiro/solicitar', async (req, res) => {
  const { conductor_id, monto, metodo_retiro } = req.body;

  const METODOS_RETIRO = ['pago_movil', 'zelle', 'transferencia', 'usdt'];

  if (!conductor_id || !monto || !metodo_retiro) {
    return res.status(400).json({ ok: false, error: 'conductor_id, monto y metodo_retiro son obligatorios' });
  }
  if (!METODOS_RETIRO.includes(metodo_retiro)) {
    return res.status(400).json({ ok: false, error: `Método inválido. Válidos: ${METODOS_RETIRO.join(', ')}` });
  }

  try {
    // Verificar saldo disponible
    const { data: saldo } = await supabase
      .from('saldo_conductores')
      .select('saldo_disponible')
      .eq('conductor_id', conductor_id)
      .single();

    const disponible = parseFloat(saldo?.saldo_disponible || 0);

    if (disponible < parseFloat(monto)) {
      return res.status(400).json({
        ok: false,
        error: `Saldo insuficiente. Disponible: $${disponible.toFixed(2)}`,
      });
    }

    // Verificar que el conductor tiene datos bancarios registrados
    const { data: datosBancarios } = await supabase
      .from('datos_bancarios_conductor')
      .select('*')
      .eq('conductor_id', conductor_id)
      .single();

    if (!datosBancarios) {
      return res.status(400).json({
        ok: false,
        error: 'Debes registrar tus datos bancarios antes de solicitar un retiro.',
      });
    }

    // Crear solicitud de retiro
    const { data: retiro, error } = await supabase
      .from('retiros')
      .insert({
        conductor_id,
        monto: parseFloat(monto),
        metodo_retiro,
        estado: 'solicitado',
        datos_bancarios: datosBancarios,
      })
      .select()
      .single();

    if (error) throw error;

    // Mover saldo de disponible a retenido mientras se procesa
    await supabase
      .from('saldo_conductores')
      .update({
        saldo_disponible: disponible - parseFloat(monto),
        saldo_retenido: parseFloat(saldo?.saldo_retenido || 0) + parseFloat(monto),
        ultima_actualizacion: new Date().toISOString(),
      })
      .eq('conductor_id', conductor_id);

    res.json({
      ok: true,
      retiro,
      mensaje: 'Solicitud de retiro recibida. ZAS procesará el pago en las próximas 24-48 horas.',
    });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET /api/saldo/retiros/pendientes
// Admin ve todos los retiros por aprobar
// ─────────────────────────────────────────────
router.get('/retiros/pendientes', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('retiros')
      .select('*, conductores(nombre, telefono)')
      .eq('estado', 'solicitado')
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json({ ok: true, retiros: data, total: data.length });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// PATCH /api/saldo/retiro/aprobar/:id
// Admin aprueba y procesa el retiro
// ─────────────────────────────────────────────
router.patch('/retiro/aprobar/:id', async (req, res) => {
  const { comprobante_url } = req.body;

  try {
    const { data: retiro, error: retiroError } = await supabase
      .from('retiros')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (retiroError || !retiro) {
      return res.status(404).json({ ok: false, error: 'Retiro no encontrado' });
    }

    // Marcar retiro como procesado
    const { data, error } = await supabase
      .from('retiros')
      .update({
        estado: 'procesado',
        procesado_en: new Date().toISOString(),
        comprobante_url: comprobante_url || null,
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Limpiar el saldo retenido del conductor
    const { data: saldo } = await supabase
      .from('saldo_conductores')
      .select('saldo_retenido')
      .eq('conductor_id', retiro.conductor_id)
      .single();

    await supabase
      .from('saldo_conductores')
      .update({
        saldo_retenido: Math.max(0, parseFloat(saldo?.saldo_retenido || 0) - retiro.monto),
        ultima_actualizacion: new Date().toISOString(),
      })
      .eq('conductor_id', retiro.conductor_id);

    await notificarRetiroAprobado(retiro.conductor_id, retiro.monto, retiro.metodo_retiro);
    res.json({ ok: true, retiro: data, mensaje: 'Retiro procesado correctamente.' });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// PATCH /api/saldo/retiro/rechazar/:id
// Admin rechaza un retiro y devuelve el saldo
// ─────────────────────────────────────────────
router.patch('/retiro/rechazar/:id', async (req, res) => {
  const { motivo } = req.body;

  try {
    const { data: retiro } = await supabase
      .from('retiros')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (!retiro) return res.status(404).json({ ok: false, error: 'Retiro no encontrado' });

    await supabase
      .from('retiros')
      .update({ estado: 'rechazado', motivo_rechazo: motivo || 'Rechazado por admin' })
      .eq('id', req.params.id);

    // Devolver saldo al conductor
    const { data: saldo } = await supabase
      .from('saldo_conductores')
      .select('*')
      .eq('conductor_id', retiro.conductor_id)
      .single();

    await supabase
      .from('saldo_conductores')
      .update({
        saldo_disponible: parseFloat(saldo?.saldo_disponible || 0) + retiro.monto,
        saldo_retenido: Math.max(0, parseFloat(saldo?.saldo_retenido || 0) - retiro.monto),
        ultima_actualizacion: new Date().toISOString(),
      })
      .eq('conductor_id', retiro.conductor_id);

    await notificarRetiroRechazado(retiro.conductor_id, retiro.monto, motivo);
    res.json({ ok: true, mensaje: 'Retiro rechazado y saldo devuelto al conductor.' });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

module.exports = router;