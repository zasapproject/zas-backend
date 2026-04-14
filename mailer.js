const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

async function enviarEmail({ para, asunto, html }) {
  await transporter.sendMail({
    from: `"ZAS Mototaxi" <${process.env.GMAIL_USER}>`,
    to: para,
    subject: asunto,
    html,
  });
}

// Email: conductor aprobado
async function emailConductorAprobado(nombre, email) {
  await enviarEmail({
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

// Email: recuperación de contraseña
async function emailRecuperarContrasena(nombre, email, token) {
  const link = `https://zasapps.com/resetear?token=${token}`;
  await enviarEmail({
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

// Email: soporte
async function emailSoporte(nombre, emailUsuario, mensaje) {
  await enviarEmail({
    para: process.env.GMAIL_USER,
    asunto: `Soporte ZAS — ${nombre}`,
    html: `
      <h2>Nuevo mensaje de soporte</h2>
      <p><strong>De:</strong> ${nombre} (${emailUsuario})</p>
      <p><strong>Mensaje:</strong></p>
      <p>${mensaje}</p>
    `,
  });
}

module.exports = { emailConductorAprobado, emailRecuperarContrasena, emailSoporte };