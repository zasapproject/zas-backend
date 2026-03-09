
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Crear un pago para un viaje
router.post('/nuevo', async (req, res) => {
  const { viaje_id, monto, metodo } = req.body;
  // metodo puede ser: 'efectivo', 'tarjeta', 'nequi', 'daviplata'
  try {
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

// Obtener pagos de un viaje
router.get('/viaje/:viaje_id', async (req, res) => {
  const { viaje_id } = req.params;
  try {
    const { data, error } = await supabase
      .from('pagos')
      .select('*')
      .eq('viaje_id', viaje_id);
    if (error) throw error;
    res.json({ ok: true, pagos: data });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// Confirmar pago (cambiar estado a 'completado')
router.patch('/confirmar/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from('pagos')
      .update({ estado: 'completado' })
      .eq('id', id)
      .select();
    if (error) throw error;
    res.json({ ok: true, pago: data[0] });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// Cancelar pago
router.patch('/cancelar/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from('pagos')
      .update({ estado: 'cancelado' })
      .eq('id', id)
      .select();
    if (error) throw error;
    res.json({ ok: true, pago: data[0] });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

module.exports = router;