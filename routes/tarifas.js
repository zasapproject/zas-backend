const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const authAdmin = require('../middleware/authAdmin');

// ─────────────────────────────────────────────
// FÓRMULA OFICIAL ZAS
// Urbano  (≤ 7 km): 4.000 COP fijo
// Interurbano (> 7 km): 4.000 + (km × 1.000) + (min × 100)
// ─────────────────────────────────────────────
const TARIFA_BASE       = 4000;
const TARIFA_URBANA     = 4000;
const PRECIO_POR_KM     = 1000;
const PRECIO_POR_MIN    = 100;
const LIMITE_URBANO_KM  = 7;

function calcularTarifaZAS(distancia_km, duracion_minutos) {
  const km  = parseFloat(distancia_km)  || 1;
  const min = parseFloat(duracion_minutos) || Math.ceil((km / 25) * 60);

  if (km <= LIMITE_URBANO_KM) {
    return {
      precio: TARIFA_URBANA,
      tipo: 'urbana',
      negociable: false,
      desglose: { base: TARIFA_URBANA, km_cobrado: 0, min_cobrado: 0 },
    };
  }

  const precio = TARIFA_BASE + Math.round(km * PRECIO_POR_KM) + Math.round(min * PRECIO_POR_MIN);
  return {
    precio,
    tipo: 'interurbana',
    negociable: true,
    desglose: {
      base: TARIFA_BASE,
      km_cobrado: Math.round(km * PRECIO_POR_KM),
      min_cobrado: Math.round(min * PRECIO_POR_MIN),
    },
  };
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ─────────────────────────────────────────────
// GET /api/tarifas/calcular
// Parámetros: lat, lng, distancia_km, duracion_minutos (opcional)
// ─────────────────────────────────────────────
router.get('/calcular', async (req, res) => {
  const { lat, lng, distancia_km, duracion_minutos } = req.query;
  if (!lat || !lng) return res.status(400).json({ ok: false, error: 'Faltan coordenadas' });

  try {
    // Intentar tarifa especial por municipio primero
    const { data, error } = await supabase.from('tarifas_municipios').select('*').eq('activo', true);

    if (!error && data && data.length > 0) {
      let municipioEncontrado = null;
      for (const m of data) {
        const dist = haversine(Number(lat), Number(lng), m.lat_centro, m.lng_centro);
        if (dist <= m.radio_km) { municipioEncontrado = m; break; }
      }

      // Si hay municipio con tarifa especial configurada, usarla
      if (municipioEncontrado && municipioEncontrado.tipo === 'fija') {
        return res.json({
          ok: true,
          tipo: 'fija',
          precio: municipioEncontrado.tarifa_fija,
          municipio: municipioEncontrado.municipio,
          negociable: false,
        });
      }
    }

    // Fórmula oficial ZAS
    const resultado = calcularTarifaZAS(distancia_km, duracion_minutos);
    return res.json({
      ok: true,
      ...resultado,
      municipio: null,
    });

  } catch (e) {
    // Fallback si falla Supabase
    const resultado = calcularTarifaZAS(distancia_km, duracion_minutos);
    return res.json({ ok: true, ...resultado, municipio: null });
  }
});

// ─────────────────────────────────────────────
// GET /api/tarifas/preview
// Muestra el desglose del precio para un viaje
// Útil para mostrar al usuario cómo se calculó
// ─────────────────────────────────────────────
router.get('/preview', (req, res) => {
  const { distancia_km, duracion_minutos } = req.query;
  if (!distancia_km) return res.status(400).json({ ok: false, error: 'distancia_km es obligatorio' });

  const resultado = calcularTarifaZAS(distancia_km, duracion_minutos);
  res.json({
    ok: true,
    ...resultado,
    formula: resultado.tipo === 'urbana'
      ? `Tarifa fija urbana: ${TARIFA_URBANA.toLocaleString()} COP`
      : `${TARIFA_BASE.toLocaleString()} base + ${resultado.desglose.km_cobrado.toLocaleString()} (km) + ${resultado.desglose.min_cobrado.toLocaleString()} (min)`,
  });
});

// ─────────────────────────────────────────────
// Listar municipios
// ─────────────────────────────────────────────
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