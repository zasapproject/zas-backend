const supabase = require('./supabase');

// ─────────────────────────────────────────────
// Enviar push notification via Expo
// ─────────────────────────────────────────────
async function enviarPush(pushToken, titulo, mensaje, data = {}) {
  if (!pushToken) return;
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: pushToken,
        title: titulo,
        body: mensaje,
        data,
        sound: 'default',
      }),
    });
  } catch (err) {
    console.error('Error push:', err.message);
  }
}

// ─────────────────────────────────────────────
// Enviar email via Brevo
// ─────────────────────────────────────────────
async function enviarEmail(email, nombre, asunto, htmlContent) {
  if (!email) return;
  try {
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
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

// ─────────────────────────────────────────────
// PAGO APROBADO → notificar usuario
// ─────────────────────────────────────────────
async function notificarPagoAprobado(usuarioId, monto) {
  try {
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('nombre, email, push_token')
      .eq('id', usuarioId)
      .single();

    if (!usuario) return;

    await enviarPush(
      usuario.push_token,
      '✅ Pago confirmado',
      `Tu pago de $${monto} fue verificado y aprobado por ZAS.`
    );

    await enviarEmail(
      usuario.email,
      usuario.nombre,
      '✅ Pago aprobado — ZAS Mototaxi',
      `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;">
        <h2 style="color:#000">Hola ${usuario.nombre} 👋</h2>
        <p>Tu pago de <strong>$${monto}</strong> fue verificado y aprobado por ZAS Mototaxi.</p>
        <div style="background:#f4f4f4;padding:20px;text-align:center;border-radius:8px;margin:20px 0;">
          <h2 style="color:#000;margin:0">✅ Pago aprobado</h2>
        </div>
        <p>Gracias por usar ZAS Mototaxi.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
        <p style="color:#888;font-size:12px;text-align:center;">ZAS Mototaxi · pagos@zasapps.com</p>
      </div>
      `
    );
  } catch (err) {
    console.error('Error notificarPagoAprobado:', err.message);
  }
}

// ─────────────────────────────────────────────
// PAGO RECHAZADO → notificar usuario
// ─────────────────────────────────────────────
async function notificarPagoRechazado(usuarioId, monto, motivo) {
  try {
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('nombre, email, push_token, telefono')
      .eq('id', usuarioId)
      .single();

    if (!usuario) return;

    await enviarPush(
      usuario.push_token,
      '❌ Pago rechazado',
      `Tu comprobante de $${monto} fue rechazado. Contáctanos para resolverlo.`
    );

    await enviarEmail(
      usuario.email,
      usuario.nombre,
      '❌ Pago rechazado — ZAS Mototaxi',
      `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;">
        <h2 style="color:#000">Hola ${usuario.nombre} 👋</h2>
        <p>Tu comprobante de pago de <strong>$${monto}</strong> fue rechazado.</p>
        <div style="background:#fff3f3;padding:20px;border-radius:8px;margin:20px 0;border-left:4px solid #e53935;">
          <p style="margin:0;color:#e53935;font-weight:bold;">Motivo: ${motivo || 'Comprobante no válido'}</p>
        </div>
        <p>Por favor contáctanos para resolver esta situación:</p>
        <ul>
          <li>📱 WhatsApp: <a href="https://wa.me/58${usuario.telefono}">Escríbenos</a></li>
          <li>📞 Llamada directa al soporte ZAS</li>
        </ul>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
        <p style="color:#888;font-size:12px;text-align:center;">ZAS Mototaxi · pagos@zasapps.com</p>
      </div>
      `
    );
  } catch (err) {
    console.error('Error notificarPagoRechazado:', err.message);
  }
}

// ─────────────────────────────────────────────
// RETIRO APROBADO → notificar conductor
// ─────────────────────────────────────────────
async function notificarRetiroAprobado(conductorId, monto, metodo) {
  try {
    const { data: conductor } = await supabase
      .from('conductores')
      .select('nombre, email, push_token')
      .eq('id', conductorId)
      .single();

    if (!conductor) return;

    const metodoTexto = metodo === 'pago_movil' ? 'Pago Móvil' : metodo === 'zelle' ? 'Zelle' : 'USDT';

    await enviarPush(
      conductor.push_token,
      '✅ Retiro procesado',
      `Tu retiro de $${monto} por ${metodoTexto} fue enviado.`
    );

    await enviarEmail(
      conductor.email,
      conductor.nombre,
      '✅ Retiro aprobado — ZAS Mototaxi',
      `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;">
        <h2 style="color:#000">Hola ${conductor.nombre} 👋</h2>
        <p>Tu solicitud de retiro fue procesada exitosamente.</p>
        <div style="background:#f4f4f4;padding:20px;border-radius:8px;margin:20px 0;">
          <p style="margin:4px 0;"><strong>Monto:</strong> $${monto}</p>
          <p style="margin:4px 0;"><strong>Método:</strong> ${metodoTexto}</p>
          <p style="margin:4px 0;color:#00c853;font-weight:bold;">✅ Enviado</p>
        </div>
        <p>El dinero llegará según los tiempos de tu método de pago.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
        <p style="color:#888;font-size:12px;text-align:center;">ZAS Mototaxi · pagos@zasapps.com</p>
      </div>
      `
    );
  } catch (err) {
    console.error('Error notificarRetiroAprobado:', err.message);
  }
}

// ─────────────────────────────────────────────
// RETIRO RECHAZADO → notificar conductor
// ─────────────────────────────────────────────
async function notificarRetiroRechazado(conductorId, monto, motivo) {
  try {
    const { data: conductor } = await supabase
      .from('conductores')
      .select('nombre, email, push_token, telefono')
      .eq('id', conductorId)
      .single();

    if (!conductor) return;

    await enviarPush(
      conductor.push_token,
      '❌ Retiro rechazado',
      `Tu retiro de $${monto} fue rechazado. El saldo fue devuelto a tu billetera.`
    );

    await enviarEmail(
      conductor.email,
      conductor.nombre,
      '❌ Retiro rechazado — ZAS Mototaxi',
      `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;">
        <h2 style="color:#000">Hola ${conductor.nombre} 👋</h2>
        <p>Tu solicitud de retiro de <strong>$${monto}</strong> fue rechazada.</p>
        <div style="background:#fff3f3;padding:20px;border-radius:8px;margin:20px 0;border-left:4px solid #e53935;">
          <p style="margin:0;color:#e53935;font-weight:bold;">Motivo: ${motivo || 'Rechazado por admin'}</p>
        </div>
        <p>El saldo fue devuelto a tu billetera. Puedes intentar nuevamente.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
        <p style="color:#888;font-size:12px;text-align:center;">ZAS Mototaxi · pagos@zasapps.com</p>
      </div>
      `
    );
  } catch (err) {
    console.error('Error notificarRetiroRechazado:', err.message);
  }
}

module.exports = {
  notificarPagoAprobado,
  notificarPagoRechazado,
  notificarRetiroAprobado,
  notificarRetiroRechazado,
};