import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://zas-backend-production-fb4e.up.railway.app';

export default function DocumentosConductor() {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [fotoCedula, setFotoCedula] = useState('');
  const [fotoLicencia, setFotoLicencia] = useState('');
  const [fotoRegistro, setFotoRegistro] = useState('');

  const seleccionarFoto = async (setFoto: any) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galeria'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.1, base64: true });
    if (!result.canceled) setFoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
  };

  const tomarFoto = async (setFoto: any) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso requerido', 'Necesitamos acceso a tu camara'); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.1, base64: true });
    if (!result.canceled) setFoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
  };

  const subirDocumento = async (foto: string, campo: string) => {
    const sesion = await AsyncStorage.getItem('conductor_sesion');
    if (!sesion) return false;
    const conductor = JSON.parse(sesion);
    try {
      // Primero subir a Storage
      const resStorage = await fetch(`${API_URL}/api/storage/subir-foto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64: foto, nombre: `${campo}_${conductor.id}`, carpeta: 'documentos' }),
      });
      const dataStorage = await resStorage.json();
      if (!dataStorage.ok) return false;
      const url = dataStorage.url;

      // Luego guardar la URL
      const res = await fetch(`${API_URL}/api/conductores/documentos/${conductor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [campo]: url }),
      });
      const data = await res.json();
      if (!data.ok) Alert.alert('Error guardando', data.error || 'No se guardó la URL');
      return data.ok;
    } catch (e: any) { Alert.alert('Error storage', e.message || 'Error desconocido'); return false; }
  };

  const guardarDocumentos = async () => {
    if (!fotoCedula && !fotoLicencia && !fotoRegistro) {
      Alert.alert('Error', 'Debes subir al menos un documento');
      return;
    }
    setCargando(true);
    try {
      let exito = true;
      if (fotoCedula) {
        const ok = await subirDocumento(fotoCedula, 'foto_cedula');
        if (!ok) exito = false;
      }
      if (fotoLicencia) {
        const ok = await subirDocumento(fotoLicencia, 'foto_licencia');
        if (!ok) exito = false;
      }
      if (fotoRegistro) {
        const ok = await subirDocumento(fotoRegistro, 'foto_registro_moto');
        if (!ok) exito = false;
      }
      if (exito) {
        Alert.alert('✅ Éxito', 'Documentos enviados para revisión', [{ text: 'OK', onPress: () => router.back() }]);
      } else {
        Alert.alert('Error', 'Algunos documentos no se pudieron guardar');
      }
    } catch (e) { Alert.alert('Error', 'No se pudo conectar al servidor'); }
    finally { setCargando(false); }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.titulo}>Mis Documentos</Text>
        <Text style={styles.subtitulo}>Sube tus documentos para verificar tu cuenta</Text>
      </View>

      <View style={styles.seccion}>
        <Text style={styles.seccionTitulo}>Cedula / ID</Text>
        {fotoCedula ? <Image source={{ uri: fotoCedula }} style={styles.preview} /> : null}
        <View style={styles.botonesFoto}>
          <TouchableOpacity style={styles.botonFoto} onPress={() => seleccionarFoto(setFotoCedula)}>
            <Text style={styles.botonFotoTexto}>Galeria</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.botonFoto} onPress={() => tomarFoto(setFotoCedula)}>
            <Text style={styles.botonFotoTexto}>Camara</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.seccion}>
        <Text style={styles.seccionTitulo}>Licencia de conducir</Text>
        {fotoLicencia ? <Image source={{ uri: fotoLicencia }} style={styles.preview} /> : null}
        <View style={styles.botonesFoto}>
          <TouchableOpacity style={styles.botonFoto} onPress={() => seleccionarFoto(setFotoLicencia)}>
            <Text style={styles.botonFotoTexto}>Galeria</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.botonFoto} onPress={() => tomarFoto(setFotoLicencia)}>
            <Text style={styles.botonFotoTexto}>Camara</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.seccion}>
        <Text style={styles.seccionTitulo}>Registro de la moto</Text>
        {fotoRegistro ? <Image source={{ uri: fotoRegistro }} style={styles.preview} /> : null}
        <View style={styles.botonesFoto}>
          <TouchableOpacity style={styles.botonFoto} onPress={() => seleccionarFoto(setFotoRegistro)}>
            <Text style={styles.botonFotoTexto}>Galeria</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.botonFoto} onPress={() => tomarFoto(setFotoRegistro)}>
            <Text style={styles.botonFotoTexto}>Camara</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.botonGuardar} onPress={guardarDocumentos} disabled={cargando}>
        {cargando ? <ActivityIndicator color="#1a1a2e" /> : <Text style={styles.botonGuardarTexto}>Enviar documentos</Text>}
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