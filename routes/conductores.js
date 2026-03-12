const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Registrar nuevo conductor
router.post('/registro', async (req, res) => {
  const { nombre, telefono, email, licencia, vehiculo_placa, vehiculo_modelo } = req.body;
  try {
    const { data, error } = await supabase
      .from('conductores')
      .insert([{ nombre, telefono, email, licencia, vehiculo_placa, vehiculo_modelo }])
      .select();
    if (error) throw error;
    res.json({ ok: true, conductor: data[0] });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// Obtener conductor por teléfono
router.get('/buscar/:telefono', async (req, res) => {
  const { telefono } = req.params;
  try {
    const { data, error } = await supabase
      .from('conductores')
      .select('*')
      .eq('telefono', telefono)
      .single();
    if (error) throw error;
    res.json({ ok: true, conductor: data });
  } catch (error) {
    res.status(404).json({ ok: false, error: 'Conductor no encontrado' });
  }
});

// Obtener todos los conductores
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('conductores')
      .select('*');
    if (error) throw error;
    res.json({ ok: true, conductores: data });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// Login conductor
router.post('/login', async (req, res) => {
  const { telefono, password } = req.body;
  if (!telefono || !password) {
    return res.status(400).json({ ok: false, error: 'Teléfono y contraseña requeridos' });
  }
  try {
    const { data, error } = await supabase
      .from('conductores')
      .select('*')
      .eq('telefono', telefono)
      .single();
    if (error || !data) {
      return res.status(404).json({ ok: false, error: 'Conductor no encontrado' });
    }
    if (data.password !== password) {
      return res.status(401).json({ ok: false, error: 'Contraseña incorrecta' });
    }
    res.json({ ok: true, conductor: data });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});
module.exports = router;
