import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://zas-backend-production-fb4e.up.railway.app';

export default function DocumentosUsuario() {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [fotoCedula, setFotoCedula] = useState('');

  const seleccionarFoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galeria'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.1, base64: true });
    if (!result.canceled) setFotoCedula(`data:image/jpeg;base64,${result.assets[0].base64}`);
  };

  const tomarFoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso requerido', 'Necesitamos acceso a tu camara'); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.1, base64: true });
    if (!result.canceled) setFotoCedula(`data:image/jpeg;base64,${result.assets[0].base64}`);
  };

  const guardarDocumentos = async () => {
    if (!fotoCedula) { Alert.alert('Error', 'Debes subir tu cedula'); return; }
    setCargando(true);
    try {
      const sesion = await AsyncStorage.getItem('usuario_sesion');
      if (!sesion) { Alert.alert('Error', 'No hay sesion activa'); return; }
      const usuario = JSON.parse(sesion);
      const res = await fetch(`${API_URL}/api/usuarios/documentos/${usuario.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foto_cedula: fotoCedula }),
      });
      const data = await res.json();
      if (data.ok) {
        Alert.alert('Exito', 'Documento enviado para revision', [{ text: 'OK', onPress: () => router.back() }]);
      } else {
        Alert.alert('Error', data.error || 'No se pudo guardar el documento');
      }
    } catch (e) { Alert.alert('Error', 'No se pudo conectar al servidor'); }
    finally { setCargando(false); }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.titulo}>Mi Documento</Text>
        <Text style={styles.subtitulo}>Sube tu cedula para verificar tu cuenta</Text>
      </View>

      <View style={styles.seccion}>
        <Text style={styles.seccionTitulo}>Cedula / ID</Text>
        {fotoCedula ? <Image source={{ uri: fotoCedula }} style={styles.preview} /> : null}
        <View style={styles.botonesFoto}>
          <TouchableOpacity style={styles.botonFoto} onPress={seleccionarFoto}>
            <Text style={styles.botonFotoTexto}>Galeria</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.botonFoto} onPress={tomarFoto}>
            <Text style={styles.botonFotoTexto}>Camara</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.botonGuardar} onPress={guardarDocumentos} disabled={cargando}>
        {cargando ? <ActivityIndicator color="#1a1a2e" /> : <Text style={styles.botonGuardarTexto}>Enviar documento</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.botonVolver} onPress={() => router.back()}>
        <Text style={styles.botonVolverTexto}>Volver</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: { padding: 24, paddingTop: 60 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#FFD700' },
  subtitulo: { fontSize: 14, color: '#888', marginTop: 4 },
  seccion: { backgroundColor: '#16213e', borderRadius: 16, padding: 16, margin: 16, marginBottom: 8 },
  seccionTitulo: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  preview: { width: '100%', height: 160, borderRadius: 10, marginBottom: 10, resizeMode: 'cover' },
  botonesFoto: { flexDirection: 'row', gap: 10 },
  botonFoto: { flex: 1, backgroundColor: '#0f3460', borderRadius: 10, padding: 12, alignItems: 'center' },
  botonFotoTexto: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  botonGuardar: { backgroundColor: '#FFD700', borderRadius: 14, padding: 18, alignItems: 'center', margin: 16 },
  botonGuardarTexto: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 16 },
  botonVolver: { backgroundColor: '#16213e', borderRadius: 14, padding: 14, alignItems: 'center', marginHorizontal: 16, marginBottom: 40 },
  botonVolverTexto: { color: '#888', fontWeight: 'bold', fontSize: 14 },
});