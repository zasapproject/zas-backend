const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.supabase_url,
  process.env.supabase_key
);

// GET /suscripciones/estado/:conductorId
router.get('/estado/:conductorId', async (req, res) => {
  const { conductorId } = req.params;
  
  const { data, error } = await supabase
    .from('conductores')
    .select('id, nombre, suscripcion_hasta')
    .eq('id', conductorId)
    .single();

  if (error) return res.status(404).json({ error: 'Conductor no encontrado' });

  const ahora = new Date();
  const hasta = data.suscripcion_hasta ? new Date(data.suscripcion_hasta) : null;
  const activo = hasta && hasta > ahora;

  res.json({
    conductor_id: data.id,
    nombre: data.nombre,
    suscripcion_hasta: data.suscripcion_hasta,
    activo,
    dias_restantes: activo 
      ? Math.ceil((hasta - ahora) / (1000 * 60 * 60 * 24)) 
      : 0
  });
});

// POST /suscripciones/activar
router.post('/activar', async (req, res) => {
  const { conductor_id, metodo_pago, monto } = req.body;

  if (!conductor_id) {
    return res.status(400).json({ error: 'conductor_id requerido' });
  }

  const { data: conductor } = await supabase
    .from('conductores')
    .select('suscripcion_hasta, nombre')
    .eq('id', conductor_id)
    .single();

  const ahora = new Date();
  const base = conductor?.suscripcion_hasta && new Date(conductor.suscripcion_hasta) > ahora
    ? new Date(conductor.suscripcion_hasta)
    : ahora;

  const nueva_fecha = new Date(base);
  nueva_fecha.setDate(nueva_fecha.getDate() + 7);

  const { data, error } = await supabase
    .from('conductores')
    .update({ suscripcion_hasta: nueva_fecha.toISOString() })
    .eq('id', conductor_id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await supabase.from('pagos_suscripcion').insert({
    conductor_id,
    monto: monto || 20000,
    moneda: 'COP',
    metodo_pago: metodo_pago || 'efectivo',
    suscripcion_hasta: nueva_fecha.toISOString()
  });

  res.json({
    success: true,
    mensaje: `Suscripción activa hasta ${nueva_fecha.toLocaleDateString('es-CO')}`,
    suscripcion_hasta: nueva_fecha.toISOString(),
    dias_activos: 7
  });
});

// GET /suscripciones/vencimientos
router.get('/vencimientos', async (req, res) => {
  const en3dias = new Date();
  en3dias.setDate(en3dias.getDate() + 3);

  const { data, error } = await supabase
    .from('conductores')
    .select('id, nombre, telefono, suscripcion_hasta')
    .lte('suscripcion_hasta', en3dias.toISOString())
    .gte('suscripcion_hasta', new Date().toISOString())
    .order('suscripcion_hasta', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  res.json({ conductores: data, total: data.length });
});

module.exports = router;