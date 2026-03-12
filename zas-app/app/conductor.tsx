import { enviarNotificacion, registrarNotificaciones } from '../notificaciones';
import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, RefreshControl, Linking } from 'react-native';
import { useRouter } from 'expo-router';

const API_URL = 'https://zas-backend-production-fb4e.up.railway.app';
const CONDUCTOR_ID = '9fe102bb-5720-48d4-8290-95ab66c1449b';

export default function ConductorScreen() {
  const [viajes, setViajes] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  useEffect(() => { registrarNotificaciones(); }, []);

  const cargarViajes = async () => {
    setCargando(true);
    try {
      const res = await fetch(`${API_URL}/api/viajes/estado/solicitado`);
      const data = await res.json();
      if (data.ok) setViajes(data.viajes);
    } catch {
      Alert.alert('Error', 'No se pudo conectar al servidor');
    } finally {
      setCargando(false);
      setRefreshing(false);
    }
  };

  const aceptarViaje = async (viajeId) => {
    try {
      const res = await fetch(`${API_URL}/api/viajes/estado/${viajeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'aceptado', conductor_id: CONDUCTOR_ID }),
      // Al inicio del archivo, asegúrate de tener:
import { useRouter } from 'expo-router';

// Dentro del componente:
const router = useRouter();

// Después de aceptar el viaje exitosamente:
router.push({
  pathname: '/mapa_viaje',
  params: {
    viaje_id: viaje.id,
    rol: 'conductor',
    conductor_id: CONDUCTOR_ID,           // tu ID fijo ya definido
    usuario_nombre: viaje.usuario_nombre, // ajusta el nombre del campo según tu respuesta
    usuario_telefono: viaje.usuario_telefono,
    origen: viaje.origen,
    destino: viaje.destino,
  },
});

      const data = await res.json();
      if (data.ok) {
        Alert.alert('¡Viaje aceptado!', 'Ve a recoger al pasajero 🏍️');
        await enviarNotificacion('¡Viaje aceptado! 🏍️', 'El conductor va en camino');
        cargarViajes();
      }
    } catch {
      Alert.alert('Error', 'No se pudo aceptar el viaje');
    }
  };

  const llamarUsuario = (telefono) => {
    if (!telefono) { Alert.alert('Sin teléfono', 'Este usuario no tiene teléfono registrado'); return; }
    Linking.openURL(`tel:${telefono}`);
  };

  const mensajeUsuario = (telefono) => {
    if (!telefono) { Alert.alert('Sin teléfono', 'Este usuario no tiene teléfono registrado'); return; }
    Linking.openURL(`sms:${telefono}`);
  };

  const whatsappUsuario = (telefono) => {
    if (!telefono) { Alert.alert('Sin teléfono', 'Este usuario no tiene teléfono registrado'); return; }
    Linking.openURL(`https://wa.me/57${telefono}`);
  };

  useEffect(() => {
    cargarViajes();
    const interval = setInterval(cargarViajes, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargarViajes(); }} tintColor="#FFD700" />}
    >
      <View style={styles.header}>
        <Text style={styles.logo}>⚡ ZAS</Text>
        <Text style={styles.titulo}>Panel del Conductor</Text>
        <Text style={styles.subtitulo}>Desliza hacia abajo para actualizar</Text>
        <View style={styles.headerBotones}>
          <TouchableOpacity style={styles.botonPerfil} onPress={() => router.push('/perfil_conductor')}>
            <Text style={styles.botonPerfilTexto}>👤 Perfil</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.botonSuscripcion} onPress={() => router.push('/suscripcion')}>
            <Text style={styles.botonSuscripcionTexto}>⚡ Suscripción</Text>
          </TouchableOpacity>
        </View>
      </View>

      {cargando && !refreshing ? (
        <ActivityIndicator color="#FFD700" size="large" style={{ marginTop: 40 }} />
      ) : viajes.length === 0 ? (
        <View style={styles.sinViajes}>
          <Text style={styles.sinViajesIcon}>🏍️</Text>
          <Text style={styles.sinViajesTexto}>No hay viajes disponibles</Text>
          <Text style={styles.sinViajesSubtexto}>Espera nuevas solicitudes...</Text>
        </View>
      ) : (
        viajes.map((viaje) => (
          <View key={viaje.id} style={styles.viajeCard}>
            <View style={styles.viajeRuta}>
              <Text style={styles.viajeIcon}>🟢</Text>
              <Text style={styles.viajeTexto}>{viaje.origen}</Text>
            </View>
            <View style={styles.viajeRuta}>
              <Text style={styles.viajeIcon}>🔴</Text>
              <Text style={styles.viajeTexto}>{viaje.destino}</Text>
            </View>
            <View style={styles.viajePrecioRow}>
              <Text style={styles.viajePrecio}>${viaje.precio.toLocaleString()} COP</Text>
              <Text style={styles.viajeEstado}>{viaje.estado}</Text>
            </View>

            {/* Botones contacto usuario */}
            {viaje.usuario_telefono && (
              <View style={styles.contactoBotones}>
                <TouchableOpacity style={styles.btnLlamar} onPress={() => llamarUsuario(viaje.usuario_telefono)}>
                  <Text style={styles.btnContactoTexto}>📞 Llamar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnWhatsapp} onPress={() => whatsappUsuario(viaje.usuario_telefono)}>
                  <Text style={styles.btnContactoTexto}>💬 WhatsApp</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnSms} onPress={() => mensajeUsuario(viaje.usuario_telefono)}>
                  <Text style={styles.btnContactoTexto}>✉️ SMS</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity style={styles.botonAceptar} onPress={() => aceptarViaje(viaje.id)}>
              <Text style={styles.botonAceptarTexto}>✅ Aceptar viaje</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: { padding: 24, paddingTop: 60 },
  logo: { fontSize: 28, fontWeight: 'bold', color: '#FFD700' },
  titulo: { fontSize: 22, color: '#fff', marginTop: 8, fontWeight: '600' },
  subtitulo: { fontSize: 13, color: '#888', marginTop: 4 },
  headerBotones: { flexDirection: 'row', gap: 10, marginTop: 12 },
  botonPerfil: { flex: 1, backgroundColor: '#16213e', borderRadius: 8, padding: 10, alignItems: 'center' },
  botonPerfilTexto: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  botonSuscripcion: { flex: 1, backgroundColor: '#0f3460', borderRadius: 8, padding: 10, alignItems: 'center' },
  botonSuscripcionTexto: { color: '#FFD700', fontWeight: 'bold', fontSize: 13 },
  sinViajes: { alignItems: 'center', marginTop: 80 },
  sinViajesIcon: { fontSize: 60 },
  sinViajesTexto: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 16 },
  sinViajesSubtexto: { color: '#888', fontSize: 14, marginTop: 8 },
  viajeCard: { backgroundColor: '#16213e', margin: 16, marginBottom: 8, borderRadius: 16, padding: 20 },
  viajeRuta: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  viajeIcon: { fontSize: 14, marginRight: 10 },
  viajeTexto: { color: '#fff', fontSize: 15, flex: 1 },
  viajePrecioRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 16, padding: 12, backgroundColor: '#0f3460', borderRadius: 10 },
  viajePrecio: { color: '#FFD700', fontSize: 18, fontWeight: 'bold' },
  viajeEstado: { color: '#aaa', fontSize: 12, textTransform: 'uppercase' },
  contactoBotones: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  btnLlamar: { flex: 1, backgroundColor: '#00c853', borderRadius: 8, padding: 10, alignItems: 'center' },
  btnWhatsapp: { flex: 1, backgroundColor: '#075e54', borderRadius: 8, padding: 10, alignItems: 'center' },
  btnSms: { flex: 1, backgroundColor: '#0f3460', borderRadius: 8, padding: 10, alignItems: 'center' },
  btnContactoTexto: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  botonAceptar: { backgroundColor: '#FFD700', borderRadius: 10, padding: 14, alignItems: 'center' },
  botonAceptarTexto: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 15 },
});