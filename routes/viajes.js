const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

router.post('/nuevo', async (req, res) => {
  const { usuario_id, origen, destino, origen_lat, origen_lng, destino_lat, destino_lng, precio } = req.body;
  try {
    const { data, error } = await supabase.from('viajes').insert([{ usuario_id, origen, destino, origen_lat, origen_lng, destino_lat, destino_lng, precio, estado: 'solicitado' }]).select();
    if (error) throw error;
    res.json({ ok: true, viaje: data[0] });
  } catch (error) { res.status(400).json({ ok: false, error: error.message }); }
});

router.get('/usuario/:usuario_id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('viajes').select('*, conductores(nombre, telefono, foto_url, placa_moto, modelo_moto)').eq('usuario_id', req.params.usuario_id);
    if (error) throw error;
    const viajes = data.map(v => ({ ...v, conductor_nombre: v.conductores?.nombre || '', conductor_telefono: v.conductores?.telefono || '', conductor_foto: v.conductores?.foto_url || '', conductor_placa: v.conductores?.placa_moto || '', conductor_modelo: v.conductores?.modelo_moto || '' }));
    res.json({ ok: true, viajes });
  } catch (error) { res.status(400).json({ ok: false, error: error.message }); }
});

router.get('/conductor/:conductor_id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('viajes').select('*').eq('conductor_id', req.params.conductor_id);
    if (error) throw error;
    res.json({ ok: true, viajes: data });
  } catch (error) { res.status(400).json({ ok: false, error: error.message }); }
});

router.patch('/estado/:id', async (req, res) => {
  const { estado, conductor_id } = req.body;
  try {
    const { data, error } = await supabase.from('viajes').update({ estado, ...(conductor_id && { conductor_id }) }).eq('id', req.params.id).select();
    if (error) throw error;
    res.json({ ok: true, viaje: data[0] });
  } catch (error) { res.status(400).json({ ok: false, error: error.message }); }
});

router.get('/estado/:estado', async (req, res) => {
  try {
    const { data, error } = await supabase.from('viajes').select('*, usuarios(nombre, telefono, foto_url)').eq('estado', req.params.estado);
    if (error) throw error;
    const viajes = data.map(v => ({ ...v, usuario_nombre: v.usuarios?.nombre || '', usuario_telefono: v.usuarios?.telefono || '', usuario_foto: v.usuarios?.foto_url || '' }));
    res.json({ ok: true, viajes });
  } catch (error) { res.status(400).json({ ok: false, error: error.message }); }
});

router.get('/:id', async (req, res) => {
  const { data, error } = await supabase.from('viajes').select('*').eq('id', req.params.id).single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.put('/:id/estado', async (req, res) => {
  const { estado } = req.body;
  const { error } = await supabase.from('viajes').update({ estado }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

module.exports = router;

