const supabase = require('../supabase');

async function authConductor(req, res, next) {
  const token = req.headers['x-session-token'];
  if (!token) return res.status(401).json({ ok: false, error: 'No autorizado' });

  const conductorId = req.params.id || req.body.conductor_id;
  if (!conductorId) return res.status(400).json({ ok: false, error: 'conductor_id requerido' });

  const { data } = await supabase
    .from('conductores')
    .select('id')
    .eq('id', conductorId)
    .eq('session_token', token)
    .single();

  if (!data) return res.status(403).json({ ok: false, error: 'Sesión inválida' });
  next();
}

module.exports = authConductor;
