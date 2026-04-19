console.log('📦 asignacionService cargado');
const supabase = require('../supabase');
const { enviarPush } = require('../pushNotifications');

async function asignarConductor(viaje) {
  try {
    console.log('🔍 Buscando conductor para viaje:', viaje.id);

    // ── PASO 1: buscar conductor disponible ──────────────
    const { data: conductores, error: errorBuscar } = await supabase
      .from('conductores')
      .select('id, nombre, push_token, estado')
      .eq('id', '569abe76-b469-4e45-974d-a772b65987f0')
      .limit(5);

    console.log('Conductores encontrados:', conductores?.length ?? 0);

    if (errorBuscar) {
      console.error('❌ Error buscando conductores:', errorBuscar.message);
      return;
    }

    if (!conductores || conductores.length === 0) {
      console.log('⚠️ No hay conductores disponibles');
      await supabase
        .from('viajes')
        .update({ estado: 'sin_conductor' })
        .eq('id', viaje.id);
      return;
    }

    // ── PASO 2: elegir el primero disponible ─────────────
    const conductor = conductores[0];
    console.log('✅ Conductor elegido:', conductor.id, conductor.nombre);

    // ── PASO 3: actualizar el viaje ──────────────────────
    const { error: errorViaje } = await supabase
      .from('viajes')
      .update({
        conductor_id: conductor.id,
        estado: 'asignado',
      })
      .eq('id', viaje.id);

    if (errorViaje) {
      console.error('❌ Error asignando viaje:', errorViaje.message);
      return;
    }

    // ── PASO 4: cambiar conductor a ocupado ──────────────
    const { error: errorConductor } = await supabase
      .from('conductores')
      .update({ estado: 'ocupado' })
      .eq('id', conductor.id);

    if (errorConductor) {
      console.error('❌ Error cambiando estado conductor:', errorConductor.message);
    } else {
      console.log('🔄 Conductor cambiado a ocupado');
    }

    // ── PASO 5: notificar al conductor por push ──────────
    if (conductor.push_token) {
      await enviarPush(
        conductor.push_token,
        '⚡ Nuevo viaje',
        `De: ${viaje.origen} → A: ${viaje.destino}`
      );
      console.log('🔔 Notificación enviada al conductor');
    } else {
      console.log('⚠️ Conductor sin push_token — sin notificación');
    }

    console.log('🏍️ Conductor asignado exitosamente al viaje', viaje.id);

  } catch (error) {
    console.error('❌ Error general en asignarConductor:', error.message);
  }
}

module.exports = { asignarConductor };