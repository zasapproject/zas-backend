const supabase = require('../supabase');

async function registrarHistorial({
  tipo_pago, referencia_id, conductor_id, usuario_id,
  nombre_persona, telefono_persona, monto, metodo,
  accion, estado_resultante, motivo_rechazo, comprobante_url, admin_nombre
}) {
  try {
    await supabase.from('historial_pagos').insert({
      tipo_pago,
      referencia_id,
      conductor_id: conductor_id || null,
      usuario_id: usuario_id || null,
      nombre_persona: nombre_persona || null,
      telefono_persona: telefono_persona || null,
      monto,
      moneda: 'USD',
      metodo: metodo || null,
      accion,
      estado_resultante: estado_resultante || null,
      motivo_rechazo: motivo_rechazo || null,
      comprobante_url: comprobante_url || null,
      admin_nombre: admin_nombre || 'sistema',
    });
  } catch (err) {
    console.error('Error registrando historial_pagos:', err.message);
  }
}

module.exports = { registrarHistorial };
