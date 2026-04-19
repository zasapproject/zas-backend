if (!process.env.BREVO_API_KEY) {
  console.error('❌ Falta BREVO_API_KEY en .env');
}
async function enviarEmailBrevo({ para, asunto, html }) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: { name: 'ZAS Mototaxi', email: 'soporte@zasapps.com' },
      to: [{ email: para }],
      subject: asunto,
      htmlContent: html,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Error enviando email con Brevo');
  }
}

async function emailConductorAprobado(nombre, email) {
  await enviarEmailBrevo({
    para: email,
    asunto: '¡Tu cuenta ZAS fue aprobada!',
    html: `
      <h2>¡Bienvenido a ZAS, ${nombre}!</h2>
      <p>Tu cuenta de conductor ha sido aprobada. Ya puedes iniciar sesión y comenzar a recibir viajes.</p>
      <p>Descarga la app y empieza a generar ingresos hoy.</p>
      <br>
      <p>Equipo ZAS Mototaxi</p>
    `,
  });
}

async function enviarRecuperacionPassword(email, nombre, codigo) {
  await enviarEmailBrevo({
    para: email,
    asunto: 'Código de recuperación ZAS Mototaxi',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <h2 style="color:#f5a623;">⚡ ZAS Mototaxi</h2>
        <p>Hola <strong>${nombre}</strong>,</p>
        <p>Recibimos una solicitud para restablecer tu contraseña. Usa este código:</p>
        <div style="text-align:center;margin:32px 0;">
          <span style="font-size:40px;font-weight:bold;letter-spacing:12px;color:#1a1a2e;">${codigo}</span>
        </div>
        <p style="color:#888;">Este código expira en <strong>15 minutos</strong>.</p>
        <p style="color:#888;">Si no solicitaste esto, ignora este mensaje.</p>
        <br>
        <p>Equipo ZAS Mototaxi</p>
      </div>
    `,
  });
}

async function emailRecuperarContrasena(nombre, email, token) {
  const link = `https://zasapps.com/resetear?token=${token}`;
  await enviarEmailBrevo({
    para: email,
    asunto: 'Recupera tu contraseña ZAS',
    html: `
      <h2>Hola ${nombre},</h2>
      <p>Recibimos una solicitud para restablecer tu contraseña.</p>
      <p><a href="${link}" style="background:#f5a623;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;">Restablecer contraseña</a></p>
      <p>Este enlace expira en 1 hora. Si no solicitaste esto, ignora este mensaje.</p>
      <br>
      <p>Equipo ZAS Mototaxi</p>
    `,
  });
}

async function emailSoporte(nombre, emailUsuario, mensaje) {
  await enviarEmailBrevo({
    para: 'soporte@zasapps.com',
    asunto: `Soporte ZAS — ${nombre}`,
    html: `
      <h2>Nuevo mensaje de soporte</h2>
      <p><strong>De:</strong> ${nombre} (${emailUsuario})</p>
      <p><strong>Mensaje:</strong></p>
      <p>${mensaje}</p>
    `,
  });
}

module.exports = { 
  emailConductorAprobado, 
  emailRecuperarContrasena, 
  enviarRecuperacionPassword,
  emailSoporte 
};