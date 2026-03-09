const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// Registrar nuevo usuario
router.post('/registro', async (req, res) => {
  const { nombre, telefono, email } = req.body;
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .insert([{ nombre, telefono, email }])
      .select();
    if (error) throw error;
    res.json({ ok: true, usuario: data[0] });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// Obtener usuario por teléfono
router.get('/buscar/:telefono', async (req, res) => {
  const { telefono } = req.params;
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('telefono', telefono)
      .single();
    if (error) throw error;
    res.json({ ok: true, usuario: data });
  } catch (error) {
    res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
  }
});

module.exports = router;