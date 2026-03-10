import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';

export default function MapaScreen() {
  const router = useRouter();
  const [location, setLocation] = useState(null);
  const [origen, setOrigen] = useState(null);
  const [destino, setDestino] = useState(null);
  const [paso, setPaso] = useState('origen');

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Necesitamos acceso a tu ubicación');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    })();
  }, []);

  const seleccionarPunto = (e) => {
    const coords = e.nativeEvent.coordinate;
    if (paso === 'origen') {
      setOrigen(coords);
      setPaso('destino');
      Alert.alert('Origen seleccionado', 'Ahora toca el destino en el mapa');
    } else {
      setDestino(coords);
      setPaso('listo');
    }
  };

  const reiniciar = () => {
    setOrigen(null);
    setDestino(null);
    setPaso('origen');
  };

  const solicitarViaje = async () => {
    if (!origen || !destino) return;
    try {
      const res = await fetch('https://zas-backend-production-fb4e.up.railway.app/api/viajes/nuevo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_id: '1ce45e4f-a59f-4c15-815e-f699da05c219',
          origen: `${origen.latitude.toFixed(4)}, ${origen.longitude.toFixed(4)}`,
          destino: `${destino.latitude.toFixed(4)}, ${destino.longitude.toFixed(4)}`,
          origen_lat: origen.latitude,
          origen_lng: origen.longitude,
          destino_lat: destino.latitude,
          destino_lng: destino.longitude,
          precio: 4000,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        Alert.alert('¡Viaje solicitado!', 'Buscando conductor cercano... 🏍️', [
          { text: 'OK', onPress: () => router.push('/home') }
        ]);
      } else {
        Alert.alert('Error', data.error || 'No se pudo solicitar el viaje');
      }
    } catch {
      Alert.alert('Error', 'No se pudo conectar al servidor');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>⚡ ZAS</Text>
        <Text style={styles.instruccion}>
          {paso === 'origen' && '📍 Toca el mapa para marcar tu origen'}
          {paso === 'destino' && '🔴 Ahora toca el destino'}
          {paso === 'listo' && '✅ Ruta lista'}
        </Text>
      </View>

      {location ? (
        <MapView
          style={styles.mapa}
          provider={PROVIDER_GOOGLE}
          initialRegion={location}
          onPress={seleccionarPunto}
        >
          {origen && <Marker coordinate={origen} title="Origen" pinColor="green" />}
          {destino && <Marker coordinate={destino} title="Destino" pinColor="red" />}
        </MapView>
      ) : (
        <View style={styles.cargando}>
          <Text style={styles.cargandoTexto}>Cargando mapa... 📍</Text>
        </View>
      )}

      {paso === 'listo' && (
        <View style={styles.botones}>
          <TouchableOpacity style={styles.botonSolicitar} onPress={solicitarViaje}>
            <Text style={styles.botonTexto}>🏍️ Solicitar ZAS</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.botonReiniciar} onPress={reiniciar}>
            <Text style={styles.botonReiniciarTexto}>Reiniciar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: { padding: 20, paddingTop: 50 },
  logo: { fontSize: 24, fontWeight: 'bold', color: '#FFD700' },
  instruccion: { color: '#fff', fontSize: 15, marginTop: 6 },
  mapa: { flex: 1 },
  cargando: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cargandoTexto: { color: '#fff', fontSize: 16 },
  botones: { padding: 16, gap: 10 },
  botonSolicitar: { backgroundColor: '#FFD700', borderRadius: 10, padding: 16, alignItems: 'center' },
  botonTexto: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 16 },
  botonReiniciar: { borderWidth: 1, borderColor: '#888', borderRadius: 10, padding: 14, alignItems: 'center' },
  botonReiniciarTexto: { color: '#888', fontSize: 14 },
});