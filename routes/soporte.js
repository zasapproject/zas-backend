const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// Enviar mensaje de soporte
router.post('/nuevo', async (req, res) => {
  const { nombre, telefono, tipo, mensaje } = req.body;
  if (!mensaje) return res.status(400).json({ ok: false, error: 'El mensaje es obligatorio' });
  try {
    const { data, error } = await supabase
      .from('soporte')
      .insert([{ nombre, telefono, tipo, mensaje }])
      .select();
    if (error) throw error;
    res.json({ ok: true, soporte: data[0] });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// Obtener todos los mensajes
router.get('/todos', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('soporte')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ ok: true, mensajes: data, total: data.length });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// Marcar como resuelto
router.patch('/resolver/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('soporte')
      .update({ estado: 'resuelto' })
      .eq('id', req.params.id)
      .select();
    if (error) throw error;
    res.json({ ok: true, soporte: data[0] });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});
module.exports = router;