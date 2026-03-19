const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

router.post('/registro', async (req, res) => {
  const { nombre, telefono, email, placa_moto, modelo_moto, foto_url, password } = req.body;
  try {
    const { data, error } = await supabase.from('conductores').insert([{ nombre, telefono, email, placa_moto, modelo_moto, foto_url, password }]).select();
    if (error) throw error;
    res.json({ ok: true, conductor: data[0] });
  } catch (error) { res.status(400).json({ ok: false, error: error.message }); }
});

router.post('/login', async (req, res) => {
  const { telefono, password } = req.body;
  if (!telefono || !password) return res.status(400).json({ ok: false, error: 'Telefono y contrasena requeridos' });
  try {
    const { data, error } = await supabase.from('conductores').select('*').eq('telefono', telefono).single();
    if (error || !data) return res.status(404).json({ ok: false, error: 'Conductor no encontrado' });
    if (data.password !== password) return res.status(401).json({ ok: false, error: 'Contrasena incorrecta' });
    res.json({ ok: true, conductor: data });
  } catch (error) { res.status(400).json({ ok: false, error: error.message }); }
});

router.get('/buscar/:telefono', async (req, res) => {
  try {
    const { data, error } = await supabase.from('conductores').select('*').eq('telefono', req.params.telefono).single();
    if (error) throw error;
    res.json({ ok: true, conductor: data });
  } catch (error) { res.status(404).json({ ok: false, error: 'Conductor no encontrado' }); }
});

router.get('/todos', async (req, res) => {
  try {
    const { data, error } = await supabase.from('conductores').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ ok: true, conductores: data });
  } catch (error) { res.status(400).json({ ok: false, error: error.message }); }
});

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase.from('conductores').select('*').eq('activo', true);
    if (error) throw error;
    res.json({ ok: true, conductores: data });
  } catch (error) { res.status(400).json({ ok: false, error: error.message }); }
});

router.patch('/ubicacion/:id', async (req, res) => {
  const { lat, lng } = req.body;
  try {
    const { data, error } = await supabase.from('conductores').update({ lat, lng, activo: true }).eq('id', req.params.id).select();
    if (error) throw error;
    res.json({ ok: true, conductor: data[0] });
  } catch (error) { res.status(400).json({ ok: false, error: error.message }); }
});

router.post('/ubicacion', async (req, res) => {
  const { conductor_id, latitud, longitud } = req.body;
  const { error } = await supabase.from('conductores').update({ latitud, longitud, ubicacion_actualizada: new Date() }).eq('id', conductor_id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

router.get('/ubicacion/:id', async (req, res) => {
  const { data, error } = await supabase.from('conductores').select('latitud, longitud').eq('id', req.params.id).single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.patch('/calificar/:id', async (req, res) => {
  const { calificacion } = req.body;
  try {
    const { data, error } = await supabase.from('conductores').update({ calificacion }).eq('id', req.params.id).select();
    if (error) throw error;
    res.json({ ok: true, conductor: data[0] });
  } catch (error) { res.status(400).json({ ok: false, error: error.message }); }
});

router.patch('/perfil/:id', async (req, res) => {
  const { nombre, telefono, placa_moto, modelo_moto, foto_url } = req.body;
  try {
    const { data, error } = await supabase.from('conductores').update({ nombre, telefono, placa_moto, modelo_moto, foto_url }).eq('id', req.params.id).select();
    if (error) throw error;
    res.json({ ok: true, conductor: data[0] });
  } catch (error) { res.status(400).json({ ok: false, error: error.message }); }
});

// Subir documentos del conductor
router.patch('/documentos/:id', async (req, res) => {
  const { foto_cedula, foto_licencia, fecha_vencimiento_licencia, foto_registro_moto, fecha_vencimiento_registro } = req.body;
  try {
    const { data, error } = await supabase
      .from('conductores')
      .update({ foto_cedula, foto_licencia, fecha_vencimiento_licencia, foto_registro_moto, fecha_vencimiento_registro })
      .eq('id', req.params.id)
      .select();
    if (error) throw error;
    res.json({ ok: true, conductor: data[0] });
  } catch (error) { res.status(400).json({ ok: false, error: error.message }); }
});

// Verificar documentos del conductor
router.patch('/verificar/:id', async (req, res) => {
  const { documentos_verificados } = req.body;
  try {
    const { data, error } = await supabase
      .from('conductores')
      .update({ documentos_verificados })
      .eq('id', req.params.id)
      .select();
    if (error) throw error;
    res.json({ ok: true, conductor: data[0] });
  } catch (error) { res.status(400).json({ ok: false, error: error.message }); }
});
module.exports = router;
