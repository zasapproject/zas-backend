import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

const API_URL = 'https://zasapps.com';

export default function HistorialScreen() {
  const router = useRouter();
  const [viajes, setViajes] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tipoSesion, setTipoSesion] = useState<'usuario' | 'conductor'>('usuario');

  useEffect(() => { cargarHistorial(); }, []);

  const cargarHistorial = async () => {
    try {
      // Detectar si es usuario o conductor
      const sesionUsuario = await AsyncStorage.getItem('usuario_sesion');
      const sesionConductor = await AsyncStorage.getItem('conductor_sesion');

      let id = '';
      let tipo: 'usuario' | 'conductor' = 'usuario';

      if (sesionUsuario) {
        const u = JSON.parse(sesionUsuario);
        id = u.id;
        tipo = 'usuario';
      } else if (sesionConductor) {
        const c = JSON.parse(sesionConductor);
        id = c.id;
        tipo = 'conductor';
      } else {
        router.replace('/login');
        return;
      }

      setTipoSesion(tipo);

      const res = await fetch(`${API_URL}/api/viajes/${tipo}/${id}`);
      const data = await res.json();

      if (data.ok) {
        setViajes(data.viajes || []);
      } else {
        Alert.alert('Error', 'No se pudo cargar el historial');
      }
    } catch {
      Alert.alert('Sin conexión', 'Revisa tu internet e intenta de nuevo.');
    } finally {
      setCargando(false);
      setRefreshing(false);
    }
  };

  const formatearFecha = (fecha: string) => {
    if (!fecha) return '—';
    return new Date(fecha).toLocaleDateString('es-VE', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const colorEstado = (estado: string) => {
    if (estado === 'completado') return '#00c853';
    if (estado === 'cancelado') return '#ff1744';
    return '#FFD700';
  };

  if (cargando) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator color="#FFD700" size="large" />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.volver}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.titulo}>📋 Historial de viajes</Text>
        <Text style={styles.subtitulo}>{viajes.length} viaje{viajes.length !== 1 ? 's' : ''} registrado{viajes.length !== 1 ? 's' : ''}</Text>
      </View>

      {viajes.length === 0 ? (
        <View style={styles.vacio}>
          <Text style={styles.vacioEmoji}>🏍️</Text>
          <Text style={styles.vacioTexto}>No tienes viajes aún</Text>
          <Text style={styles.vacioSub}>Tus viajes aparecerán aquí</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargarHistorial(); }} />}
        >
          {viajes.map((viaje, i) => (
            <View key={viaje.id || i} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.fecha}>{formatearFecha(viaje.created_at)}</Text>
                <View style={[styles.estadoBadge, { backgroundColor: colorEstado(viaje.estado) + '20', borderColor: colorEstado(viaje.estado) }]}>
                  <Text style={[styles.estadoTexto, { color: colorEstado(viaje.estado) }]}>
                    {viaje.estado?.toUpperCase() || '—'}
                  </Text>
                </View>
              </View>

              <View style={styles.ruta}>
                <View style={styles.rutaFila}>
                  <View style={styles.puntoverde} />
                  <Text style={styles.rutaTexto} numberOfLines={2}>{viaje.origen || '—'}</Text>
                </View>
                <View style={styles.rutaLinea} />
                <View style={styles.rutaFila}>
                  <View style={styles.puntoRojo} />
                  <Text style={styles.rutaTexto} numberOfLines={2}>{viaje.destino || '—'}</Text>
                </View>
              </View>

              <View style={styles.cardFooter}>
                {tipoSesion === 'usuario' && viaje.conductor_nombre ? (
                  <Text style={styles.persona}>🏍️ {viaje.conductor_nombre}</Text>
                ) : tipoSesion === 'conductor' && viaje.usuario_nombre ? (
                  <Text style={styles.persona}>👤 {viaje.usuario_nombre}</Text>
                ) : null}
                <Text style={styles.precio}>
                  {viaje.precio ? `$${Number(viaje.precio).toLocaleString('es-CO')} COP` : '—'}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  loadingContainer: { flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' },
  header: { padding: 24, paddingTop: 50, borderBottomWidth: 1, borderBottomColor: '#0f3460' },
  volver: { color: '#FFD700', fontSize: 16, marginBottom: 12 },
  titulo: { fontSize: 24, color: '#fff', fontWeight: 'bold', marginBottom: 4 },
  subtitulo: { color: '#888', fontSize: 13 },
  vacio: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  vacioEmoji: { fontSize: 64, marginBottom: 16 },
  vacioTexto: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  vacioSub: { color: '#888', fontSize: 14 },
  card: { backgroundColor: '#16213e', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#0f3460' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  fecha: { color: '#888', fontSize: 12, fontFamily: 'monospace' },
  estadoBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  estadoTexto: { fontSize: 11, fontWeight: 'bold' },
  ruta: { backgroundColor: '#0f3460', borderRadius: 12, padding: 12, marginBottom: 12 },
  rutaFila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rutaLinea: { width: 2, height: 12, backgroundColor: '#333', marginLeft: 4, marginVertical: 4 },
  puntoverde: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#00c853', flexShrink: 0 },
  puntoRojo: { width: 10, height: 10, borderRadius: 2, backgroundColor: '#ff1744', flexShrink: 0 },
  rutaTexto: { color: '#fff', fontSize: 13, flex: 1 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  persona: { color: '#aaa', fontSize: 13 },
  precio: { color: '#FFD700', fontSize: 16, fontWeight: 'bold' },
});