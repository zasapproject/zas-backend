const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const authAdmin = require('../middleware/authAdmin');

router.get('/pendientes', authAdmin, async (req, res) => {
  try {
    const { data: pagosViaje, error: errorViaje } = await supabase
      .from('pagos')
      .select('id, monto, metodo, comprobante_url, comprobante_en, viajes(conductor_id, usuario_id, usuarios(nombre))')
      .eq('estado', 'en_revision')
      .order('comprobante_en', { ascending: true });

    if (errorViaje) throw errorViaje;

    const { data: pagosSuscripcion, error: errorSuscripcion } = await supabase
      .from('pagos_suscripcion')
      .select('id, monto, metodo_pago, comprobante_url, created_at, conductor_id, conductores(nombre)')
      .eq('estado', 'en_revision')
      .order('created_at', { ascending: true });

    if (errorSuscripcion) throw errorSuscripcion;

    const pendientes = [
      ...(pagosViaje || []).map(p => ({
        id: p.id,
        tipo_pago: 'viaje',
        nombre_persona: p.viajes?.usuarios?.nombre || 'Sin nombre',
        monto: p.monto,
        metodo: p.metodo,
        comprobante_url: p.comprobante_url,
        fecha: p.comprobante_en,
        conductor_id: p.viajes?.conductor_id,
        usuario_id: p.viajes?.usuario_id,
      })),
      ...(pagosSuscripcion || []).map(p => ({
        id: p.id,
        tipo_pago: 'suscripcion',
        nombre_persona: p.conductores?.nombre || 'Sin nombre',
        monto: p.monto,
        metodo: p.metodo_pago,
        comprobante_url: p.comprobante_url,
        fecha: p.created_at,
        conductor_id: p.conductor_id,
        usuario_id: null,
      })),
    ].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    res.json({ ok: true, pendientes, total: pendientes.length });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

router.get('/', authAdmin, async (req, res) => {
  const { tipo_pago, admin_nombre, desde, hasta, page = 1, limit = 30 } = req.query;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  try {
    let query = supabase
      .from('historial_pagos')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (tipo_pago) query = query.eq('tipo_pago', tipo_pago);
    if (admin_nombre) query = query.eq('admin_nombre', admin_nombre);
    if (desde) query = query.gte('created_at', desde);
    if (hasta) query = query.lte('created_at', hasta);

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({ ok: true, historial: data, total: count, page: Number(page), limit: Number(limit) });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

router.get('/exportar', authAdmin, async (req, res) => {
  const { desde, hasta, tipo_pago } = req.query;

  try {
    let query = supabase
      .from('historial_pagos')
      .select('*')
      .order('created_at', { ascending: true });

    if (desde) query = query.gte('created_at', desde);
    if (hasta) query = query.lte('created_at', hasta);
    if (tipo_pago) query = query.eq('tipo_pago', tipo_pago);

    const { data, error } = await query;
    if (error) throw error;

    const columnas = [
      'created_at', 'tipo_pago', 'nombre_persona', 'telefono_persona',
      'monto', 'moneda', 'monto_usd', 'metodo', 'accion',
      'estado_resultante', 'admin_nombre', 'motivo_rechazo',
    ];

    const filas = [columnas.join(',')];
    for (const fila of data) {
      const linea = columnas.map(col => {
        const valor = fila[col] ?? '';
        const texto = String(valor).replace(/"/g, '""');
        return texto.includes(',') ? `"${texto}"` : texto;
      });
      filas.push(linea.join(','));
    }

    const csv = filas.join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="historial_pagos_zas_${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

module.exports = router;
