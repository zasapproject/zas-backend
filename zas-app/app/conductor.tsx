import { enviarNotificacion, registrarNotificaciones } from '../notificaciones';
import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, RefreshControl, Linking, TextInput, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://zas-backend-production-fb4e.up.railway.app';

export default function ConductorScreen() {
  const router = useRouter();
  const [sesion, setSesion] = useState<any>(null);
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [viajes, setViajes] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    cargarSesion();
  }, []);

  useEffect(() => {
    if (sesion) {
      registrarNotificaciones();
      buscarViajes();
      const intervalo = setInterval(buscarViajes, 5000);
      return () => clearInterval(intervalo);
    }
  }, [sesion]);

  const cargarSesion = async () => {
    try {
      const data = await AsyncStorage.getItem('conductor_sesion');
      if (data) setSesion(JSON.parse(data));
    } catch {}
  };

  const login = async () => {
    if (!telefono || !password) { Alert.alert('Error', 'Ingresa telefono y contrasena'); return; }
    setCargando(true);
    try {
      const res = await fetch(API_URL + '/api/conductores/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ telefono, password }) });
      const data = await res.json();
      if (data.ok) {
        await AsyncStorage.setItem('conductor_sesion', JSON.stringify(data.conductor));
        setSesion(data.conductor);
      } else Alert.alert('Error', data.error || 'Telefono o contrasena incorrectos');
    } catch { Alert.alert('Error', 'No se pudo conectar'); }
    finally { setCargando(false); }
  };

  const cerrarSesion = async () => {
    await AsyncStorage.removeItem('conductor_sesion');
    setSesion(null);
    setViajes([]);
  };

  const buscarViajes = async () => {
    try {
      const res = await fetch(API_URL + '/api/viajes/estado/solicitado');
      const data = await res.json();
      if (data.ok) setViajes(data.viajes || []);
    } catch {}
    setRefreshing(false);
  };

  const aceptarViaje = async (viaje: any) => {
    if (!sesion) return;
    try {
      const res = await fetch(API_URL + '/api/viajes/' + viaje.id + '/estado', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: 'aceptado', conductor_id: sesion.id }) });
      const data = await res.json();
      if (data.ok) {
        enviarNotificacion('Viaje aceptado', 'Vas a recoger a ' + viaje.usuario_nombre);
        router.push({ pathname: '/mapa_viaje', params: { viaje_id: viaje.id, rol: 'conductor', conductor_id: sesion.id, usuario_nombre: viaje.usuario_nombre, usuario_telefono: viaje.usuario_telefono, usuario_foto: viaje.usuario_foto, origen: viaje.origen, destino: viaje.destino } });
      } else Alert.alert('Error', data.error || 'No se pudo aceptar');
    } catch { Alert.alert('Error', 'No se pudo conectar'); }
  };

  if (!sesion) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.titulo}>Login Conductor</Text>
          <Text style={styles.label}>Telefono</Text>
          <TextInput style={styles.input} placeholder="3001234567" placeholderTextColor="#888" keyboardType="phone-pad" value={telefono} onChangeText={setTelefono} maxLength={10} />
          <Text style={styles.label}>Contrasena</Text>
          <TextInput style={styles.input} placeholder="Tu contrasena" placeholderTextColor="#888" secureTextEntry value={password} onChangeText={setPassword} />
          <TouchableOpacity style={styles.boton} onPress={login} disabled={cargando}>
            {cargando ? <ActivityIndicator color="#1a1a2e" /> : <Text style={styles.botonTexto}>Entrar</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.linkTexto}>Volver</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.titulo}>Hola, {sesion.nombre}</Text>
        <TouchableOpacity onPress={cerrarSesion}>
          <Text style={styles.linkTexto}>Cerrar sesion</Text>
        </TouchableOpacity>
      </View>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); buscarViajes(); }} />}>
        {viajes.length === 0 ? (
          <Text style={styles.sinViajes}>Esperando viajes...</Text>
        ) : (
          viajes.map(viaje => (
            <View key={viaje.id} style={styles.card}>
              {viaje.usuario_foto ? <Image source={{ uri: viaje.usuario_foto }} style={styles.foto} /> : null}
              <Text style={styles.cardTitulo}>{viaje.usuario_nombre}</Text>
              <Text style={styles.cardTexto}>Origen: {viaje.origen}</Text>
              <Text style={styles.cardTexto}>Destino: {viaje.destino}</Text>
              <Text style={styles.cardTexto}>Precio: ${viaje.precio}</Text>
              <View style={styles.botones}>
                <TouchableOpacity style={styles.botonAceptar} onPress={() => aceptarViaje(viaje)}>
                  <Text style={styles.botonTexto}>Aceptar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.botonLlamar} onPress={() => Linking.openURL('tel:' + viaje.usuario_telefono)}>
                  <Text style={styles.botonTexto}>Llamar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 50 },
  titulo: { fontSize: 22, color: '#FFD700', fontWeight: 'bold' },
  label: { color: '#aaa', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  input: { backgroundColor: '#16213e', borderRadius: 10, padding: 14, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#0f3460', marginBottom: 12 },
  boton: { backgroundColor: '#FFD700', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  botonTexto: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 16 },
  linkTexto: { color: '#888', textAlign: 'center', marginTop: 12, fontSize: 14 },
  sinViajes: { color: '#888', textAlign: 'center', marginTop: 40, fontSize: 16 },
  card: { backgroundColor: '#16213e', borderRadius: 12, padding: 16, margin: 12, borderWidth: 1, borderColor: '#0f3460' },
  cardTitulo: { color: '#FFD700', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  cardTexto: { color: '#aaa', fontSize: 14, marginBottom: 4 },
  foto: { width: 60, height: 60, borderRadius: 30, marginBottom: 10, borderWidth: 2, borderColor: '#FFD700' },
  botones: { flexDirection: 'row', gap: 10, marginTop: 12 },
  botonAceptar: { flex: 1, backgroundColor: '#FFD700', borderRadius: 10, padding: 12, alignItems: 'center' },
  botonLlamar: { flex: 1, backgroundColor: '#0f3460', borderRadius: 10, padding: 12, alignItems: 'center' },
});