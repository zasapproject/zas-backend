import { enviarNotificacion, registrarNotificaciones } from '../notificaciones';
import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, ScrollView, RefreshControl, Linking,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://zas-backend-production-fb4e.up.railway.app';

export default function ConductorScreen() {
  const [pantalla, setPantalla] = useState<'login' | 'panel'>('login');
  const [conductorId, setConductorId] = useState('');
  const [conductorNombre, setConductorNombre] = useState('');
  const [conductorTelefono, setConductorTelefono] = useState('');

  // Login
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [loginCargando, setLoginCargando] = useState(false);

  // Panel
  const [viajes, setViajes] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [navegandoAlMapa, setNavegandoAlMapa] = useState(false);

  const router = useRouter();

  // Verificar sesión guardada al abrir
  useEffect(() => {
    verificarSesion();
  }, []);

  useEffect(() => {
    if (pantalla === 'panel') {
      registrarNotificaciones();
      cargarViajes();
      const interval = setInterval(cargarViajes, 10000);
      return () => clearInterval(interval);
    }
  }, [pantalla]);

  const verificarSesion = async () => {
    try {
      const sesion = await AsyncStorage.getItem('conductor_sesion');
      if (sesion) {
        const conductor = JSON.parse(sesion);
        setConductorId(conductor.id);
        setConductorNombre(conductor.nombre);
        setConductorTelefono(conductor.telefono);
        setPantalla('panel');
      }
    } catch (_) {}
  };

  const iniciarSesion = async () => {
    if (!telefono.trim() || !password.trim()) {
      Alert.alert('Campos requeridos', 'Ingresa tu teléfono y contraseña');
      return;
    }
    setLoginCargando(true);
    try {
      const res = await fetch(`${API_URL}/api/conductores/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono: telefono.trim(), password: password.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        await AsyncStorage.setItem('conductor_sesion', JSON.stringify(data.conductor));
        setConductorId(data.conductor.id);
        setConductorNombre(data.conductor.nombre);
        setConductorTelefono(data.conductor.telefono);
        setPantalla('panel');
      } else {
        Alert.alert('Error', data.error || 'Teléfono o contraseña incorrectos');
      }
    } catch {
      Alert.alert('Error', 'No se pudo conectar al servidor');
    } finally {
      setLoginCargando(false);
    }
  };

  const cerrarSesion = async () => {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir', onPress: async () => {
          await AsyncStorage.removeItem('conductor_sesion');
          setConductorId('');
          setConductorNombre('');
          setTelefono('');
          setPassword('');
          setPantalla('login');
        }
      }
    ]);
  };

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

  const aceptarViaje = async (viaje: any) => {
    try {
      const res = await fetch(`${API_URL}/api/viajes/estado/${viaje.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'aceptado', conductor_id: conductorId }),
      });
      const data = await res.json();
      if (data.ok) {
        await enviarNotificacion('¡Viaje aceptado! 🏍️', 'El conductor va en camino');
        if (!navegandoAlMapa) {
          setNavegandoAlMapa(true);
          router.push({
            pathname: '/mapa_viaje',
            params: {
              viaje_id: viaje.id,
              rol: 'conductor',
              conductor_id: conductorId,
              usuario_nombre: viaje.usuario_nombre || viaje.nombre_usuario || '',
              usuario_telefono: viaje.usuario_telefono || viaje.telefono_usuario || '',
              origen: viaje.origen,
              destino: viaje.destino,
            },
          });
          setTimeout(() => setNavegandoAlMapa(false), 3000);
        }
      }
    } catch {
      Alert.alert('Error', 'No se pudo aceptar el viaje');
    }
  };

  const llamarUsuario = (tel: string) => {
    if (!tel) { Alert.alert('Sin teléfono'); return; }
    Linking.openURL(`tel:${tel}`);
  };
  const whatsappUsuario = (tel: string) => {
    if (!tel) return;
    Linking.openURL(`https://wa.me/57${tel}`);
  };
  const smsUsuario = (tel: string) => {
    if (!tel) return;
    Linking.openURL(`sms:${tel}`);
  };

  // ─── PANTALLA LOGIN ──────────────────────────────────────────────────────────
  if (pantalla === 'login') {
    return (
      <KeyboardAvoidingView
        style={styles.loginContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.loginLogo}>⚡ ZAS</Text>
        <Text style={styles.loginTitulo}>Acceso Conductores</Text>
        <Text style={styles.loginSubtitulo}>Ingresa con tu teléfono y contraseña</Text>

        <View style={styles.loginForm}>
          <Text style={styles.loginLabel}>📱 Teléfono</Text>
          <TextInput
            style={styles.loginInput}
            placeholder="Ej: 3001234567"
            placeholderTextColor="#555"
            keyboardType="phone-pad"
            value={telefono}
            onChangeText={setTelefono}
          />

          <Text style={styles.loginLabel}>🔒 Contraseña</Text>
          <TextInput
            style={styles.loginInput}
            placeholder="Tu contraseña"
            placeholderTextColor="#555"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            style={styles.loginBoton}
            onPress={iniciarSesion}
            disabled={loginCargando}
          >
            {loginCargando
              ? <ActivityIndicator color="#1a1a2e" />
              : <Text style={styles.loginBotonTexto}>Entrar al panel</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ─── PANTALLA PANEL ──────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); cargarViajes(); }}
          tintColor="#FFD700"
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.logo}>⚡ ZAS</Text>
        <Text style={styles.titulo}>Hola, {conductorNombre || 'Conductor'}</Text>
        <Text style={styles.subtitulo}>Desliza hacia abajo para actualizar</Text>
        <View style={styles.headerBotones}>
          <TouchableOpacity style={styles.botonPerfil} onPress={() => router.push('/perfil_conductor')}>
            <Text style={styles.botonPerfilTexto}>👤 Perfil</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.botonSuscripcion} onPress={() => router.push('/suscripcion')}>
            <Text style={styles.botonSuscripcionTexto}>⚡ Suscripción</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.botonSalir} onPress={cerrarSesion}>
            <Text style={styles.botonSalirTexto}>🚪 Salir</Text>
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
        viajes.map((viaje: any) => (
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
              <Text style={styles.viajePrecio}>${viaje.precio?.toLocaleString()} COP</Text>
              <Text style={styles.viajeEstado}>{viaje.estado}</Text>
            </View>

            {viaje.usuario_telefono && (
              <View style={styles.contactoBotones}>
                <TouchableOpacity style={styles.btnLlamar} onPress={() => llamarUsuario(viaje.usuario_telefono)}>
                  <Text style={styles.btnContactoTexto}>📞 Llamar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnWhatsapp} onPress={() => whatsappUsuario(viaje.usuario_telefono)}>
                  <Text style={styles.btnContactoTexto}>💬 WhatsApp</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnSms} onPress={() => smsUsuario(viaje.usuario_telefono)}>
                  <Text style={styles.btnContactoTexto}>✉️ SMS</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity style={styles.botonAceptar} onPress={() => aceptarViaje(viaje)}>
              <Text style={styles.botonAceptarTexto}>✅ Aceptar viaje</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // ── Login ──
  loginContainer: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  loginLogo: { fontSize: 36, fontWeight: 'bold', color: '#FFD700', textAlign: 'center', marginBottom: 8 },
  loginTitulo: { fontSize: 22, color: '#fff', fontWeight: '700', textAlign: 'center' },
  loginSubtitulo: { fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 36 },
  loginForm: { gap: 12 },
  loginLabel: { color: '#aaa', fontSize: 13, fontWeight: '600', marginBottom: 2 },
  loginInput: {
    backgroundColor: '#16213e',
    borderRadius: 10,
    padding: 14,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#0f3460',
    marginBottom: 8,
  },
  loginBoton: {
    backgroundColor: '#FFD700',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  loginBotonTexto: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 16 },

  // ── Panel ──
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: { padding: 24, paddingTop: 60 },
  logo: { fontSize: 28, fontWeight: 'bold', color: '#FFD700' },
  titulo: { fontSize: 22, color: '#fff', marginTop: 8, fontWeight: '600' },
  subtitulo: { fontSize: 13, color: '#888', marginTop: 4 },
  headerBotones: { flexDirection: 'row', gap: 8, marginTop: 12 },
  botonPerfil: { flex: 1, backgroundColor: '#16213e', borderRadius: 8, padding: 10, alignItems: 'center' },
  botonPerfilTexto: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  botonSuscripcion: { flex: 1, backgroundColor: '#0f3460', borderRadius: 8, padding: 10, alignItems: 'center' },
  botonSuscripcionTexto: { color: '#FFD700', fontWeight: 'bold', fontSize: 12 },
  botonSalir: { flex: 1, backgroundColor: '#3a1a1a', borderRadius: 8, padding: 10, alignItems: 'center' },
  botonSalirTexto: { color: '#ff6b6b', fontWeight: 'bold', fontSize: 12 },
  sinViajes: { alignItems: 'center', marginTop: 80 },
  sinViajesIcon: { fontSize: 60 },
  sinViajesTexto: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 16 },
  sinViajesSubtexto: { color: '#888', fontSize: 14, marginTop: 8 },
  viajeCard: { backgroundColor: '#16213e', margin: 16, marginBottom: 8, borderRadius: 16, padding: 20 },
  viajeRuta: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  viajeIcon: { fontSize: 14, marginRight: 10 },
  viajeTexto: { color: '#fff', fontSize: 15, flex: 1 },
  viajePrecioRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 12, marginBottom: 16, padding: 12, backgroundColor: '#0f3460', borderRadius: 10,
  },
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
