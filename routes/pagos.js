const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { notificarPagoAprobado, notificarPagoRechazado } = require('../notificaciones');

// ─────────────────────────────────────────────
// MÉTODOS DE PAGO VÁLIDOS
// efectivo → directo conductor (ZAS no toca)
// los demás → pasan por ZAS
// ─────────────────────────────────────────────
const METODOS_VALIDOS = [
  'efectivo',
  'pago_movil',
  'zelle',
  'usdt',
];

const METODOS_DIGITALES = ['pago_movil', 'zelle', 'usdt'];

// ─────────────────────────────────────────────
// Datos de ZAS para mostrar al usuario al pagar
// (actualizar con los datos reales de ZAS)
// ─────────────────────────────────────────────
const DATOS_PAGO_ZAS = {
  pago_movil: {
    banco: 'Banco de Venezuela',
    telefono: '0414-7224623',
    cedula: 'V-17677795',
    nombre: 'Rosmaire Vivas',
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

    // Si es digital → devolver datos de pago de ZAS
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
router.patch('/confirmar/:id', async (req, res) => {
  try {
    const { data: pago, error: pagoError } = await supabase
      .from('pagos')
      .select('*, viajes(conductor_id, usuario_id)')
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
router.patch('/rechazar/:id', async (req, res) => {
  const { motivo } = req.body;
  try {
    const { data, error } = await supabase
      .from('pagos')
      .update({
        estado: 'rechazado',
        motivo_rechazo: motivo || 'Comprobante no válido',
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ ok: false, error: 'Pago no encontrado' });

    // Notificar al usuario del rechazo
    const { data: pagoCompleto } = await supabase
      .from('pagos')
      .select('*, viajes(usuario_id)')
      .eq('id', req.params.id)
      .single();
    if (pagoCompleto?.viajes?.usuario_id) {
      await notificarPagoRechazado(pagoCompleto.viajes.usuario_id, pagoCompleto.monto, motivo);
    }
    res.json({ ok: true, pago: data });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET /api/pagos/en-revision
// Admin ve todos los pagos con comprobante esperando confirmación
// ─────────────────────────────────────────────
router.get('/en-revision', async (req, res) => {
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
router.get('/', async (req, res) => {
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