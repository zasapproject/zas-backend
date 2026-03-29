const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

const METODOS_VALIDOS = ['efectivo', 'transferencia', 'pago_movil', 'dolares'];

// ─────────────────────────────────────────────
// Crear pago para un viaje
// ─────────────────────────────────────────────
router.post('/nuevo', async (req, res) => {
  const { viaje_id, monto, metodo } = req.body;

  if (!viaje_id || !monto || !metodo) {
    return res.status(400).json({ ok: false, error: 'viaje_id, monto y metodo son obligatorios' });
  }
  if (isNaN(monto) || monto <= 0) {
    return res.status(400).json({ ok: false, error: 'El monto debe ser un número mayor a 0' });
  }
  if (!METODOS_VALIDOS.includes(metodo)) {
    return res.status(400).json({ ok: false, error: `Método inválido. Válidos: ${METODOS_VALIDOS.join(', ')}` });
  }

  try {
    // Verificar que el viaje existe
    const { data: viaje, error: viajeError } = await supabase
      .from('viajes')
      .select('id, estado')
      .eq('id', viaje_id)
      .single();

    if (viajeError || !viaje) {
      return res.status(404).json({ ok: false, error: 'Viaje no encontrado' });
    }

    const { data, error } = await supabase
      .from('pagos')
      .insert([{ viaje_id, monto, metodo, estado: 'pendiente' }])
      .select();

    if (error) throw error;
    res.json({ ok: true, pago: data[0] });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// Obtener pagos de un viaje
// ─────────────────────────────────────────────
router.get('/viaje/:viaje_id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('pagos')
      .select('*')
      .eq('viaje_id', req.params.viaje_id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ ok: true, pagos: data });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// Confirmar pago
// ─────────────────────────────────────────────
router.patch('/confirmar/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('pagos')
      .update({ estado: 'completado', completado_en: new Date().toISOString() })
      .eq('id', req.params.id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ ok: false, error: 'Pago no encontrado' });
    }
    res.json({ ok: true, pago: data[0] });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// Cancelar pago
// ─────────────────────────────────────────────
router.patch('/cancelar/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('pagos')
      .update({ estado: 'cancelado' })
      .eq('id', req.params.id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ ok: false, error: 'Pago no encontrado' });
    }
    res.json({ ok: true, pago: data[0] });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// Todos los pagos — dashboard
// ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  try {
    const { data, error, count } = await supabase
      .from('pagos')
      .select('*, viajes(origen, destino, usuario_id, conductor_id)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    res.json({ ok: true, pagos: data, total: count, page, limit });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

module.exports = router;