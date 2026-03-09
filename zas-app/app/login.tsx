import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';

const API_URL = 'https://zas-backend-production-fb4e.up.railway.app';

export default function LoginScreen() {const router = useRouter();
  const [telefono, setTelefono] = useState('');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [esNuevo, setEsNuevo] = useState(false);
  const [cargando, setCargando] = useState(false);

  const buscarUsuario = async () => {
    if (!telefono) { Alert.alert('Error', 'Ingresa tu teléfono'); return; }
    setCargando(true);
    try {
      const res = await fetch(`${API_URL}/api/usuarios/buscar/${telefono}`);
      const data = await res.json();
      if (data.ok) router.push('/home');
      else { setEsNuevo(true); }
    } catch { Alert.alert('Error', 'No se pudo conectar'); }
    finally { setCargando(false); }
  };

  const registrarUsuario = async () => {
    if (!nombre || !telefono) { Alert.alert('Error', 'Nombre y teléfono son obligatorios'); return; }
    setCargando(true);
    try {
      const res = await fetch(`${API_URL}/api/usuarios/registro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, telefono, email }),
      });
      const data = await res.json();
      if (data.ok) { Alert.alert('¡Registro exitoso!', `Bienvenido a ZAS, ${data.usuario.nombre} 🚀`); setEsNuevo(false); }
      else { Alert.alert('Error', data.error || 'No se pudo registrar'); }
    } catch { Alert.alert('Error', 'No se pudo conectar'); }
    finally { setCargando(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <Text style={styles.logo}>⚡</Text>
        <Text style={styles.titulo}>ZAS</Text>
        <Text style={styles.subtitulo}>Tu moto taxi al instante</Text>
      </View>
      <View style={styles.formulario}>
        {!esNuevo ? (
          <>
            <Text style={styles.label}>Número de teléfono</Text>
            <TextInput style={styles.input} placeholder="Ej: 3001234567" keyboardType="phone-pad" value={telefono} onChangeText={setTelefono} maxLength={10} />
            <TouchableOpacity style={styles.boton} onPress={buscarUsuario} disabled={cargando}>
              {cargando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonTexto}>Continuar</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.label}>Nombre completo</Text>
            <TextInput style={styles.input} placeholder="Tu nombre" value={nombre} onChangeText={setNombre} />
            <Text style={styles.label}>Teléfono</Text>
            <TextInput style={styles.input} placeholder="3001234567" keyboardType="phone-pad" value={telefono} onChangeText={setTelefono} maxLength={10} />
            <Text style={styles.label}>Email (opcional)</Text>
            <TextInput style={styles.input} placeholder="tu@email.com" keyboardType="email-address" value={email} onChangeText={setEmail} />
            <TouchableOpacity style={styles.boton} onPress={registrarUsuario} disabled={cargando}>
              {cargando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonTexto}>Registrarme</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEsNuevo(false)}>
              <Text style={styles.linkTexto}>← Volver</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    <TouchableOpacity onPress={() => router.push('/conductor')} style={styles.botonConductor}>
  <Text style={styles.botonConductorTexto}>🏍️ Soy conductor</Text>
</TouchableOpacity>
</KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 60 },
  titulo: { fontSize: 48, fontWeight: 'bold', color: '#FFD700', letterSpacing: 8 },
  subtitulo: { fontSize: 16, color: '#aaa', marginTop: 4 },
  formulario: { backgroundColor: '#16213e', borderRadius: 16, padding: 24 },
  label: { color: '#fff', marginBottom: 6, fontSize: 14 },
  input: { backgroundColor: '#0f3460', color: '#fff', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 16 },
  boton: { backgroundColor: '#FFD700', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 4 },
  botonTexto: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 16 },
  linkTexto: { color: '#FFD700', textAlign: 'center', marginTop: 16, fontSize: 14},
 botonConductor: { marginTop: 20, alignItems: 'center' },
botonConductorTexto: { color: '#888', fontSize: 14 },
});