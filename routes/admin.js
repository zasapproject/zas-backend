const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

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

module.exports = router;