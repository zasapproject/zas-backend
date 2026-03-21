const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

router.post('/subir-foto', async (req, res) => {
  const { base64, nombre, carpeta } = req.body;
  if (!base64 || !nombre) return res.status(400).json({ ok: false, error: 'Faltan datos' });
  try {
    const buffer = Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    const path = `${carpeta || 'general'}/${nombre}_${Date.now()}.jpg`;
    const { data, error } = await supabase.storage
      .from('foto')
      .upload(path, buffer, { contentType: 'image/jpeg', upsert: true });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from('foto').getPublicUrl(path);
    res.json({ ok: true, url: urlData.publicUrl });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

module.exports = router;