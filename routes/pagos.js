const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const authAdmin = require('../middleware/authAdmin');
const { notificarPagoAprobado, notificarPagoRechazado } = require('../notificaciones');
const { registrarHistorial } = require('../utils/historialPagos');

// ─────────────────────────────────────────────
// MÉTODOS DE PAGO VÁLIDOS
// efectivo → directo conductor (ZAS no toca)
// los demás → pasan por ZAS
// ─────────────────────────────────────────────
const METODOS_VALIDOS = [
  'efectivo',
  'pago_movil',
  'zelle',
  'transferencia',
  'usdt',
  'bancolombia',
  'nequi',
];

const METODOS_DIGITALES = ['pago_movil', 'zelle', 'transferencia', 'usdt', 'bancolombia', 'nequi'];

// ─────────────────────────────────────────────
// Datos de ZAS para mostrar al usuario al pagar
// (actualizar con los datos reales de ZAS)
// ─────────────────────────────────────────────
const DATOS_PAGO_ZAS = {
  pago_movil: {
    banco: 'Banco de Venezuela',
    telefono: '0416-4466496',
    cedula: 'V-17056204',
    nombre: 'Jhonatan Rincon',
  },
  zelle: {
    email: 'jrchinchilla82@gmail.com',
    nombre: 'Jhonatan Rincon',
  },

  usdt: {
    red: 'TRC20 (Tron)',
    wallet: 'TCQou8bEo2jwsvtaoRLFkA4FPWQrZXVsTt',
    nota: 'Solo enviar USDT por red TRC20',
  },
  bancolombia: {
    banco: 'Bancolombia',
    tipo_cuenta: 'Ahorros',
    numero_cuenta: '08810657384',
    nombre: 'Jhonatan Rincon',
    cedula: '1232391490',
    nota: 'Transferencia o deposito a cuenta de ahorros Bancolombia',
  },
  nequi: {
    telefono: '3113003100',
    nombre: 'Jhonatan Rincon',
    nota: 'Enviar pago por Nequi al numero registrado',
  },
};

// ─────────────────────────────────────────────
// Notificación a ZAS vía email (Brevo)
// Se llama cuando un usuario sube un comprobante
// ─────────────────────────────────────────────
async function notificarZAS({ pago, viaje, comprobante_url }) {
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'ZAS Sistema', email: 'no-reply@zasapps.com' },
        to: [{ email: process.env.EMAIL_ADMIN_ZAS || 'admin@zasapps.com' }],
        subject: `⚡ Pago digital recibido — ${pago.metodo.toUpperCase()} $${pago.monto}`,
        htmlContent: `
          <h2>Nuevo pago digital en ZAS</h2>
          <table style="border-collapse:collapse; width:100%;">
            <tr><td><b>Método</b></td><td>${pago.metodo}</td></tr>
            <tr><td><b>Monto</b></td><td>$${pago.monto}</td></tr>
            <tr><td><b>Viaje ID</b></td><td>${pago.viaje_id}</td></tr>
            <tr><td><b>Usuario ID</b></td><td>${viaje?.usuario_id || 'N/A'}</td></tr>
            <tr><td><b>Conductor ID</b></td><td>${viaje?.conductor_id || 'N/A'}</td></tr>
            <tr><td><b>Hora</b></td><td>${new Date().toLocaleString('es-VE')}</td></tr>
          </table>
          ${comprobante_url ? `<br><p><b>Comprobante:</b></p><img src="${comprobante_url}" style="max-width:400px;" />` : ''}
          <br>
          <p>
            <a href="${process.env.ADMIN_URL || 'https://zasapps.com/admin'}/pagos/${pago.id}" 
               style="background:#000;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;">
              ✅ Confirmar pago en el admin
            </a>
          </p>
        `,
      }),
    });

    if (!res.ok) {
      console.error('Error enviando email ZAS:', await res.text());
    }
  } catch (err) {
    console.error('Error notificación ZAS:', err.message);
  }
}

// ─────────────────────────────────────────────
// GET /api/pagos/datos-pago/:metodo
// Devuelve los datos de ZAS para que el usuario sepa a dónde transferir
// ─────────────────────────────────────────────
router.get('/datos-pago/:metodo', (req, res) => {
  const metodo = req.params.metodo;
  if (!METODOS_DIGITALES.includes(metodo)) {
    return res.status(400).json({ ok: false, error: 'Método no válido para pago digital' });
  }
  res.json({ ok: true, metodo, datos: DATOS_PAGO_ZAS[metodo] });
});

