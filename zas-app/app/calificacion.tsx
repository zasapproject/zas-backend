import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

const API_URL = 'https://zas-backend-production-fb4e.up.railway.app';

export default function CalificacionScreen() {
  const router = useRouter();
  const { conductor_id } = useLocalSearchParams();
  const [estrellas, setEstrellas] = useState(0);
  const [cargando, setCargando] = useState(false);

  const enviarCalificacion = async () => {
    if (estrellas === 0) { Alert.alert('Error', 'Selecciona una calificación'); return; }
    console.log('conductor_id:', conductor_id);
    console.log('estrellas:', estrellas);
    setCargando(true);
    try {
      const res = await fetch(`${API_URL}/api/conductores/calificar/${conductor_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calificacion: estrellas }),
      });
      const data = await res.json();
      console.log('respuesta:', JSON.stringify(data));
      if (data.ok) {
        Alert.alert('¡Gracias!', 'Tu calificación fue enviada ⭐', [
          { text: 'OK', onPress: () => router.push('/home') }
        ]);
      } else {
        Alert.alert('Error', data.error || 'No se pudo enviar la calificación');
      }
    } catch (e) {
      console.log('error:', e);
      Alert.alert('Error', 'No se pudo conectar al servidor');
    } finally {
      setCargando(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>⚡ ZAS</Text>
        <Text style={styles.titulo}>¿Cómo fue tu viaje?</Text>
        <Text style={styles.subtitulo}>Califica a tu conductor</Text>
      </View>

      <View style={styles.estrellaContainer}>
        {[1, 2, 3, 4, 5].map((i) => (
          <TouchableOpacity key={i} onPress={() => setEstrellas(i)}>
            <Text style={[styles.estrella, i <= estrellas && styles.estrellaActiva]}>★</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.textoCalificacion}>
        {estrellas === 0 && 'Toca una estrella'}
        {estrellas === 1 && '😞 Muy malo'}
        {estrellas === 2 && '😐 Regular'}
        {estrellas === 3 && '🙂 Bueno'}
        {estrellas === 4 && '😊 Muy bueno'}
        {estrellas === 5 && '🤩 ¡Excelente!'}
      </Text>

      <TouchableOpacity style={styles.boton} onPress={enviarCalificacion} disabled={cargando}>
        {cargando ? <ActivityIndicator color="#1a1a2e" /> : <Text style={styles.botonTexto}>Enviar calificación</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.saltar} onPress={() => router.push('/home')}>
        <Text style={styles.saltarTexto}>Saltar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 28, fontWeight: 'bold', color: '#FFD700' },
  titulo: { fontSize: 24, color: '#fff', fontWeight: 'bold', marginTop: 16 },
  subtitulo: { fontSize: 16, color: '#aaa', marginTop: 8 },
  estrellaContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 20 },
  estrella: { fontSize: 50, color: '#333', marginHorizontal: 8 },
  estrellaActiva: { color: '#FFD700' },
  textoCalificacion: { color: '#fff', fontSize: 18, textAlign: 'center', marginBottom: 40 },
  boton: { backgroundColor: '#FFD700', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 16 },
  botonTexto: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 16 },
  saltar: { alignItems: 'center' },
  saltarTexto: { color: '#888', fontSize: 14 },
});