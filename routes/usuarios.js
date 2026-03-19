const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// Registrar nuevo usuario
router.post('/registro', async (req, res) => {
  const { nombre, telefono, email, password, foto } = req.body;
  try {
    // Verificar si ya existe
    const { data: existe } = await supabase
      .from('usuarios')
      .select('id')
      .eq('telefono', telefono)
      .single();
    if (existe) return res.status(400).json({ ok: false, error: 'Ya existe una cuenta con ese teléfono' });

    const { data, error } = await supabase
      .from('usuarios')
      .insert([{ nombre, telefono, email, password, foto }])
      .select();
    if (error) throw error;
    res.json({ ok: true, usuario: data[0] });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// Login con teléfono y contraseña
router.post('/login', async (req, res) => {
  const { telefono, password } = req.body;
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('telefono', telefono)
      .single();
    if (error || !data) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    if (data.password !== password) return res.status(401).json({ ok: false, error: 'Contraseña incorrecta' });
    res.json({ ok: true, usuario: data });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// Buscar usuario por teléfono
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

// Subir documento del usuario
router.patch('/documentos/:id', async (req, res) => {
  const { foto_cedula } = req.body;
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .update({ foto_cedula })
      .eq('id', req.params.id)
      .select();
    if (error) throw error;
    res.json({ ok: true, usuario: data[0] });
  } catch (error) { res.status(400).json({ ok: false, error: error.message }); }
});
module.exports = router;