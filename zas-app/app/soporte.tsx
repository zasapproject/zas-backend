import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, TextInput, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://zas-backend-production-fb4e.up.railway.app';

export default function Soporte() {
  const router = useRouter();
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviarMensaje = async () => {
    if (!mensaje.trim()) { Alert.alert('Error', 'Escribe tu problema antes de enviar'); return; }
    setEnviando(true);
    try {
      const usuarioSesion = await AsyncStorage.getItem('usuario_sesion');
      const conductorSesion = await AsyncStorage.getItem('conductor_sesion');
      const sesion = usuarioSesion ? JSON.parse(usuarioSesion) : conductorSesion ? JSON.parse(conductorSesion) : null;
      const tipo = usuarioSesion ? 'usuario' : 'conductor';
      const res = await fetch(`${API_URL}/api/soporte/nuevo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: sesion?.nombre || 'Desconocido',
          telefono: sesion?.telefono || '',
          tipo,
          mensaje: mensaje.trim(),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        Alert.alert('✅ Mensaje enviado', 'Nuestro equipo te contactará pronto.', [{ text: 'OK', onPress: () => router.back() }]);
        setMensaje('');
      } else {
        Alert.alert('Error', data.error || 'No se pudo enviar');
      }
    } catch { Alert.alert('Error', 'No se pudo conectar al servidor'); }
    finally { setEnviando(false); }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Text style={styles.titulo}>🆘 Soporte Técnico</Text>
      <Text style={styles.subtitulo}>Estamos aquí para ayudarte</Text>

      {/* Contacto directo */}
      <View style={styles.seccion}>
        <Text style={styles.seccionTitulo}>Contacto directo</Text>
        <TouchableOpacity style={styles.botonContacto} onPress={() => Linking.openURL('https://wa.me/573113003100?text=Hola,%20necesito%20ayuda%20con%20ZAS')}>
          <Text style={styles.botonContactoTexto}>💬 WhatsApp</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.botonContacto, { backgroundColor: '#00c853' }]} onPress={() => Linking.openURL('tel:573113003100')}>
          <Text style={styles.botonContactoTexto}>📞 Llamar</Text>
        </TouchableOpacity>
      </View>

      {/* Formulario */}
      <View style={styles.seccion}>
        <Text style={styles.seccionTitulo}>Escribir problema</Text>
        <Text style={styles.label}>Describe tu problema</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Cuéntanos qué pasó..."
          placeholderTextColor="#888"
          value={mensaje}
          onChangeText={setMensaje}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />
        <TouchableOpacity style={styles.botonEnviar} onPress={enviarMensaje} disabled={enviando}>
          {enviando ? <ActivityIndicator color="#1a1a2e" /> : <Text style={styles.botonEnviarTexto}>Enviar mensaje</Text>}
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.linkTexto}>Volver</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  scroll: { padding: 24, paddingTop: 60 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#FFD700', marginBottom: 4 },
  subtitulo: { fontSize: 14, color: '#888', marginBottom: 24 },
  seccion: { backgroundColor: '#16213e', borderRadius: 16, padding: 16, marginBottom: 16 },
  seccionTitulo: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  botonContacto: { backgroundColor: '#075e54', borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 10 },
  botonContactoTexto: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  label: { color: '#aaa', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  textArea: { backgroundColor: '#0f3460', borderRadius: 10, padding: 14, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#0f3460', minHeight: 120, marginBottom: 12 },
  botonEnviar: { backgroundColor: '#FFD700', borderRadius: 12, padding: 16, alignItems: 'center' },
  botonEnviarTexto: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 16 },
  linkTexto: { color: '#888', textAlign: 'center', marginTop: 12, fontSize: 14 },
});