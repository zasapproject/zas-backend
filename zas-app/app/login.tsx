import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
const API_URL = 'https://zas-backend-production-fb4e.up.railway.app';

export default function LoginScreen() {
  const router = useRouter();
  const [pantalla, setPantalla] = useState('inicio'); // inicio | login | registro
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [foto, setFoto] = useState('');
  const [cargando, setCargando] = useState(false);

  const seleccionarFoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true,
    });
    if (!result.canceled) setFoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
  };

  const tomarFoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso requerido', 'Necesitamos acceso a tu cámara'); return; }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true,
    });
    if (!result.canceled) setFoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
  };

  const iniciarSesion = async () => {
    if (!telefono || !password) { Alert.alert('Error', 'Ingresa teléfono y contraseña'); return; }
    setCargando(true);
    try {
      const res = await fetch(`${API_URL}/api/usuarios/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono, password }),
      });
      const data = await res.json();
      if (data.ok) {
  await AsyncStorage.setItem('usuario_sesion', JSON.stringify(data.usuario));
  router.push('/home');
}
      else Alert.alert('Error', data.error || 'Teléfono o contraseña incorrectos');
    } catch { Alert.alert('Error', 'No se pudo conectar'); }
    finally { setCargando(false); }
  };

  const registrarUsuario = async () => {
    if (!nombre || !telefono || !password) { Alert.alert('Error', 'Nombre, teléfono y contraseña son obligatorios'); return; }
    if (password.length < 4) { Alert.alert('Error', 'La contraseña debe tener mínimo 4 caracteres'); return; }
    setCargando(true);
    try {
      const res = await fetch(`${API_URL}/api/usuarios/registro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, telefono, email, password, foto }),
      });
      const data = await res.json();
     if (data.ok) {
  await AsyncStorage.setItem('usuario_sesion', JSON.stringify(data.usuario));
  Alert.alert('Registro exitoso', `Bienvenido a ZAS, ${data.usuario.nombre}`);
  router.push('/home');
}
      } else Alert.alert('Error', data.error || 'No se pudo registrar');
    } catch { Alert.alert('Error', 'No se pudo conectar'); }
    finally { setCargando(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logo}>⚡</Text>
          <Text style={styles.titulo}>ZAS</Text>
          <Text style={styles.subtitulo}>Tu mototaxi al instante</Text>
        </View>

        {/* PANTALLA INICIO */}
        {pantalla === 'inicio' && (
          <View style={styles.formulario}>
            <TouchableOpacity style={styles.boton} onPress={() => setPantalla('login')}>
              <Text style={styles.botonTexto}>🚀 Iniciar sesión</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.botonOutline} onPress={() => setPantalla('registro')}>
              <Text style={styles.botonOutlineTexto}>📝 Crear cuenta</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.botonConductor} onPress={() => router.push('/conductor')}>
              <Text style={styles.botonConductorTexto}>🏍️ Soy conductor</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* PANTALLA LOGIN */}
        {pantalla === 'login' && (
          <View style={styles.formulario}>
            <Text style={styles.formTitulo}>Iniciar sesión</Text>
            <Text style={styles.label}>Teléfono</Text>
            <TextInput style={styles.input} placeholder="3001234567" placeholderTextColor="#888" keyboardType="phone-pad" value={telefono} onChangeText={setTelefono} maxLength={10} />
            <Text style={styles.label}>Contraseña</Text>
            <TextInput style={styles.input} placeholder="Tu contraseña" placeholderTextColor="#888" secureTextEntry value={password} onChangeText={setPassword} />
            <TouchableOpacity style={styles.boton} onPress={iniciarSesion} disabled={cargando}>
              {cargando ? <ActivityIndicator color="#1a1a2e" /> : <Text style={styles.botonTexto}>Entrar</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPantalla('inicio')}>
              <Text style={styles.linkTexto}>← Volver</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* PANTALLA REGISTRO */}
        {pantalla === 'registro' && (
          <View style={styles.formulario}>
            <Text style={styles.formTitulo}>Crear cuenta</Text>

            {/* Foto */}
            <Text style={styles.label}>Tu foto (para que el conductor te identifique)</Text>
            <View style={styles.fotoContainer}>
              {foto ? (
                <View style={styles.fotoPreview}>
                  <Text style={styles.fotoCheck}>✅ Foto seleccionada</Text>
                </View>
              ) : (
                <View style={styles.fotoBotones}>
                  <TouchableOpacity style={styles.fotoBoton} onPress={tomarFoto}>
                    <Text style={styles.fotoBotonTexto}>📷 Cámara</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.fotoBoton} onPress={seleccionarFoto}>
                    <Text style={styles.fotoBotonTexto}>🖼️ Galería</Text>
                  </TouchableOpacity>
                </View>
              )}
              {foto && (
                <TouchableOpacity onPress={() => setFoto('')}>
                  <Text style={styles.linkTexto}>Cambiar foto</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.label}>Nombre completo *</Text>
            <TextInput style={styles.input} placeholder="Tu nombre" placeholderTextColor="#888" value={nombre} onChangeText={setNombre} />
            <Text style={styles.label}>Teléfono *</Text>
            <TextInput style={styles.input} placeholder="3001234567" placeholderTextColor="#888" keyboardType="phone-pad" value={telefono} onChangeText={setTelefono} maxLength={10} />
            <Text style={styles.label}>Contraseña *</Text>
            <TextInput style={styles.input} placeholder="Mínimo 4 caracteres" placeholderTextColor="#888" secureTextEntry value={password} onChangeText={setPassword} />
            <Text style={styles.label}>Email (opcional)</Text>
            <TextInput style={styles.input} placeholder="tu@email.com" placeholderTextColor="#888" keyboardType="email-address" value={email} onChangeText={setEmail} />

            <TouchableOpacity style={styles.boton} onPress={registrarUsuario} disabled={cargando}>
              {cargando ? <ActivityIndicator color="#1a1a2e" /> : <Text style={styles.botonTexto}>Registrarme</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPantalla('inicio')}>
              <Text style={styles.linkTexto}>← Volver</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 60 },
  titulo: { fontSize: 48, fontWeight: 'bold', color: '#FFD700', letterSpacing: 8 },
  subtitulo: { fontSize: 16, color: '#aaa', marginTop: 4 },
  formulario: { backgroundColor: '#16213e', borderRadius: 16, padding: 24 },
  formTitulo: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 20 },
  label: { color: '#fff', marginBottom: 6, fontSize: 14 },
  input: { backgroundColor: '#0f3460', color: '#fff', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 16 },
  boton: { backgroundColor: '#FFD700', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 4, marginBottom: 12 },
  botonTexto: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 16 },
  botonOutline: { borderWidth: 1, borderColor: '#FFD700', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 12 },
  botonOutlineTexto: { color: '#FFD700', fontWeight: 'bold', fontSize: 16 },
  botonConductor: { alignItems: 'center', padding: 10 },
  botonConductorTexto: { color: '#888', fontSize: 14 },
  linkTexto: { color: '#FFD700', textAlign: 'center', marginTop: 16, fontSize: 14 },
  fotoContainer: { marginBottom: 16 },
  fotoBotones: { flexDirection: 'row', gap: 12 },
  fotoBoton: { flex: 1, backgroundColor: '#0f3460', borderRadius: 10, padding: 14, alignItems: 'center' },
  fotoBotonTexto: { color: '#fff', fontSize: 14 },
  fotoPreview: { backgroundColor: '#0f3460', borderRadius: 10, padding: 14, alignItems: 'center' },
  fotoCheck: { color: '#00c853', fontSize: 14, fontWeight: 'bold' },
});