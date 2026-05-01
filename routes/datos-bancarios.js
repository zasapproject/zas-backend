const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

router.get('/:conductor_id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('datos_bancarios_conductor')
      .select('*')
      .eq('conductor_id', req.params.conductor_id)
      .single();

    if (error || !data) {
      return res.json({ ok: true, datos: null, mensaje: 'Sin datos bancarios registrados aún.' });
    }

    res.json({ ok: true, datos: data });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

router.post('/guardar', async (req, res) => {
  const {
    conductor_id,
    banco,
    numero_cuenta,
    telefono_pago_movil,
    cedula,
    zelle_email,
    zelle_telefono,
    wallet_usdt,
    red_usdt,
  } = req.body;

  if (!conductor_id) {
    return res.status(400).json({ ok: false, error: 'conductor_id es obligatorio' });
  }

  const tienePagoMovil = telefono_pago_movil || numero_cuenta;
  const tieneZelle = zelle_email || zelle_telefono;
  const tieneUsdt = wallet_usdt;

  if (!tienePagoMovil && !tieneZelle && !tieneUsdt) {
    return res.status(400).json({
      ok: false,
      error: 'Debes registrar al menos un método: Pago Móvil, Zelle o USDT.',
    });
  }

  // Validar que el teléfono de Pago Móvil coincida con el del conductor
  if (telefono_pago_movil) {
    const { data: conductor } = await supabase
      .from('conductores')
      .select('telefono')
      .eq('id', conductor_id)
      .single();

    if (!conductor) {
      return res.status(404).json({ ok: false, error: 'Conductor no encontrado.' });
    }

    const telLimpio = (t) => t.replace(/\D/g, '');

    if (telLimpio(telefono_pago_movil) !== telLimpio(conductor.telefono)) {
      return res.status(400).json({
        ok: false,
        error: 'El teléfono de Pago Móvil debe coincidir con el número registrado en ZAS.',
      });
    }
  }

  const payload = {
    conductor_id,
    banco: banco || null,
    numero_cuenta: numero_cuenta || null,
    telefono_pago_movil: telefono_pago_movil || null,
    cedula: cedula || null,
    zelle_email: zelle_email || null,
    zelle_telefono: zelle_telefono || null,
    wallet_usdt: wallet_usdt || null,
    red_usdt: red_usdt || 'TRC20',
    actualizado_en: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('datos_bancarios_conductor')
      .upsert(payload, { onConflict: 'conductor_id' })
      .select()
      .single();

    if (error) throw error;

    res.json({
      ok: true,
      datos: data,
      mensaje: 'Datos bancarios guardados correctamente.',
    });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

module.exports = router;