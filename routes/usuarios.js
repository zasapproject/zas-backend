const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const supabase = require('../supabase');

// ─────────────────────────────────────────────
// Rate limiting — máximo 5 intentos de login
// por IP cada 15 minutos
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
// Registrar nuevo usuario
// ─────────────────────────────────────────────
router.post('/registro', registroLimiter, async (req, res) => {
  const { nombre, telefono, email, password, foto, foto_url, foto_cedula } = req.body;

  // Validaciones
  if (!nombre || !telefono || !password) {
    return res.status(400).json({ ok: false, error: 'Nombre, teléfono y contraseña son obligatorios' });
  }
  if (password.length < 4) {
    return res.status(400).json({ ok: false, error: 'La contraseña debe tener mínimo 4 caracteres' });
  }
  if (!/^[0-9]{10,11}$/.test(telefono)) {
    return res.status(400).json({ ok: false, error: 'Formato de teléfono inválido' });
  }

  const fotoFinal = foto || foto_url || null;

  try {
    // Verificar si ya existe
    const { data: existe } = await supabase
      .from('usuarios')
      .select('id')
      .eq('telefono', telefono)
      .single();

    if (existe) {
      return res.status(400).json({ ok: false, error: 'Ya existe una cuenta con ese teléfono' });
    }

    // Encriptar contraseña
    const passwordHash = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from('usuarios')
      .insert([{
        nombre,
        telefono,
        email: email || null,
        password: passwordHash,
        foto_url: fotoFinal,
        foto_cedula: foto_cedula || null,
      }])
      .select();

    if (error) throw error;

    // No devolver el password hash al cliente
    const { password: _, ...usuarioSeguro } = data[0];
    res.json({ ok: true, usuario: usuarioSeguro });

  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// Login con teléfono y contraseña
// ─────────────────────────────────────────────
router.post('/login', loginLimiter, async (req, res) => {
  const { telefono, password } = req.body;

  if (!telefono || !password) {
    return res.status(400).json({ ok: false, error: 'Teléfono y contraseña son obligatorios' });
  }

  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('telefono', telefono)
      .single();

    if (error || !data) {
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    }

    // Comparar contraseña — soporta tanto hash como texto plano (migración gradual)
    let passwordValida = false;
    if (data.password.startsWith('$2')) {
      // Ya está hasheada con bcrypt
      passwordValida = await bcrypt.compare(password, data.password);
    } else {
      // Contraseña en texto plano (usuarios viejos) — migrar al vuelo
      passwordValida = data.password === password;
      if (passwordValida) {
        // Migrar a bcrypt automáticamente
        const nuevoHash = await bcrypt.hash(password, 10);
        await supabase.from('usuarios').update({ password: nuevoHash }).eq('id', data.id);
      }
    }

    if (!passwordValida) {
      return res.status(401).json({ ok: false, error: 'Contraseña incorrecta' });
    }

    // No devolver el password hash al cliente
    const { password: _, ...usuarioSeguro } = data;
    res.json({ ok: true, usuario: usuarioSeguro });

  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// Buscar usuario por teléfono
// ─────────────────────────────────────────────
router.get('/buscar/:telefono', async (req, res) => {
  const { telefono } = req.params;
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nombre, telefono, email, foto_url, foto_cedula, created_at')
      .eq('telefono', telefono)
      .single();

    if (error) throw error;
    res.json({ ok: true, usuario: data });
  } catch (error) {
    res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
  }
});

// ─────────────────────────────────────────────
// Subir documento del usuario
// ─────────────────────────────────────────────
router.patch('/documentos/:id', async (req, res) => {
  const { foto_cedula } = req.body;
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .update({ foto_cedula })
      .eq('id', req.params.id)
      .select('id, nombre, telefono, foto_cedula');

    if (error) throw error;
    res.json({ ok: true, usuario: data[0] });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// Obtener todos los usuarios
// ─────────────────────────────────────────────
router.get('/todos', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nombre, telefono, email, foto_url, foto_cedula, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ ok: true, usuarios: data, total: data.length });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// Editar perfil usuario
// ─────────────────────────────────────────────
router.patch('/perfil/:id', async (req, res) => {
  const { telefono, email, foto_url } = req.body;
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .update({ telefono, email: email || null, foto_url })
      .eq('id', req.params.id)
      .select('id, nombre, telefono, email, foto_url');

    if (error) throw error;
    res.json({ ok: true, usuario: data[0] });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// Reset password usuario
// ─────────────────────────────────────────────
router.patch('/reset-password/:id', async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 4) {
    return res.status(400).json({ ok: false, error: 'Contraseña muy corta' });
  }
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const { data, error } = await supabase
      .from('usuarios')
      .update({ password: passwordHash })
      .eq('id', req.params.id)
      .select('id, nombre, telefono');

    if (error) throw error;
    res.json({ ok: true, usuario: data[0] });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});
// ─────────────────────────────────────────────
// Guardar push token usuario
// ─────────────────────────────────────────────
router.patch('/push-token/:id', async (req, res) => {
  const { push_token } = req.body;
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .update({ push_token })
      .eq('id', req.params.id)
      .select('id, nombre, push_token');

    if (error) throw error;
    res.json({ ok: true, usuario: data[0] });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});
module.exports = router;