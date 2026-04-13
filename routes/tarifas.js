const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const authAdmin = require('../middleware/authAdmin');

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Calcular precio
router.get('/calcular', async (req, res) => {
  const { lat, lng, distancia_km } = req.query;
  if (!lat || !lng) return res.status(400).json({ ok: false, error: 'Faltan coordenadas' });
  try {
    const { data, error } = await supabase.from('tarifas_municipios').select('*').eq('activo', true);
    if (error) throw error;
    let municipioEncontrado = null;
    for (const m of data) {
      const dist = haversine(Number(lat), Number(lng), m.lat_centro, m.lng_centro);
      if (dist <= m.radio_km) { municipioEncontrado = m; break; }
    }
    if (!municipioEncontrado) {
      const distKm = Number(distancia_km) || 1;
      const precio = Math.max(3000, Math.round(distKm * 800));
      return res.json({ ok: true, tipo: 'dinamica', precio, municipio: null });
    }
    if (municipioEncontrado.tipo === 'fija') {
      return res.json({ ok: true, tipo: 'fija', precio: municipioEncontrado.tarifa_fija, municipio: municipioEncontrado.municipio });
    } else {
      const distKm = Number(distancia_km) || 1;
      const precio = Math.max(municipioEncontrado.tarifa_base || 3000, Math.round(distKm * (municipioEncontrado.tarifa_por_km || 800)));
      return res.json({ ok: true, tipo: 'dinamica', precio, municipio: municipioEncontrado.municipio });
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Listar municipios
router.get('/municipios', async (req, res) => {
  try {
    const { data, error } = await supabase.from('tarifas_municipios').select('*').order('municipio');
    if (error) throw error;
    res.json({ ok: true, municipios: data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Crear municipio
router.post('/municipios', authAdmin, async (req, res) => {
  const { municipio, lat_centro, lng_centro, radio_km, tipo, tarifa_fija, tarifa_base, tarifa_por_km, activo } = req.body;
  if (!municipio || lat_centro == null || lng_centro == null || !radio_km || !tipo) {
    return res.status(400).json({ ok: false, error: 'Faltan campos obligatorios' });
  }
  try {
    const { data, error } = await supabase.from('tarifas_municipios').insert({
      municipio, lat_centro, lng_centro, radio_km, tipo,
      tarifa_fija: tarifa_fija || null,
      tarifa_base: tarifa_base || null,
      tarifa_por_km: tarifa_por_km || null,
      activo: activo !== false
    }).select().single();
    if (error) throw error;
    res.json({ ok: true, municipio: data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Actualizar municipio
router.patch('/municipios/:id', authAdmin, async (req, res) => {
  const { id } = req.params;
  const updates = {};
  const campos = ['municipio', 'lat_centro', 'lng_centro', 'radio_km', 'tipo', 'tarifa_fija', 'tarifa_base', 'tarifa_por_km', 'activo'];
  for (const campo of campos) {
    if (req.body[campo] !== undefined) updates[campo] = req.body[campo];
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ ok: false, error: 'No hay campos para actualizar' });
  }
  try {
    const { data, error } = await supabase.from('tarifas_municipios').update(updates).eq('id', id).select().single();
    if (error) throw error;
    res.json({ ok: true, municipio: data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Eliminar municipio
router.delete('/municipios/:id', authAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('tarifas_municipios').delete().eq('id', id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;