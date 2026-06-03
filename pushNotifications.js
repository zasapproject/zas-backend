const supabase = require('./supabase');

async function enviarPush(token, titulo, mensaje, data = {}) {
  if (!token) return;
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: token, title: titulo, body: mensaje, sound: 'default', data }),
    });
  } catch {}
}

// ─────────────────────────────────────────────
// NOTIFICAR USUARIO (por viaje — push simple)
// ─────────────────────────────────────────────
async function notificarUsuario(usuarioId, titulo, mensaje, data = {}) {
  try {
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('push_token')
      .eq('id', usuarioId)
      .single();
    if (usuario?.push_token) {
      await enviarPush(usuario.push_token, titulo, mensaje, data);
    }
  } catch (err) {
    console.error('Error notificarUsuario:', err.message);
  }
}

// ─────────────────────────────────────────────
// NOTIFICAR CONDUCTOR (por viaje — push simple)
// ─────────────────────────────────────────────
async function notificarConductor(conductorId, titulo, mensaje, data = {}) {
  try {
    const { data: conductor } = await supabase
      .from('conductores')
      .select('push_token')
      .eq('id', conductorId)
      .single();
    if (conductor?.push_token) {
      await enviarPush(conductor.push_token, titulo, mensaje, data);
    }
  } catch (err) {
    console.error('Error notificarConductor:', err.message);
  }
}

async function notificarConductoresCercanos(origenLat, origenLng, titulo, mensaje) {
  try {
    const { data } = await supabase.from('conductores').select('id, push_token, latitud, longitud, suscripcion_hasta');
    if (!data) return;
    const ahora = new Date();
    data.forEach(c => {
      if (!c.push_token || !c.suscripcion_hasta || new Date(c.suscripcion_hasta) <= ahora) return;
      if (c.latitud && c.longitud && origenLat && origenLng) {
        const dLat = (c.latitud - origenLat) * Math.PI / 180;
        const dLng = (c.longitud - origenLng) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(origenLat * Math.PI / 180) * Math.cos(c.latitud * Math.PI / 180) *
          Math.sin(dLng/2) * Math.sin(dLng/2);
        const distancia = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        if (distancia > 5) return;
      }
      enviarPush(c.push_token, titulo, mensaje);
    });
  } catch {}
}

module.exports = { enviarPush, notificarUsuario, notificarConductor, notificarConductoresCercanos };