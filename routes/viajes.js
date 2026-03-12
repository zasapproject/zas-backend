const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// Crear nuevo viaje
router.post('/nuevo', async (req, res) => {
  const { usuario_id, origen, destino, origen_lat, origen_lng, destino_lat, destino_lng, precio } = req.body;
  try {
    const { data, error } = await supabase
      .from('viajes')
      .insert([{ usuario_id, origen, destino, origen_lat, origen_lng, destino_lat, destino_lng, precio, estado: 'solicitado' }])
      .select();
    if (error) throw error;
    res.json({ ok: true, viaje: data[0] });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// Obtener viajes de un usuario
router.get('/usuario/:usuario_id', async (req, res) => {
  const { usuario_id } = req.params;
  try {
    const { data, error } = await supabase
      .from('viajes')
      .select('*')
      .eq('usuario_id', usuario_id);
    if (error) throw error;
    res.json({ ok: true, viajes: data });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// Obtener viajes de un conductor
router.get('/conductor/:conductor_id', async (req, res) => {
  const { conductor_id } = req.params;
  try {
    const { data, error } = await supabase
      .from('viajes')
      .select('*')
      .eq('conductor_id', conductor_id);
    if (error) throw error;
    res.json({ ok: true, viajes: data });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// Actualizar estado de un viaje
router.patch('/estado/:id', async (req, res) => {
  const { id } = req.params;
  const { estado, conductor_id } = req.body;
  try {
    const { data, error } = await supabase
      .from('viajes')
      .update({ estado, ...(conductor_id && { conductor_id }) })
      .eq('id', id)
      .select();
    if (error) throw error;
    res.json({ ok: true, viaje: data[0] });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});
router.get('/estado/:estado', async (req, res) => {
  const { estado } = req.params;
  try {
    const { data, error } = await supabase
      .from('viajes')
      .select('*, usuarios(nombre, telefono, foto)')
      .eq('estado', estado);
    if (error) throw error;

    // Aplanar datos del usuario en el viaje
    const viajes = data.map(v => ({
      ...v,
      usuario_nombre: v.usuarios?.nombre || '',
      usuario_telefono: v.usuarios?.telefono || '',
      usuario_foto: v.usuarios?.foto || '',
    }));

    res.json({ ok: true, viajes });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// Leer un viaje por ID
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('viajes')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Actualizar estado del viaje
router.put('/:id/estado', async (req, res) => {
  const { estado } = req.body;
  const { error } = await supabase
    .from('viajes')
    .update({ estado })
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});
module.exports = router;
