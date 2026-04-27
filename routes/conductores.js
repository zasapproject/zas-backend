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

  if (!nombre || !telefono || !password || !email) {
    return res.status(400).json({ ok: false, error: 'Nombre, teléfono y contraseña son obligatorios' });
  }
  if (!email || !email.includes('@')) {
  return res.status(400).json({ ok: false, error: 'El correo electrónico es obligatorio y debe ser válido' });
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
    const { data: existeEmail } = await supabase
      .from('conductores')
      .select('id')
      .eq('email', email)
      .single();

    if (existeEmail) {
      return res.status(400).json({ ok: false, error: 'Ya existe una cuenta con ese correo electrónico' });
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
  const { nombre, telefono, placa_moto, modelo_moto, foto_url, email } = req.body;
  try {
    const { data, error } = await supabase
      .from('conductores')
      .update({ nombre, telefono, placa_moto, modelo_moto, foto_url, email })
      .eq('id', req.params.id)
      .select('id, nombre, telefono, placa_moto, modelo_moto, foto_url, email');

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
// ─────────────────────────────────────────────
// Buscar conductor por email (para recuperar contraseña)
// ─────────────────────────────────────────────
router.get('/buscar-email/:email', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('conductores')
      .select('id, nombre, telefono, email')
      .eq('email', req.params.email)
      .single();

    if (error || !data) {
      return res.status(404).json({ ok: false, error: 'No existe ningún conductor con ese correo' });
    }

    res.json({ ok: true, conductor: data });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});
// ─────────────────────────────────────────────
// Logout conductor — cambia estado a inactivo
// ─────────────────────────────────────────────
router.post('/logout/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('conductores')
      .update({ estado: 'inactivo', activo: false })
      .eq('id', req.params.id)
      .select('id, nombre, estado');

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ ok: false, error: 'Conductor no encontrado' });
    }

    res.json({ ok: true, mensaje: 'Sesión cerrada correctamente', conductor: data[0] });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});
// ─────────────────────────────────────────────
// Cambiar estado del conductor
// ─────────────────────────────────────────────
router.patch('/estado/:id', async (req, res) => {
  const { estado } = req.body;
  const estadosValidos = ['disponible', 'ocupado', 'inactivo'];
  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({ ok: false, error: 'Estado no válido' });
  }
  const { data, error } = await supabase
    .from('conductores')
    .update({ estado })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(400).json({ ok: false, error: error.message });
  res.json({ ok: true, conductor: data });
});
// ─────────────────────────────────────────────
// POST /api/conductores/recuperar-password
// Conductor solicita recuperación de contraseña
// ─────────────────────────────────────────────
router.post('/recuperar-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ ok: false, error: 'Email es obligatorio' });
  }

  try {
    const { data, error } = await supabase
      .from('conductores')
      .select('id, nombre, email')
      .eq('email', email)
      .single();

    if (error || !data) {
      return res.status(404).json({ ok: false, error: 'No encontramos una cuenta con ese email' });
    }

    const nueva = Math.random().toString(36).slice(-6).toUpperCase();

    await supabase
      .from('conductores')
      .update({ password: nueva })
      .eq('id', data.id);

    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'ZAS Mototaxi', email: 'soporte@zasapps.com' },
        to: [{ email: data.email, name: data.nombre }],
        subject: 'Tu contraseña temporal — ZAS Mototaxi',
        htmlContent: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;border:1px solid #eee;border-radius:12px;">
            <h2 style="color:#000;">Hola ${data.nombre} 👋</h2>
            <p>Recibimos tu solicitud para recuperar tu contraseña en <b>ZAS Mototaxi</b>.</p>
            <p>Tu contraseña temporal es:</p>
            <div style="background:#f4f4f4;border-radius:8px;padding:20px;text-align:center;margin:20px 0;">
              <span style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#000;">${nueva}</span>
            </div>
            <p>Ingresa a la app con esta contraseña. Te recomendamos cambiarla desde tu perfil.</p>
            <p style="color:#999;font-size:12px;">Si no solicitaste esto, ignora este mensaje.</p>
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
            <p style="color:#999;font-size:12px;text-align:center;">ZAS Mototaxi · soporte@zasapps.com</p>
          </div>
        `,
      }),
    });

    res.json({ ok: true, mensaje: 'Te enviamos una contraseña temporal a tu correo.' });

  } catch (err) {
    res.status(500).json({ ok: false, error: 'Error interno. Intenta de nuevo.' });
  }
});
module.exports = router;