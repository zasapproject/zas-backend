import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, TextInput } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';

const API_URL = 'https://zas-backend-production-fb4e.up.railway.app';
const CONDUCTOR_ID = '9fe102bb-5720-48d4-8290-95ab66c1449b';

export default function PerfilConductorScreen() {
  const router = useRouter();
  const [conductor, setConductor] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [foto, setFoto] = useState('');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [placa, setPlaca] = useState('');
  const [modelo, setModelo] = useState('');

  const cargarPerfil = async () => {
    try {
      const res = await fetch(`${API_URL}/api/conductores/buscar/${CONDUCTOR_ID}`);
      const data = await res.json();
      if (data.ok) {
        setConductor(data.conductor);
        setNombre(data.conductor.nombre || '');
        setTelefono(data.conductor.telefono || '');
        setPlaca(data.conductor.placa_moto || '');
        setModelo(data.conductor.modelo_moto || '');
        setFoto(data.conductor.foto_url || '');
      }
    } catch {
      Alert.alert('Error', 'No se pudo cargar el perfil');
    } finally {
      setCargando(false);
    }
  };

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

  const guardarPerfil = async () => {
    if (!nombre || !telefono) { Alert.alert('Error', 'Nombre y teléfono son obligatorios'); return; }
    setGuardando(true);
    try {
      const res = await fetch(`${API_URL}/api/conductores/perfil/${CONDUCTOR_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, telefono, placa_moto: placa, modelo_moto: modelo, foto_url: foto }),
      });
      const data = await res.json();
      if (data.ok) {
        Alert.alert('✅ Perfil actualizado', 'Tus datos fueron guardados correctamente');
        cargarPerfil();
      } else Alert.alert('Error', data.error || 'No se pudo guardar');
    } catch {
      Alert.alert('Error', 'No se pudo conectar al servidor');
    } finally {
      setGuardando(false);
    }
  };

  useEffect(() => { cargarPerfil(); }, []);

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator color="#FFD700" size="large" />
        <Text style={styles.cargandoTexto}>Cargando perfil...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTexto}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.logo}>⚡ ZAS</Text>
        <Text style={styles.titulo}>Mi Perfil</Text>
      </View>

      {/* Foto */}
      <View style={styles.fotoSection}>
        <View style={styles.fotoCirculo}>
          <Text style={styles.fotoIcon}>{foto ? '✅' : '👤'}</Text>
        </View>
        {foto && <Text style={styles.fotoOk}>Foto cargada</Text>}
        <View style={styles.fotoBotones}>
          <TouchableOpacity style={styles.fotoBoton} onPress={tomarFoto}>
            <Text style={styles.fotoBotonTexto}>📷 Cámara</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.fotoBoton} onPress={seleccionarFoto}>
            <Text style={styles.fotoBotonTexto}>🖼️ Galería</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Datos */}
      <View style={styles.formulario}>
        <Text style={styles.label}>Nombre completo</Text>
        <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholderTextColor="#888" placeholder="Tu nombre" />

        <Text style={styles.label}>Teléfono</Text>
        <TextInput style={styles.input} value={telefono} onChangeText={setTelefono} placeholderTextColor="#888" keyboardType="phone-pad" placeholder="3001234567" />

        <Text style={styles.label}>Placa de la moto</Text>
        <TextInput style={styles.input} value={placa} onChangeText={setPlaca} placeholderTextColor="#888" placeholder="ABC123" autoCapitalize="characters" />

        <Text style={styles.label}>Modelo de la moto</Text>
        <TextInput style={styles.input} value={modelo} onChangeText={setModelo} placeholderTextColor="#888" placeholder="Honda CB125" />

        <TouchableOpacity style={[styles.boton, guardando && styles.botonDeshabilitado]} onPress={guardarPerfil} disabled={guardando}>
          {guardando ? <ActivityIndicator color="#1a1a2e" /> : <Text style={styles.botonTexto}>💾 Guardar cambios</Text>}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.botonSuscripcion} onPress={() => router.push('/suscripcion')}>
        <Text style={styles.botonSuscripcionTexto}>⚡ Ver mi suscripción</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  centrado: { flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' },
  cargandoTexto: { color: '#888', marginTop: 16 },
  header: { padding: 24, paddingTop: 60 },
  backBtn: { marginBottom: 12 },
  backTexto: { color: '#FFD700', fontSize: 14 },
  logo: { fontSize: 28, fontWeight: 'bold', color: '#FFD700' },
  titulo: { fontSize: 22, color: '#fff', marginTop: 8, fontWeight: '600' },
  fotoSection: { alignItems: 'center', padding: 24 },
  fotoCirculo: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#16213e', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFD700', marginBottom: 12 },
  fotoIcon: { fontSize: 48 },
  fotoOk: { color: '#00c853', fontSize: 13, fontWeight: 'bold', marginBottom: 12 },
  fotoBotones: { flexDirection: 'row', gap: 12 },
  fotoBoton: { backgroundColor: '#16213e', borderRadius: 10, padding: 12, alignItems: 'center', width: 120 },
  fotoBotonTexto: { color: '#fff', fontSize: 13 },
  formulario: { backgroundColor: '#16213e', margin: 16, borderRadius: 16, padding: 20 },
  label: { color: '#aaa', fontSize: 13, marginBottom: 6 },
  input: { backgroundColor: '#0f3460', color: '#fff', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 15 },
  boton: { backgroundColor: '#FFD700', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 4 },
  botonDeshabilitado: { opacity: 0.6 },
  botonTexto: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 15 },
  botonSuscripcion: { margin: 16, borderWidth: 1, borderColor: '#FFD700', borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 40 },
  botonSuscripcionTexto: { color: '#FFD700', fontSize: 14, fontWeight: 'bold' },
});