const express = require('express');
const router = express.Router();

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;

// GET /api/maps/autocomplete?input=texto
router.get('/autocomplete', async (req, res) => {
  const { input } = req.query;
  if (!input || input.length < 3) return res.json({ ok: true, predictions: [] });
  try {
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${GOOGLE_KEY}&language=es&components=country:ve|country:co`;
    const response = await fetch(url);
    const data = await response.json();
    res.json({ ok: true, predictions: data.predictions || [] });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET /api/maps/geocode?lat=X&lng=Y
router.get('/geocode', async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ ok: false, error: 'lat y lng son obligatorios' });
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_KEY}&language=es`;
    const response = await fetch(url);
    const data = await response.json();
    const direccion = data.results?.[0]?.formatted_address || `${lat}, ${lng}`;
    res.json({ ok: true, direccion });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET /api/maps/place-details?place_id=XXX
router.get('/place-details', async (req, res) => {
  const { place_id } = req.query;
  if (!place_id) return res.status(400).json({ ok: false, error: 'place_id es obligatorio' });
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=geometry&key=${GOOGLE_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    const loc = data.result?.geometry?.location;
    if (!loc) return res.status(404).json({ ok: false, error: 'Lugar no encontrado' });
    res.json({ ok: true, lat: loc.lat, lng: loc.lng });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = router;
