import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';

const GOOGLE_MAPS_KEY = 'AIzaSyCeqK-QCWzpkhUW5SIzB_FkFOrhV3AAIms';

export default function MapaScreen() {
  const router = useRouter();
  const [location, setLocation] = useState(null);
  const [origen, setOrigen] = useState(null);
  const [destino, setDestino] = useState(null);
  const [paso, setPaso] = useState('origen');
  const [ruta, setRuta] = useState([]);
  const [distancia, setDistancia] = useState('');
  const [duracion, setDuracion] = useState('');

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

  const obtenerRuta = async (org, dest) => {
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${org.latitude},${org.longitude}&destination=${dest.latitude},${dest.longitude}&key=${GOOGLE_MAPS_KEY}&mode=driving`
      );
      const data = await res.json();
      if (data.routes.length > 0) {
        const puntos = decodePolyline(data.routes[0].overview_polyline.points);
        setRuta(puntos);
        setDistancia(data.routes[0].legs[0].distance.text);
        setDuracion(data.routes[0].legs[0].duration.text);
      }
    } catch {
      Alert.alert('Error', 'No se pudo obtener la ruta');
    }
  };

  const decodePolyline = (encoded) => {
    let index = 0, lat = 0, lng = 0;
    const result = [];
    while (index < encoded.length) {
      let shift = 0, result2 = 0, b;
      do { b = encoded.charCodeAt(index++) - 63; result2 |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      lat += result2 & 1 ? ~(result2 >> 1) : result2 >> 1;
      shift = 0; result2 = 0;
      do { b = encoded.charCodeAt(index++) - 63; result2 |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      lng += result2 & 1 ? ~(result2 >> 1) : result2 >> 1;
      result.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return result;
  };

  const seleccionarPunto = (e) => {
    const coords = e.nativeEvent.coordinate;
    if (paso === 'origen') {
      setOrigen(coords);
      setPaso('destino');
      Alert.alert('Origen seleccionado', 'Ahora toca el destino en el mapa');
    } else if (paso === 'destino') {
      setDestino(coords);
      setPaso('listo');
      obtenerRuta(origen, coords);
    }
  };

  const reiniciar = () => {
    setOrigen(null);
    setDestino(null);
    setRuta([]);
    setDistancia('');
    setDuracion('');
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
          {paso === 'listo' && `✅ ${distancia} · ${duracion}`}
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
          {ruta.length > 0 && (
            <Polyline coordinates={ruta} strokeColor="#FFD700" strokeWidth={4} />
          )}
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