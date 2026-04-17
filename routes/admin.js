const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { enviarRecuperacionPassword } = require('../mailer');

const codigos = {};

router.post('/login', (req, res) => {
  const { usuario, password } = req.body;
  const ADMIN_USER = process.env.ADMIN_USER;
  const ADMIN_PASS = process.env.ADMIN_PASS;
  const JWT_SECRET = process.env.JWT_SECRET;

  if (!ADMIN_USER || !ADMIN_PASS || !JWT_SECRET) {
    return res.status(500).json({ ok: false, error: 'Servidor mal configurado' });
  }

  if (usuario !== ADMIN_USER || password !== ADMIN_PASS) {
    return res.status(401).json({ ok: false, error: 'Credenciales incorrectas' });
  }

  const token = jwt.sign({ rol: 'admin', usuario }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ ok: true, token });
});
// ─────────────────────────────────────────────
// Solicitar código de recuperación admin
// ─────────────────────────────────────────────
router.post('/solicitar-reset', async (req, res) => {
  const { correo } = req.body;

  if (correo !== 'soporte@zasapps.com') {
    return res.status(400).json({ ok: false, error: 'Correo no autorizado' });
  }

  const codigo = Math.floor(100000 + Math.random() * 900000).toString();
  const expira = Date.now() + 15 * 60 * 1000; // 15 minutos
  codigos['admin'] = { codigo, expira };

  try {
    await enviarRecuperacionPassword('soporte@zasapps.com', 'Admin ZAS', codigo);
    res.json({ ok: true, mensaje: 'Código enviado al correo de ZAS' });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Error al enviar el correo' });
  }
});

// ─────────────────────────────────────────────
// Confirmar código y cambiar contraseña admin
// ─────────────────────────────────────────────
router.post('/confirmar-reset', (req, res) => {
  const { codigo, nueva_password } = req.body;

  if (!codigos['admin']) {
    return res.status(400).json({ ok: false, error: 'No hay ningún código activo. Solicita uno nuevo.' });
  }

  if (Date.now() > codigos['admin'].expira) {
    delete codigos['admin'];
    return res.status(400).json({ ok: false, error: 'El código expiró. Solicita uno nuevo.' });
  }

  if (codigos['admin'].codigo !== codigo) {
    return res.status(400).json({ ok: false, error: 'Código incorrecto' });
  }

  delete codigos['admin'];
  res.json({ ok: true, nueva_password, mensaje: 'Código correcto. Actualiza ADMIN_PASS en Railway con esta contraseña.' });
});
module.exports = router;