// ─────────────────────────────────────────────
// POST /api/pagos/nuevo
// Crea el registro de pago al inicio del viaje
// ─────────────────────────────────────────────
router.post('/nuevo', async (req, res) => {
  const token = req.headers['x-session-token'];
  if (!token) console.warn('[WARN] POST /pagos/nuevo sin x-session-token — ip:', req.ip);

  const { viaje_id, monto, metodo } = req.body;

  if (!viaje_id || !monto || !metodo) {
    return res.status(400).json({ ok: false, error: 'viaje_id, monto y metodo son obligatorios' });
  }
  if (isNaN(monto) || monto <= 0) {
    return res.status(400).json({ ok: false, error: 'El monto debe ser mayor a 0' });
  }
  if (!METODOS_VALIDOS.includes(metodo)) {
    return res.status(400).json({ ok: false, error: `Método inválido. Válidos: ${METODOS_VALIDOS.join(', ')}` });
  }

  try {
    const { data: viaje, error: viajeError } = await supabase
      .from('viajes')
      .select('id, estado, usuario_id, conductor_id')
      .eq('id', viaje_id)
      .single();

    if (viajeError || !viaje) {
      return res.status(404).json({ ok: false, error: 'Viaje no encontrado' });
    }

    // Si es efectivo → se marca directamente como completado (conductor cobra directo)
    const estado_inicial = metodo === 'efectivo' ? 'completado' : 'pendiente';

    const { data, error } = await supabase
      .from('pagos')
      .insert([{
        viaje_id,
        monto,
        metodo,
        estado: estado_inicial,
        es_digital: METODOS_DIGITALES.includes(metodo),
        completado_en: metodo === 'efectivo' ? new Date().toISOString() : null,
      }])
      .select()
      .single();

    if (error) throw error;

    // Si es efectivo → acreditar saldo al conductor directamente
    if (metodo === 'efectivo' && viaje.conductor_id) {
      const conductor_id = viaje.conductor_id;
      const montoNum = parseFloat(monto);
      const { data: saldoActual } = await supabase
        .from('saldo_conductores')
        .select('*')
        .eq('conductor_id', conductor_id)
        .single();
      if (saldoActual) {
        await supabase
          .from('saldo_conductores')
          .update({
            saldo_disponible: parseFloat(saldoActual.saldo_disponible) + montoNum,
            total_ganado: parseFloat(saldoActual.total_ganado) + montoNum,
            ultima_actualizacion: new Date().toISOString(),
          })
          .eq('conductor_id', conductor_id);
      } else {
        await supabase
          .from('saldo_conductores')
          .insert({
            conductor_id,
            saldo_disponible: montoNum,
            saldo_retenido: 0,
            total_ganado: montoNum,
            ultima_actualizacion: new Date().toISOString(),
          });
      }
    }

    // Si es digital → devolver datos de pago de ZAS
    const respuesta = { ok: true, pago: data };
    if (METODOS_DIGITALES.includes(metodo)) {
      respuesta.datos_pago_zas = DATOS_PAGO_ZAS[metodo];
      respuesta.instruccion = `Transfiere $${monto} a ZAS y sube el comprobante para confirmar.`;
    }

    res.json(respuesta);
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// POST /api/pagos/subir-comprobante/:id
// Usuario sube foto del comprobante después de pagar
// Dispara notificación automática a ZAS
// ─────────────────────────────────────────────
router.post('/subir-comprobante/:id', async (req, res) => {
  const { comprobante_url, referencia } = req.body;

  if (!comprobante_url) {
    return res.status(400).json({ ok: false, error: 'comprobante_url es obligatorio' });
  }

  try {
    // Obtener pago con datos del viaje
    const { data: pago, error: pagoError } = await supabase
      .from('pagos')
      .select('*, viajes(usuario_id, conductor_id, origen, destino)')
      .eq('id', req.params.id)
      .single();

    if (pagoError || !pago) {
      return res.status(404).json({ ok: false, error: 'Pago no encontrado' });
    }

    if (pago.estado === 'completado') {
      return res.status(400).json({ ok: false, error: 'Este pago ya fue confirmado' });
    }

    // Actualizar pago con comprobante
    const { data, error } = await supabase
      .from('pagos')
      .update({
        comprobante_url,
        referencia_pago: referencia || null,
        estado: 'en_revision',
        comprobante_en: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    await registrarHistorial({
      tipo_pago: 'viaje',
      referencia_id: data.id,
      conductor_id: pago.viajes?.conductor_id,
      usuario_id: pago.viajes?.usuario_id,
      monto: pago.monto,
      metodo: pago.metodo,
      accion: 'comprobante_subido',
      estado_resultante: 'en_revision',
      comprobante_url,
      admin_nombre: 'sistema',
    });

    // Notificar a ZAS automáticamente
    await notificarZAS({
      pago: { ...data, metodo: pago.metodo, monto: pago.monto },
      viaje: pago.viajes,
      comprobante_url,
    });

    res.json({
      ok: true,
      pago: data,
      mensaje: 'Comprobante recibido. ZAS lo revisará en breve y acreditará tu pago.',
    });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// PATCH /api/pagos/confirmar/:id
// Admin de ZAS confirma el pago manualmente
// Acredita saldo al conductor automáticamente
// ─────────────────────────────────────────────
router.patch('/confirmar/:id', authAdmin, async (req, res) => {
  const { admin_nombre } = req.body;
  try {
    const { data: pago, error: pagoError } = await supabase
      .from('pagos')
      .select('*, viajes(conductor_id, usuario_id, usuarios(nombre, telefono))')
      .eq('id', req.params.id)
      .single();

    if (pagoError || !pago) {
      return res.status(404).json({ ok: false, error: 'Pago no encontrado' });
    }

    // Marcar pago como completado
    const { data, error } = await supabase
      .from('pagos')
      .update({ estado: 'completado', completado_en: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Si es pago digital → acreditar saldo al conductor
    if (pago.es_digital && pago.viajes?.conductor_id) {
      const conductor_id = pago.viajes.conductor_id;
      const monto = parseFloat(pago.monto);

      // Calcular desglose
      const COMISION_ZAS = 0; // ZAS cobra suscripción fija, no % por viaje
      const monto_conductor = monto - COMISION_ZAS;

      // Buscar saldo actual del conductor
      const { data: saldoActual } = await supabase
        .from('saldo_conductores')
        .select('*')
        .eq('conductor_id', conductor_id)
        .single();

      if (saldoActual) {
        // Actualizar saldo existente
        await supabase
          .from('saldo_conductores')
          .update({
            saldo_disponible: parseFloat(saldoActual.saldo_disponible) + monto_conductor,
            total_ganado: parseFloat(saldoActual.total_ganado) + monto_conductor,
            ultima_actualizacion: new Date().toISOString(),
          })
          .eq('conductor_id', conductor_id);
      } else {
        // Crear registro de saldo nuevo
        await supabase
          .from('saldo_conductores')
          .insert({
            conductor_id,
            saldo_disponible: monto_conductor,
            saldo_retenido: 0,
            total_ganado: monto_conductor,
            ultima_actualizacion: new Date().toISOString(),
          });
      }
    }

    await registrarHistorial({
      tipo_pago: 'viaje',
      referencia_id: pago.id,
      conductor_id: pago.viajes?.conductor_id,
      usuario_id: pago.viajes?.usuario_id,
      nombre_persona: pago.viajes?.usuarios?.nombre,
      telefono_persona: pago.viajes?.usuarios?.telefono,
      monto: pago.monto,
      metodo: pago.metodo,
      accion: 'confirmado',
      estado_resultante: 'completado',
      comprobante_url: pago.comprobante_url,
      admin_nombre: admin_nombre || 'sistema',
    });

    // Notificar al usuario
    if (pago.viajes?.usuario_id) {
      await notificarPagoAprobado(pago.viajes.usuario_id, pago.monto);
    }
    res.json({ ok: true, pago: data, mensaje: 'Pago confirmado y saldo acreditado al conductor.' });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// PATCH /api/pagos/rechazar/:id
// Admin rechaza un comprobante inválido
// ─────────────────────────────────────────────
router.patch('/rechazar/:id', authAdmin, async (req, res) => {
  const { motivo, admin_nombre } = req.body;
  if (!motivo || motivo.trim() === '') {
    return res.status(400).json({ ok: false, error: 'El motivo del rechazo es obligatorio' });
  }
  try {
    // Obtener pago completo con datos del viaje y usuario
    const { data: pagoCompleto, error: pagoError } = await supabase
      .from('pagos')
      .select('*, viajes(usuario_id, conductor_id, usuarios(nombre, telefono))')
      .eq('id', req.params.id)
      .single();

    if (pagoError || !pagoCompleto) {
      return res.status(404).json({ ok: false, error: 'Pago no encontrado' });
    }

    const intentoActual = pagoCompleto.intento || 1;

    // Actualizar pago — limpiar comprobante para permitir reintento
    const { data, error } = await supabase
      .from('pagos')
      .update({
        estado: 'rechazado',
        motivo_rechazo: motivo.trim(),
        comprobante_url: null,
        comprobante_en: null,
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ ok: false, error: 'Pago no encontrado' });

    // Si agotó 3 intentos → crear ticket de soporte automático
    if (intentoActual >= 3 && pagoCompleto.viajes?.usuario_id) {
      await supabase.from('soporte').insert({
        usuario_id: pagoCompleto.viajes.usuario_id,
        mensaje: `Pago rechazado 3 veces. Último motivo: ${motivo.trim()}. Pago ID: ${pagoCompleto.id}`,
        estado: 'pendiente',
      });
    }

    // Notificar al usuario (función existente)
    if (pagoCompleto.viajes?.usuario_id) {
      const mensajePush = intentoActual >= 3
        ? 'Tu comprobante fue rechazado 3 veces. Contacta a soporte ZAS.'
        : `Comprobante rechazado: ${motivo.trim()}. Puedes subir uno nuevo en tu historial.`;
      await notificarPagoRechazado(
        pagoCompleto.viajes.usuario_id,
        pagoCompleto.monto,
        mensajePush
      );
    }

    // Registrar en historial (función existente)
    await registrarHistorial({
      tipo_pago: 'viaje',
      referencia_id: pagoCompleto.id,
      viaje_id: pagoCompleto.viaje_id,
      conductor_id: pagoCompleto.viajes?.conductor_id || null,
      usuario_id: pagoCompleto.viajes?.usuario_id || null,
      nombre_persona: pagoCompleto.viajes?.usuarios?.nombre || null,
      monto: pagoCompleto.monto,
      metodo: pagoCompleto.metodo,
      accion: 'rechazado',
      estado_resultante: 'rechazado',
      admin_nombre: admin_nombre || 'Admin',
      notas: motivo.trim(),
    });

    res.json({
      ok: true,
      pago: data,
      intentos_usados: intentoActual,
      puede_reintentar: intentoActual < 3,
      mensaje: intentoActual >= 3
        ? 'Comprobante rechazado. Se creó ticket de soporte automáticamente.'
        : `Comprobante rechazado. El usuario puede reintentar (${intentoActual}/3 intentos usados).`,
    });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// POST /api/pagos/reintentar/:id
// Usuario solicita nuevo intento tras rechazo — máximo 3
// ─────────────────────────────────────────────
router.post('/reintentar/:id', async (req, res) => {
  try {
    const { data: pagoOriginal, error: pagoError } = await supabase
      .from('pagos')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (pagoError || !pagoOriginal) {
      return res.status(404).json({ ok: false, error: 'Pago no encontrado' });
    }

    if (pagoOriginal.estado !== 'rechazado') {
      return res.status(400).json({ ok: false, error: 'Solo se puede reintentar un pago rechazado' });
    }

    const intentoActual = pagoOriginal.intento || 1;

    if (intentoActual >= 3) {
      return res.status(400).json({
        ok: false,
        error: 'Has agotado los 3 intentos permitidos. Contacta a soporte ZAS.',
        agotar_intentos: true,
      });
    }

    // Crear nuevo pago con intento + 1
    const { data: nuevoPago, error: nuevoError } = await supabase
      .from('pagos')
      .insert({
        viaje_id: pagoOriginal.viaje_id,
        monto: pagoOriginal.monto,
        metodo: pagoOriginal.metodo,
        estado: 'pendiente',
        es_digital: pagoOriginal.es_digital,
        intento: intentoActual + 1,
        pago_original_id: pagoOriginal.pago_original_id || pagoOriginal.id,
      })
      .select()
      .single();

    if (nuevoError) throw nuevoError;

    res.json({
      ok: true,
      pago: nuevoPago,
      datos_pago_zas: DATOS_PAGO_ZAS[pagoOriginal.metodo] || null,
      intento: intentoActual + 1,
      intentos_restantes: 3 - (intentoActual + 1),
      mensaje: `Intento ${intentoActual + 1} de 3. Sube el nuevo comprobante.`,
    });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET /api/pagos/en-revision
// Admin ve todos los pagos con comprobante esperando confirmación
// ─────────────────────────────────────────────
router.get('/en-revision', authAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('pagos')
      .select('*, viajes(origen, destino, usuario_id, conductor_id)')
      .eq('estado', 'en_revision')
      .order('comprobante_en', { ascending: true });

    if (error) throw error;
    res.json({ ok: true, pagos: data, total: data.length });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET /api/pagos/viaje/:viaje_id
// Pagos de un viaje específico
// ─────────────────────────────────────────────
router.get('/viaje/:viaje_id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('pagos')
      .select('*')
      .eq('viaje_id', req.params.viaje_id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ ok: true, pagos: data });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET /api/pagos/
// Dashboard admin — todos los pagos paginados
// ─────────────────────────────────────────────
router.get('/', authAdmin, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const estado = req.query.estado; // filtro opcional

  try {
    let query = supabase
      .from('pagos')
      .select('*, viajes(origen, destino, usuario_id, conductor_id)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (estado) query = query.eq('estado', estado);

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({ ok: true, pagos: data, total: count, page, limit });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

module.exports = router;