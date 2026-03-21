import { enviarNotificacion, registrarNotificaciones } from '../notificaciones';
import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, RefreshControl, Linking, TextInput, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

const API_URL = 'https://zas-backend-production-fb4e.up.railway.app';

export default function ConductorScreen() {
  const router = useRouter();
  const [pantalla, setPantalla] = useState('login');
  const [sesion, setSesion] = useState<any>(null);
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [viajes, setViajes] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [verPassword, setVerPassword] = useState(false);
  const [verPasswordReg, setVerPasswordReg] = useState(false);

  // Registro paso 1
  const [regNombre, setRegNombre] = useState('');
  const [regTelefono, setRegTelefono] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regFoto, setRegFoto] = useState('');

  // Registro paso 2
  const [regPlaca, setRegPlaca] = useState('');
  const [regModelo, setRegModelo] = useState('');

  // Registro paso 3
  const [regFotoCedula, setRegFotoCedula] = useState('');
  const [regFotoLicencia, setRegFotoLicencia] = useState('');
  const [regFotoRegistro, setRegFotoRegistro] = useState('');

  useEffect(() => { cargarSesion(); }, []);

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

  const tomarOSeleccionarFoto = async (setter: (v: string) => void) => {
    Alert.alert('Foto', '¿Cómo quieres agregar la foto?', [
      { text: 'Cámara', onPress: async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') return;
        const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1,1], quality: 0.5, base64: true });
        if (!result.canceled) setter('data:image/jpeg;base64,' + result.assets[0].base64);
      }},
      { text: 'Galería', onPress: async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return;
        const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1,1], quality: 0.5, base64: true });
        if (!result.canceled) setter('data:image/jpeg;base64,' + result.assets[0].base64);
      }},
      { text: 'Cancelar', style: 'cancel' }
    ]);
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

  const registrarConductor = async () => {
    if (!regFotoCedula || !regFotoLicencia || !regFotoRegistro) {
      Alert.alert('Error', 'Debes subir todos los documentos');
      return;
    }
    setCargando(true);
    try {
      const res = await fetch(API_URL + '/api/conductores/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: regNombre,
          telefono: regTelefono,
          password: regPassword,
          foto_url: regFoto,
          placa_moto: regPlaca,
          modelo_moto: regModelo,
          foto_cedula: regFotoCedula,
          foto_licencia: regFotoLicencia,
          foto_registro_moto: regFotoRegistro,
        })
      });
      const data = await res.json();
      if (data.ok) {
        Alert.alert('¡Registro exitoso!', 'Tu cuenta está pendiente de aprobación por el administrador. Te avisaremos pronto.');
        setPantalla('login');
      } else Alert.alert('Error', data.error || 'No se pudo registrar');
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

  // ── PANTALLA LOGIN ──
  if (!sesion) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* LOGIN */}
          {pantalla === 'login' && (
            <>
              <Text style={styles.titulo}>Login Conductor</Text>
              <Text style={styles.label}>Teléfono</Text>
              <TextInput style={styles.input} placeholder="04121234567" placeholderTextColor="#888" keyboardType="phone-pad" value={telefono} onChangeText={setTelefono} maxLength={11} />
              <Text style={styles.label}>Contraseña</Text>
              <View style={styles.inputContenedor}>
                <TextInput style={styles.inputFlex} placeholder="Tu contraseña" placeholderTextColor="#888" secureTextEntry={!verPassword} value={password} onChangeText={setPassword} />
                <TouchableOpacity onPress={() => setVerPassword(!verPassword)}>
                  <Text style={styles.ojo}>{verPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.boton} onPress={login} disabled={cargando}>
                {cargando ? <ActivityIndicator color="#1a1a2e" /> : <Text style={styles.botonTexto}>Entrar</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.botonOutline} onPress={() => setPantalla('reg1')}>
                <Text style={styles.botonOutlineTexto}>Registrarme como conductor</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={styles.linkTexto}>Volver</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Linking.openURL('https://wa.me/573113003100?text=Hola,%20necesito%20recuperar%20mi%20contraseña%20de%20ZAS')}>
                <Text style={[styles.linkTexto, { color: '#FFD700' }]}>¿Olvidaste tu contraseña?</Text>
              </TouchableOpacity>
            </>
          )}

          {/* REGISTRO PASO 1 */}
          {pantalla === 'reg1' && (
            <>
              <Text style={styles.titulo}>Registro — Paso 1/3</Text>
              <Text style={styles.pasoTexto}>Datos personales</Text>
              <TouchableOpacity onPress={() => tomarOSeleccionarFoto(setRegFoto)} style={styles.fotoCirculo}>
                {regFoto
                  ? <Image source={{ uri: regFoto }} style={styles.fotoCirculoImg} />
                  : <Text style={styles.fotoCirculoTexto}>📷 Foto</Text>}
              </TouchableOpacity>
              <Text style={styles.label}>Nombre completo</Text>
              <TextInput style={styles.input} placeholder="Tu nombre" placeholderTextColor="#888" value={regNombre} onChangeText={setRegNombre} />
              <Text style={styles.label}>Teléfono</Text>
              <TextInput style={styles.input} placeholder="04121234567" placeholderTextColor="#888" keyboardType="phone-pad" value={regTelefono} onChangeText={setRegTelefono} maxLength={11} />
              <Text style={styles.label}>Contraseña</Text>
              <View style={styles.inputContenedor}>
                <TextInput style={styles.inputFlex} placeholder="Mínimo 4 caracteres" placeholderTextColor="#888" secureTextEntry={!verPasswordReg} value={regPassword} onChangeText={setRegPassword} />
                <TouchableOpacity onPress={() => setVerPasswordReg(!verPasswordReg)}>
                  <Text style={styles.ojo}>{verPasswordReg ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.boton} onPress={() => {
                if (!regNombre || !regTelefono || !regPassword) { Alert.alert('Error', 'Todos los campos son obligatorios'); return; }
                if (regPassword.length < 4) { Alert.alert('Error', 'La contraseña debe tener mínimo 4 caracteres'); return; }
                setPantalla('reg2');
              }}>
                <Text style={styles.botonTexto}>Siguiente →</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setPantalla('login')}>
                <Text style={styles.linkTexto}>Volver</Text>
              </TouchableOpacity>
            </>
          )}

          {/* REGISTRO PASO 2 */}
          {pantalla === 'reg2' && (
            <>
              <Text style={styles.titulo}>Registro — Paso 2/3</Text>
              <Text style={styles.pasoTexto}>Datos de la moto</Text>
              <Text style={styles.label}>Placa</Text>
              <TextInput style={styles.input} placeholder="ABC123" placeholderTextColor="#888" value={regPlaca} onChangeText={setRegPlaca} autoCapitalize="characters" />
              <Text style={styles.label}>Modelo</Text>
              <TextInput style={styles.input} placeholder="Honda CB 125 2020" placeholderTextColor="#888" value={regModelo} onChangeText={setRegModelo} />
              <TouchableOpacity style={styles.boton} onPress={() => {
                if (!regPlaca || !regModelo) { Alert.alert('Error', 'Ingresa placa y modelo'); return; }
                setPantalla('reg3');
              }}>
                <Text style={styles.botonTexto}>Siguiente →</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setPantalla('reg1')}>
                <Text style={styles.linkTexto}>Volver</Text>
              </TouchableOpacity>
            </>
          )}

          {/* REGISTRO PASO 3 */}
          {pantalla === 'reg3' && (
            <>
              <Text style={styles.titulo}>Registro — Paso 3/3</Text>
              <Text style={styles.pasoTexto}>Documentos</Text>

              <Text style={styles.label}>Foto Cédula</Text>
              <TouchableOpacity style={styles.docBoton} onPress={() => tomarOSeleccionarFoto(setRegFotoCedula)}>
                {regFotoCedula
                  ? <Image source={{ uri: regFotoCedula }} style={styles.docImg} />
                  : <Text style={styles.docBotonTexto}>📄 Subir cédula</Text>}
              </TouchableOpacity>

              <Text style={styles.label}>Foto Licencia</Text>
              <TouchableOpacity style={styles.docBoton} onPress={() => tomarOSeleccionarFoto(setRegFotoLicencia)}>
                {regFotoLicencia
                  ? <Image source={{ uri: regFotoLicencia }} style={styles.docImg} />
                  : <Text style={styles.docBotonTexto}>📄 Subir licencia</Text>}
              </TouchableOpacity>

              <Text style={styles.label}>Foto Registro de Moto</Text>
              <TouchableOpacity style={styles.docBoton} onPress={() => tomarOSeleccionarFoto(setRegFotoRegistro)}>
                {regFotoRegistro
                  ? <Image source={{ uri: regFotoRegistro }} style={styles.docImg} />
                  : <Text style={styles.docBotonTexto}>📄 Subir registro</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.boton} onPress={registrarConductor} disabled={cargando}>
                {cargando ? <ActivityIndicator color="#1a1a2e" /> : <Text style={styles.botonTexto}>Enviar solicitud</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setPantalla('reg2')}>
                <Text style={styles.linkTexto}>Volver</Text>
              </TouchableOpacity>
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── PANTALLA CONDUCTOR ACTIVO ──
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.titulo}>Hola, {sesion.nombre}</Text>
        <View style={{ gap: 8, marginTop: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={() => router.push('/suscripcion')} style={{ flex: 1, backgroundColor: '#FFD700', borderRadius: 8, padding: 10, alignItems: 'center' }}>
              <Text style={{ color: '#1a1a2e', fontWeight: 'bold', fontSize: 13 }}>Suscripcion</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/documentos_conductor')} style={{ flex: 1, backgroundColor: '#0f3460', borderRadius: 8, padding: 10, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Documentos</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={cerrarSesion} style={{ backgroundColor: '#3a1a1a', borderRadius: 8, padding: 10, alignItems: 'center' }}>
            <Text style={{ color: '#ff6b6b', fontWeight: 'bold', fontSize: 13 }}>Cerrar sesion</Text>
          </TouchableOpacity>
        </View>
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
  titulo: { fontSize: 22, color: '#FFD700', fontWeight: 'bold', marginBottom: 4 },
  pasoTexto: { color: '#888', fontSize: 13, marginBottom: 16 },
  label: { color: '#aaa', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  input: { backgroundColor: '#16213e', borderRadius: 10, padding: 14, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#0f3460', marginBottom: 12 },
  boton: { backgroundColor: '#FFD700', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  botonTexto: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 16 },
  botonOutline: { backgroundColor: 'transparent', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#FFD700', marginTop: 8 },
  botonOutlineTexto: { color: '#FFD700', fontWeight: 'bold', fontSize: 16 },
  linkTexto: { color: '#888', textAlign: 'center', marginTop: 12, fontSize: 14 },
  sinViajes: { color: '#888', textAlign: 'center', marginTop: 40, fontSize: 16 },
  card: { backgroundColor: '#16213e', borderRadius: 12, padding: 16, margin: 12, borderWidth: 1, borderColor: '#0f3460' },
  cardTitulo: { color: '#FFD700', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  cardTexto: { color: '#aaa', fontSize: 14, marginBottom: 4 },
  foto: { width: 60, height: 60, borderRadius: 30, marginBottom: 10, borderWidth: 2, borderColor: '#FFD700' },
  botones: { flexDirection: 'row', gap: 10, marginTop: 12 },
  botonAceptar: { flex: 1, backgroundColor: '#FFD700', borderRadius: 10, padding: 12, alignItems: 'center' },
  botonLlamar: { flex: 1, backgroundColor: '#0f3460', borderRadius: 10, padding: 12, alignItems: 'center' },
  inputContenedor: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16213e', borderRadius: 10, borderWidth: 1, borderColor: '#0f3460', marginBottom: 12 },
  inputFlex: { flex: 1, padding: 14, color: '#fff', fontSize: 15 },
  ojo: { paddingHorizontal: 14, fontSize: 18 },
  fotoCirculo: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#16213e', borderWidth: 2, borderColor: '#FFD700', alignSelf: 'center', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  fotoCirculoImg: { width: 90, height: 90, borderRadius: 45 },
  fotoCirculoTexto: { color: '#FFD700', fontSize: 13 },
  docBoton: { backgroundColor: '#16213e', borderRadius: 10, borderWidth: 1, borderColor: '#0f3460', padding: 14, alignItems: 'center', marginBottom: 12 },
  docBotonTexto: { color: '#aaa', fontSize: 14 },
  docImg: { width: '100%', height: 120, borderRadius: 8 },
});