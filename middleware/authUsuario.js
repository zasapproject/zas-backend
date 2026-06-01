const supabase = require('../supabase');

async function authUsuario(req, res, next) {
  const token = req.headers['x-session-token'];
  if (!token) return res.status(401).json({ ok: false, error: 'No autorizado' });
  const { data } = await supabase
    .from('usuarios')
    .select('id')
    .eq('id', req.params.id)
    .eq('session_token', token)
    .single();
  if (!data) return res.status(403).json({ ok: false, error: 'Sesión inválida' });
  next();
}

module.exports = authUsuario;
