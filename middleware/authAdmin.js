const jwt = require('jsonwebtoken');

function authAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'No autorizado' });
  }
  const token = auth.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.rol !== 'admin') return res.status(403).json({ ok: false, error: 'Prohibido' });
    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({ ok: false, error: 'Token inválido o expirado' });
  }
}

module.exports = authAdmin;