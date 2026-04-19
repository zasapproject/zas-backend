console.log('📦 asignacionService cargado');
const supabase = require('../supabase');

async function asignarConductor(viaje) {
  try {
    console.log('Buscando conductor...');

    const { data: conductores } = await supabase
      .from('conductores')
      .select('*')
      .eq('estado', 'disponible')
      .limit(1);

    if (!conductores || conductores.length === 0) {
      console.log('No hay conductores');

      await supabase
        .from('viajes')
        .update({ estado: 'sin_conductor' })
        .eq('id', viaje.id);

      return;
    }

    const conductor = conductores[0];

    await supabase
      .from('viajes')
      .update({
        conductor_id: conductor.id,
        estado: 'asignado',
      })
      .eq('id', viaje.id);

    console.log('Conductor asignado');
  } catch (error) {
    console.error(error);
  }
}

module.exports = { asignarConductor };