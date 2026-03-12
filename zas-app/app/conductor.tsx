import { enviarNotificacion, registrarNotificaciones } from '../notificaciones';
import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
const API_URL = 'https://zas-backend-production-fb4e.up.railway.app';

export default function ConductorScreen() {
  const [viajes, setViajes] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  useEffect(() => {
  registrarNotificaciones();
}, []);

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
        body: JSON.stringify({ estado: 'aceptado', conductor_id: '9fe102bb-5720-48d4-8290-95ab66c1449b' }),
      });
      const data = await res.json();
      if (data.ok) {
        Alert.alert('¡Viaje aceptado!', 'Ve a recoger al pasajero 🏍️');await enviarNotificacion('¡Viaje aceptado! 🏍️', 'El conductor va en camino');
        cargarViajes();
      }
    } catch {
      Alert.alert('Error', 'No se pudo aceptar el viaje');
    }
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
  <TouchableOpacity 
    style={styles.botonSuscripcion} 
    onPress={() => router.push('/suscripcion')}
  ><TouchableOpacity 
  style={styles.botonPerfil} 
  onPress={() => router.push('/perfil_conductor')}
>
  <Text style={styles.botonPerfilTexto}>👤 Mi Perfil</Text>
</TouchableOpacity>
    <Text style={styles.botonSuscripcionTexto}>⚡ Mi Suscripción</Text>
  </TouchableOpacity>
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
  botonAceptar: { backgroundColor: '#FFD700', borderRadius: 10, padding: 14, alignItems: 'center' },
  botonAceptarTexto: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 15 },
botonSuscripcion: { backgroundColor: '#0f3460', borderRadius: 8, padding: 10, marginTop: 12, alignItems: 'center' },
botonSuscripcionTexto: { color: '#FFD700', fontWeight: 'bold', fontSize: 14 },
botonPerfil: { backgroundColor: '#16213e', borderRadius: 8, padding: 10, marginTop: 8, alignItems: 'center' },
botonPerfilTexto: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});