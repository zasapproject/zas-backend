const supabase = require('./supabase');

async function enviarPush(pushToken, titulo, mensaje, data = {}) {
  if (!pushToken) return;
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: pushToken, title: titulo, body: mensaje, sound: 'default', data }),
    });
  } catch (err) {
    console.error('Error push:', err.message);
  }
}

async function enviarEmail(email, nombre, asunto, htmlContent) {
  if (!email) return;
  try {
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'ZAS Mototaxi', email: 'pagos@zasapps.com' },
        to: [{ email, name: nombre }],
        subject: asunto,
        htmlContent,
      }),
    });
  } catch (err) {
    console.error('Error email:', err.message);
  }
}

async function notificarUsuario(usuarioId, titulo, mensaje, data = {}) {
  try {
    const { data: usuario } = await supabase
      .from('usuarios').select('push_token').eq('id', usuarioId).single();
    if (usuario?.push_token) await enviarPush(usuario.push_token, titulo, mensaje, data);
  } catch (err) {
    console.error('Error notificarUsuario:', err.message);
  }
}

async function notificarConductor(conductorId, titulo, mensaje, data = {}) {
  try {
    const { data: conductor } = await supabase
      .from('conductores').select('push_token').eq('id', conductorId).single();
    if (conductor?.push_token) await enviarPush(conductor.push_token, titulo, mensaje, data);
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
        const a = Math.sin(dLat/2) ** 2 + Math.cos(origenLat * Math.PI / 180) * Math.cos(c.latitud * Math.PI / 180) * Math.sin(dLng/2) ** 2;
        const distancia = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        if (distancia > 5) return;
      }
      enviarPush(c.push_token, titulo, mensaje);
    });
  } catch {}
}

async function notificarPagoAprobado(usuarioId, monto) {
  try {
    const { data: usuario } = await supabase
      .from('usuarios').select('nombre, email, push_token').eq('id', usuarioId).single();
    if (!usuario) return;
    await enviarPush(usuario.push_token, '✅ Pago confirmado', `Tu pago de $${monto} fue verificado y aprobado por ZAS.`);
    await enviarEmail(usuario.email, usuario.nombre, '✅ Pago aprobado — ZAS Mototaxi',
      `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;">
        <h2>Hola ${usuario.nombre} 👋</h2>
        <p>Tu pago de <strong>$${monto}</strong> fue verificado y aprobado.</p>
        <p>Gracias por usar ZAS Mototaxi.</p>
      </div>`);
  } catch (err) { console.error('Error notificarPagoAprobado:', err.message); }
}

async function notificarPagoRechazado(usuarioId, monto, motivo) {
  try {
    const { data: usuario } = await supabase
      .from('usuarios').select('nombre, email, push_token, telefono').eq('id', usuarioId).single();
    if (!usuario) return;
    await enviarPush(usuario.push_token, '❌ Pago rechazado', `Tu comprobante de $${monto} fue rechazado.`);
    await enviarEmail(usuario.email, usuario.nombre, '❌ Pago rechazado — ZAS Mototaxi',
      `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;">
        <h2>Hola ${usuario.nombre} 👋</h2>
        <p>Tu comprobante de $${monto} fue rechazado.</p>
        <p><strong>Motivo:</strong> ${motivo || 'Comprobante no válido'}</p>
      </div>`);
  } catch (err) { console.error('Error notificarPagoRechazado:', err.message); }
}

async function notificarRetiroAprobado(conductorId, monto, metodo) {
  try {
    const { data: conductor } = await supabase
      .from('conductores').select('nombre, email, push_token').eq('id', conductorId).single();
    if (!conductor) return;
    const metodoTexto = metodo === 'pago_movil' ? 'Pago Móvil' : metodo === 'zelle' ? 'Zelle' : 'USDT';
    await enviarPush(conductor.push_token, '✅ Retiro procesado', `Tu retiro de $${monto} por ${metodoTexto} fue enviado.`);
  } catch (err) { console.error('Error notificarRetiroAprobado:', err.message); }
}

async function notificarRetiroRechazado(conductorId, monto, motivo) {
  try {
    const { data: conductor } = await supabase
      .from('conductores').select('nombre, email, push_token').eq('id', conductorId).single();
    if (!conductor) return;
    await enviarPush(conductor.push_token, '❌ Retiro rechazado', `Tu retiro de $${monto} fue rechazado. Saldo devuelto.`);
  } catch (err) { console.error('Error notificarRetiroRechazado:', err.message); }
}

module.exports = {
  enviarPush,
  notificarUsuario,
  notificarConductor,
  notificarConductoresCercanos,
  notificarPagoAprobado,
  notificarPagoRechazado,
  notificarRetiroAprobado,
  notificarRetiroRechazado,
};