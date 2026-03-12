const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// Registrar nuevo conductor
router.post('/registro', async (req, res) => {
  const { nombre, telefono, email, placa_moto, modelo_moto, foto_url } = req.body;
  try {
    const { data, error } = await supabase
      .from('conductores')
      .insert([{ nombre, telefono, email, placa_moto, modelo_moto, foto_url }])
      .select();
    if (error) throw error;
    res.json({ ok: true, conductor: data[0] });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// Buscar conductor por teléfono
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

// Obtener todos los conductores activos
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('conductores')
      .select('*')
      .eq('activo', true);
    if (error) throw error;
    res.json({ ok: true, conductores: data });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// Actualizar ubicación del conductor
router.patch('/ubicacion/:id', async (req, res) => {
  const { id } = req.params;
  const { lat, lng } = req.body;
  try {
    const { data, error } = await supabase
      .from('conductores')
      .update({ lat, lng, activo: true })
      .eq('id', id)
      .select();
    if (error) throw error;
    res.json({ ok: true, conductor: data[0] });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

router.patch('/calificar/:id', async (req, res) => {
  const { id } = req.params;
  const { calificacion } = req.body;
  try {
    const { data, error } = await supabase
      .from('conductores')
      .update({ calificacion })
      .eq('id', id)
      .select();
    if (error) throw error;
    res.json({ ok: true, conductor: data[0] });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});
router.patch('/calificar/:id', async (req, res) => {
  const { id } = req.params;
  const { calificacion } = req.body;
  try {
    const { data, error } = await supabase
      .from('conductores')
      .update({ calificacion })
      .eq('id', id)
      .select();
    if (error) throw error;
    res.json({ ok: true, conductor: data[0] });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});
// Obtener TODOS los conductores (para centro de operaciones)
router.get('/todos', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('conductores')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ ok: true, conductores: data });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// Actualizar perfil conductor
router.patch('/perfil/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, telefono, placa_moto, modelo_moto, foto_url } = req.body;
  try {
    const { data, error } = await supabase
      .from('conductores')
      .update({ nombre, telefono, placa_moto, modelo_moto, foto_url })
      .eq('id', id)
      .select();
    if (error) throw error;
    res.json({ ok: true, conductor: data[0] });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

module.exports = router;// Actualizar perfil conductor
router.patch('/perfil/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, telefono, placa_moto, modelo_moto, foto_url } = req.body;
  try {
    const { data, error } = await supabase
      .from('conductores')
      .update({ nombre, telefono, placa_moto, modelo_moto, foto_url })
      .eq('id', id)
      .select();
    if (error) throw error;
    res.json({ ok: true, conductor: data[0] });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// Actualizar perfil conductor
router.patch('/perfil/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, telefono, placa_moto, modelo_moto, foto_url } = req.body;
  try {
    const { data, error } = await supabase
      .from('conductores')
      .update({ nombre, telefono, placa_moto, modelo_moto, foto_url })
      .eq('id', id)
      .select();
    if (error) throw error;
    res.json({ ok: true, conductor: data[0] });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// Actualizar perfil conductor
router.patch('/perfil/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, telefono, placa_moto, modelo_moto, foto_url } = req.body;
  try {
    const { data, error } = await supabase
      .from('conductores')
      .update({ nombre, telefono, placa_moto, modelo_moto, foto_url })
      .eq('id', id)
      .select();
    if (error) throw error;
    res.json({ ok: true, conductor: data[0] });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

router.patch('/perfil/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, telefono, placa_moto, modelo_moto, foto_url } = req.body;
  try {
    const { data, error } = await supabase
      .from('conductores')
      .update({ nombre, telefono, placa_moto, modelo_moto, foto_url })
      .eq('id', id)
      .select();
    if (error) throw error;
    res.json({ ok: true, conductor: data[0] });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});
// Guardar ubicación del conductor
router.post('/ubicacion', async (req, res) => {
  const { conductor_id, latitud, longitud } = req.body;
  const { error } = await supabase
    .from('conductores')
    .update({ latitud, longitud, ubicacion_actualizada: new Date() })
    .eq('id', conductor_id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// Leer ubicación del conductor
router.get('/ubicacion/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('conductores')
    .select('latitud, longitud')
    .eq('id', req.params.id)
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
module.exports = router;
