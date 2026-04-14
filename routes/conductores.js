const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const supabase = require('../supabase');
const { emailConductorAprobado } = require('../mailer');

// ─────────────────────────────────────────────
// Rate limiting
// ─────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5,
  message: { ok: false, error: 'Demasiados intentos. Espera 15 minutos antes de intentar de nuevo.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const registroLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10,
  message: { ok: false, error: 'Demasiados registros desde esta conexión. Intenta más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─────────────────────────────────────────────
// Registro conductor
// ─────────────────────────────────────────────
router.post('/registro', registroLimiter, async (req, res) => {
  const { nombre, telefono, email, placa_moto, modelo_moto, foto_url, password, foto_cedula, foto_licencia, foto_registro_moto, foto_rcv, foto_antecedentes } = req.body;

  if (!nombre || !telefono || !password) {
    return res.status(400).json({ ok: false, error: 'Nombre, teléfono y contraseña son obligatorios' });
  }
  if (password.length < 4) {
    return res.status(400).json({ ok: false, error: 'La contraseña debe tener mínimo 4 caracteres' });
  }

  try {
    // Verificar si ya existe
    const { data: existe } = await supabase
      .from('conductores')
      .select('id')
      .eq('telefono', telefono)
      .single();

    if (existe) {
      return res.status(400).json({ ok: false, error: 'Ya existe una cuenta con ese teléfono' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from('conductores')
      .insert([{
        nombre, telefono, email, placa_moto, modelo_moto, foto_url,
        password: passwordHash,
        foto_cedula, foto_licencia, foto_registro_moto, foto_rcv, foto_antecedentes,
      }])
      .select();

    if (error) throw error;

    const { password: _, ...conductorSeguro } = data[0];
    res.json({ ok: true, conductor: conductorSeguro });

  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// Login conductor
// ─────────────────────────────────────────────
router.post('/login', loginLimiter, async (req, res) => {
  const { telefono, password } = req.body;
  if (!telefono || !password) {
    return res.status(400).json({ ok: false, error: 'Teléfono y contraseña son obligatorios' });
  }

  try {
    const { data, error } = await supabase
      .from('conductores')
      .select('*')
      .eq('telefono', telefono)
      .single();

    if (error || !data) {
      return res.status(404).json({ ok: false, error: 'Conductor no encontrado' });
    }

    // Soporta hash y texto plano (migración gradual)
    let passwordValida = false;
    if (data.password && data.password.startsWith('$2')) {
      passwordValida = await bcrypt.compare(password, data.password);
    } else {
      passwordValida = data.password === password;
      if (passwordValida) {
        const nuevoHash = await bcrypt.hash(password, 10);
        await supabase.from('conductores').update({ password: nuevoHash }).eq('id', data.id);
      }
    }

    if (!passwordValida) {
      return res.status(401).json({ ok: false, error: 'Contraseña incorrecta' });
    }

    const { password: _, ...conductorSeguro } = data;
    res.json({ ok: true, conductor: conductorSeguro });

  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// Buscar conductor por teléfono
// ─────────────────────────────────────────────
router.get('/buscar/:telefono', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('conductores')
      .select('id, nombre, telefono, email, foto_url, placa_moto, modelo_moto, calificacion, activo, created_at')
      .eq('telefono', req.params.telefono)
      .single();

    if (error) throw error;
    res.json({ ok: true, conductor: data });
  } catch (error) {
    res.status(404).json({ ok: false, error: 'Conductor no encontrado' });
  }
});

// ─────────────────────────────────────────────
// Todos los conductores
// ─────────────────────────────────────────────
router.get('/todos', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('conductores')
      .select('id, nombre, telefono, email, foto_url, placa_moto, modelo_moto, calificacion, activo, documentos_verificados, created_at, foto_cedula, foto_licencia, foto_registro_moto, foto_rcv, foto_antecedentes, suscripcion_hasta')
      
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ ok: true, conductores: data });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// Conductores activos
// ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('conductores')
      .select('id, nombre, foto_url, placa_moto, modelo_moto, calificacion, lat, lng, latitud, longitud')
      .eq('activo', true);

    if (error) throw error;
    res.json({ ok: true, conductores: data });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// Actualizar ubicación (patch)
// ─────────────────────────────────────────────
router.patch('/ubicacion/:id', async (req, res) => {
  const { lat, lng } = req.body;
  try {
    const { data, error } = await supabase
      .from('conductores')
      .update({ lat, lng, activo: true })
      .eq('id', req.params.id)
      .select('id, lat, lng, activo');

    if (error) throw error;
    res.json({ ok: true, conductor: data[0] });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// Actualizar ubicación (post)
// ─────────────────────────────────────────────
router.post('/ubicacion', async (req, res) => {
  const { conductor_id, latitud, longitud } = req.body;
  const { error } = await supabase
    .from('conductores')
    .update({ latitud, longitud, ubicacion_actualizada: new Date() })
    .eq('id', conductor_id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ─────────────────────────────────────────────
// Obtener ubicación conductor
// ─────────────────────────────────────────────
router.get('/ubicacion/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('conductores')
    .select('latitud, longitud')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ─────────────────────────────────────────────
// Calificar conductor
// ─────────────────────────────────────────────
router.patch('/calificar/:id', async (req, res) => {
  const { calificacion } = req.body;

  if (!calificacion || calificacion < 1 || calificacion > 5) {
    return res.status(400).json({ ok: false, error: 'Calificación debe ser entre 1 y 5' });
  }

  try {
    const { data, error } = await supabase
      .from('conductores')
      .update({ calificacion })
      .eq('id', req.params.id)
      .select('id, nombre, calificacion');

    if (error) throw error;
    res.json({ ok: true, conductor: data[0] });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// Editar perfil conductor
// ─────────────────────────────────────────────
router.patch('/perfil/:id', async (req, res) => {
  const { nombre, telefono, placa_moto, modelo_moto, foto_url } = req.body;
  try {
    const { data, error } = await supabase
      .from('conductores')
      .update({ nombre, telefono, placa_moto, modelo_moto, foto_url })
      .eq('id', req.params.id)
      .select('id, nombre, telefono, placa_moto, modelo_moto, foto_url');

    if (error) throw error;
    res.json({ ok: true, conductor: data[0] });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// Subir documentos del conductor
// ─────────────────────────────────────────────
router.patch('/documentos/:id', async (req, res) => {
  const { foto_cedula, foto_licencia, fecha_vencimiento_licencia, foto_registro_moto, fecha_vencimiento_registro } = req.body;
  try {
    const { data, error } = await supabase
      .from('conductores')
      .update({ foto_cedula, foto_licencia, fecha_vencimiento_licencia, foto_registro_moto, fecha_vencimiento_registro })
      .eq('id', req.params.id)
      .select('id, nombre, foto_cedula, foto_licencia, foto_registro_moto');

    if (error) throw error;
    res.json({ ok: true, conductor: data[0] });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// Verificar documentos del conductor
// ─────────────────────────────────────────────
router.patch('/verificar/:id', async (req, res) => {
  const { documentos_verificados } = req.body;
  try {
    const { data, error } = await supabase
      .from('conductores')
      .update({ documentos_verificados })
      .eq('id', req.params.id)
      .select('id, nombre, email, documentos_verificados');

    if (error) throw error;

    if (documentos_verificados && data[0].email) {
      emailConductorAprobado(data[0].nombre, data[0].email).catch((err) => console.error('Error email:', err));
    }

    res.json({ ok: true, conductor: data[0] });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// Guardar push token del conductor
// ─────────────────────────────────────────────
router.patch('/push-token/:id', async (req, res) => {
  const { push_token } = req.body;
  try {
    const { data, error } = await supabase
      .from('conductores')
      .update({ push_token })
      .eq('id', req.params.id)
      .select('id, nombre, push_token');

    if (error) throw error;
    res.json({ ok: true, conductor: data[0] });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// Notificar vencimientos
// ─────────────────────────────────────────────
router.post('/notificar-vencimientos', async (req, res) => {
  const en3dias = new Date();
  en3dias.setDate(en3dias.getDate() + 3);

  const { data, error } = await supabase
    .from('conductores')
    .select('id, nombre, push_token, suscripcion_hasta')
    .lte('suscripcion_hasta', en3dias.toISOString())
    .gte('suscripcion_hasta', new Date().toISOString());

  if (error) return res.status(500).json({ error: error.message });

  let enviadas = 0;
  for (const conductor of data) {
    if (!conductor.push_token) continue;
    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: conductor.push_token,
          title: 'ZAS - Suscripción por vencer',
          body: `Hola ${conductor.nombre}, tu suscripción vence pronto. Renuévala para seguir recibiendo viajes.`,
          sound: 'default',
        }),
      });
      enviadas++;
    } catch (e) {}
  }

  res.json({ ok: true, enviadas, total: data.length });
});

// ─────────────────────────────────────────────
// Reset password conductor
// ─────────────────────────────────────────────
router.patch('/reset-password/:id', async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 4) {
    return res.status(400).json({ ok: false, error: 'Contraseña muy corta' });
  }
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const { data, error } = await supabase
      .from('conductores')
      .update({ password: passwordHash })
      .eq('id', req.params.id)
      .select('id, nombre, telefono');

    if (error) throw error;
    res.json({ ok: true, conductor: data[0] });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

module.exports = router;