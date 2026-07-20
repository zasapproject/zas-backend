import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

const API_URL = 'https://zasapps.com';

export default function EditarPerfilScreen() {
  const router = useRouter();
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [foto, setFoto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [usuarioId, setUsuarioId] = useState('');

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    const sesion = await AsyncStorage.getItem('usuario_sesion');
    if (sesion) {
      const u = JSON.parse(sesion);
      setUsuarioId(u.id);
      setTelefono(u.telefono || '');
      setEmail(u.email || '');
      setFoto(u.foto_url || '');
    }
  };

  const subirFoto = async (base64: string) => {
    try {
      const res = await fetch(`${API_URL}/api/storage/subir-foto`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, nombre: `usuario_${usuarioId}`, carpeta: 'usuarios' })
      });
      const data = await res.json();
      return data.ok ? data.url : null;
    } catch { return null; }
  };

  const seleccionarFoto = () => {
    Alert.alert('Foto de perfil', '¿Cómo quieres agregar la foto?', [
      { text: 'Cámara', onPress: async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') return;
        const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1,1], quality: 0.3, base64: true });
        if (!result.canceled) {
          const url = await subirFoto('data:image/jpeg;base64,' + result.assets[0].base64);
          if (url) setFoto(url);
        }
      }},
      { text: 'Galería', onPress: async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return;
        const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1,1], quality: 0.3, base64: true });
        if (!result.canceled) {
          const url = await subirFoto('data:image/jpeg;base64,' + result.assets[0].base64);
          if (url) setFoto(url);
        }
      }},
      { text: 'Cancelar', style: 'cancel' }
    ]);
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      const res = await fetch(`${API_URL}/api/usuarios/perfil/${usuarioId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-session-token': sessionToken || '' },
        body: JSON.stringify({ telefono, email: email || null, foto_url: foto })
      });
      const data = await res.json();
      if (data.ok) {
        const sesion = await AsyncStorage.getItem('usuario_sesion');
        if (sesion) {
          const u = JSON.parse(sesion);
          await AsyncStorage.setItem('usuario_sesion', JSON.stringify({ ...u, telefono, email, foto_url: foto }));
        }
        Alert.alert('✅ Perfil actualizado', '', [{ text: 'OK', onPress: () => router.back() }]);
      } else {
        Alert.alert('Error', data.error || 'No se pudo guardar');
      }
    } catch {
      Alert.alert('Error', 'No se pudo conectar');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.botonVolver}>
          <Text style={styles.botonVolverTexto}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.titulo}>Editar perfil</Text>
      </View>

      <TouchableOpacity onPress={seleccionarFoto} style={styles.fotoCirculo}>
        {foto
          ? <Image source={{ uri: foto }} style={styles.fotoImg} />
          : <Text style={styles.fotoTexto}>📷{'\n'}Foto</Text>
        }
      </TouchableOpacity>

      <Text style={styles.label}>Teléfono</Text>
      <TextInput
        style={styles.input}
        value={telefono}
        onChangeText={setTelefono}
        keyboardType="phone-pad"
        maxLength={11}
        placeholder="04121234567"
        placeholderTextColor="#555"
      />

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholder="tu@email.com"
        placeholderTextColor="#555"
      />

      <TouchableOpacity style={styles.boton} onPress={guardar} disabled={guardando}>
        {guardando
          ? <ActivityIndicator color="#1a1a2e" />
          : <Text style={styles.botonTexto}>Guardar cambios</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  content: { padding: 24, paddingTop: Platform.OS === 'ios' ? 54 : 40 },
  header: { marginBottom: 32 },
  botonVolver: { marginBottom: 12 },
  botonVolverTexto: { color: '#FFD700', fontSize: 16 },
  titulo: { fontSize: 24, color: '#fff', fontWeight: 'bold' },
  fotoCirculo: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#16213e', borderWidth: 2, borderColor: '#FFD700',
    alignSelf: 'center', justifyContent: 'center', alignItems: 'center',
    marginBottom: 32,
  },
  fotoImg: { width: 100, height: 100, borderRadius: 50 },
  fotoTexto: { color: '#FFD700', fontSize: 13, textAlign: 'center' },
  label: { color: '#aaa', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: '#16213e', borderRadius: 10, padding: 14,
    color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#0f3460',
    marginBottom: 16,
  },
  boton: {
    backgroundColor: '#FFD700', borderRadius: 14, padding: 18,
    alignItems: 'center', marginTop: 8,
  },
  botonTexto: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 16 },
});
