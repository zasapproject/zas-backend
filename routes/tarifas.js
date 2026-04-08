const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

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

router.get('/municipios', async (req, res) => {
  try {
    const { data, error } = await supabase.from('tarifas_municipios').select('*').order('municipio');
    if (error) throw error;
    res.json({ ok: true, municipios: data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;