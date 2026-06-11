// routes/verificacion.js
// ═══════════════════════════════════════════════════════
// ZAS MOTOTAXI — Verificación de Teléfono con Firebase Phone Auth
// RESPONSABLE: Marcos
// Agregar al server.js:
//   const verificacionRouter = require('./routes/verificacion');
//   app.use('/api/verificacion', verificacionRouter);
// Variable de entorno requerida en Railway:
//   FIREBASE_PROJECT_ID=zas-app-9876e
// ═══════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// ─────────────────────────────────────────────
// Inicializar Firebase Admin SDK
// Reutiliza la Service Account Key ya configurada
// para las notificaciones push (FCM)
// ─────────────────────────────────────────────
let admin;
try {
  admin = require('firebase-admin');
  const apps = admin.apps;
  if (!apps || apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID || 'zas-app-9876e',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
} catch (err) {
  console.error('Firebase Admin error:', err.message);
}

// ─────────────────────────────────────────────
// POST /api/verificacion/confirmar-firebase
// Recibe el ID Token de Firebase después de que
// el usuario ingresó el código SMS correctamente.
// Valida el token y marca telefono_verificado = true.
//
// Body: {
//   firebase_id_token: string,  ← token generado por Firebase en la app
//   tipo: 'usuario' | 'conductor',
//   id: string  ← el ID del usuario o conductor en Supabase
// }
// ─────────────────────────────────────────────
router.post('/confirmar-firebase', async (req, res) => {
  const { firebase_id_token, tipo, id } = req.body;

  if (!firebase_id_token || !tipo || !id) {
    return res.status(400).json({
      ok: false,
      error: 'firebase_id_token, tipo e id son obligatorios',
    });
  }

  if (!['usuario', 'conductor'].includes(tipo)) {
    return res.status(400).json({
      ok: false,
      error: "tipo debe ser 'usuario' o 'conductor'",
    });
  }

  if (!admin) {
    return res.status(500).json({
      ok: false,
      error: 'Firebase Admin no está configurado en el servidor',
    });
  }

  try {
    // Verificar el token con Firebase — si es inválido o expirado lanza excepción
    const decodedToken = await admin.auth().verifyIdToken(firebase_id_token);

    // El token es válido — extraer el número de teléfono verificado
    const telefonoFirebase = decodedToken.phone_number;

    if (!telefonoFirebase) {
      return res.status(400).json({
        ok: false,
        error: 'El token de Firebase no contiene un número de teléfono',
      });
    }

    // Determinar la tabla correcta según el tipo
    const tabla = tipo === 'usuario' ? 'usuarios' : 'conductores';

    // Obtener el registro para verificar que el teléfono coincide
    const { data: registro, error: errorBuscar } = await supabase
      .from(tabla)
      .select('id, telefono, telefono_verificado')
      .eq('id', id)
      .single();

    if (errorBuscar || !registro) {
      return res.status(404).json({
        ok: false,
        error: `${tipo} no encontrado`,
      });
    }

    if (registro.telefono_verificado) {
      return res.json({
        ok: true,
        mensaje: 'El teléfono ya estaba verificado',
        ya_verificado: true,
      });
    }

    // Marcar como verificado en Supabase
    const { error: errorUpdate } = await supabase
      .from(tabla)
      .update({
        telefono_verificado: true,
      })
      .eq('id', id);

    if (errorUpdate) throw errorUpdate;

    res.json({
      ok: true,
      mensaje: 'Teléfono verificado exitosamente',
      telefono: telefonoFirebase,
    });
  } catch (error) {
    // Firebase lanza errores específicos para tokens inválidos
    if (
      error.code === 'auth/id-token-expired' ||
      error.code === 'auth/argument-error' ||
      error.code === 'auth/id-token-revoked'
    ) {
      return res.status(401).json({
        ok: false,
        error: 'Token de Firebase inválido o expirado. Vuelve a verificar tu número.',
      });
    }

    console.error('Error en verificación Firebase:', error.message);
    res.status(500).json({ ok: false, error: 'Error interno al verificar el teléfono' });
  }
});

// ─────────────────────────────────────────────
// GET /api/verificacion/estado/:tipo/:id
// Consulta si el teléfono de un usuario/conductor
// ya está verificado. Útil para la app al hacer login.
// ─────────────────────────────────────────────
router.get('/estado/:tipo/:id', async (req, res) => {
  const { tipo, id } = req.params;

  if (!['usuario', 'conductor'].includes(tipo)) {
    return res.status(400).json({ ok: false, error: "tipo debe ser 'usuario' o 'conductor'" });
  }

  try {
    const tabla = tipo === 'usuario' ? 'usuarios' : 'conductores';

    const { data, error } = await supabase
      .from(tabla)
      .select('id, telefono_verificado')
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ ok: false, error: `${tipo} no encontrado` });
    }

    res.json({
      ok: true,
      telefono_verificado: data.telefono_verificado || false,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = router;
