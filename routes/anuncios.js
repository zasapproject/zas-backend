const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const authAdmin = require('../middleware/authAdmin');

// ─────────────────────────────────────────────
// GET /api/anuncios/splash
// Anuncios activos tipo 'splash', ordenados por campo orden
// Filtra por activo=true y rango de fechas (si aplica)
// ─────────────────────────────────────────────
router.get('/splash', async (req, res) => {
  const now = new Date().toISOString();
  try {
    const { data, error } = await supabase
      .from('anuncios')
      .select('*')
      .eq('tipo', 'splash')
      .eq('activo', true)
      .or(`fecha_inicio.is.null,fecha_inicio.lte.${now}`)
      .or(`fecha_fin.is.null,fecha_fin.gte.${now}`)
      .order('orden', { ascending: true });

    if (error) throw error;
    res.json({ ok: true, anuncios: data });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// PATCH /api/anuncios/:id/activo
// Activa o desactiva un anuncio (campo activo)
// ─────────────────────────────────────────────
router.patch('/:id/activo', authAdmin, async (req, res) => {
  const { activo } = req.body;

  if (typeof activo !== 'boolean') {
    return res.status(400).json({ ok: false, error: 'El campo activo debe ser boolean' });
  }

  try {
    const { data, error } = await supabase
      .from('anuncios')
      .update({ activo })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ ok: false, error: 'Anuncio no encontrado' });

    res.json({ ok: true, anuncio: data });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET /api/anuncios
// Lista todos los anuncios con datos del anunciante
// ─────────────────────────────────────────────
router.get('/', authAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('anuncios')
      .select('*, anunciantes(*)')
      .order('orden', { ascending: true });

    if (error) throw error;
    res.json({ ok: true, anuncios: data, total: data.length });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// POST /api/anuncios
// Crea un anuncio nuevo
// Campos requeridos: anunciante_id, imagen_url, orden
// ─────────────────────────────────────────────
router.post('/', authAdmin, async (req, res) => {
  const { anunciante_id, imagen_url, orden, ...resto } = req.body;

  if (!anunciante_id || !imagen_url || orden == null) {
    return res.status(400).json({ ok: false, error: 'anunciante_id, imagen_url y orden son obligatorios' });
  }

  try {
    const { data, error } = await supabase
      .from('anuncios')
      .insert([{ anunciante_id, imagen_url, orden, ...resto }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ ok: true, anuncio: data });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// POST /api/anuncios/anunciante
// Crea un nuevo anunciante
// Campo requerido: nombre
// ─────────────────────────────────────────────
router.post('/anunciante', authAdmin, async (req, res) => {
  const { nombre, contacto_nombre, contacto_telefono, plan, monto_mensual } = req.body;

  if (!nombre) {
    return res.status(400).json({ ok: false, error: 'nombre es obligatorio' });
  }

  try {
    const { data, error } = await supabase
      .from('anunciantes')
      .insert([{ nombre, contacto_nombre, contacto_telefono, plan, monto_mensual }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ ok: true, anunciante: data });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET /api/anuncios/anunciantes
// Lista todos los anunciantes
// ─────────────────────────────────────────────
router.get('/anunciantes', authAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('anunciantes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ ok: true, anunciantes: data, total: data.length });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

module.exports = router;
