import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRouter, useLocalSearchParams } from 'expo-router';

const API_URL = 'https://zas-backend-production-fb4e.up.railway.app';
const GOOGLE_MAPS_KEY = 'AIzaSyBRIoMFetJDcqNWyXe2hWhQy4_FSgW8n1I';

export default function MapaViajeScreen() {
  const router = useRouter();
  const { viaje_id, conductor_id, es_conductor } = useLocalSearchParams();
  const mapRef = useRef(null);

  const [ubicacionActual, setUbicacionActual] = useState(null);
  const [rutaCoordenadas, setRutaCoordenadas] = useState([]);
  const [viaje, setViaje] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [estado, setEstado] = useState('en_camino'); // en_camino | recogiendo | en_ruta

  // Obtener ubicación actual
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Necesitamos tu ubicación para mostrar el mapa');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setUbicacionActual(loc.coords);
    })();
  }, []);

  // Actualizar ubicación conductor cada 5 segundos
  useEffect(() => {
    if (!es_conductor || !conductor_id) return;
    const interval = setInterval(async () => {
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        await fetch(`${API_URL}/api/conductores/ubicacion/${conductor_id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: loc.coords.latitude, lng: loc.coords.longitude }),
        });
        setUbicacionActual(loc.coords);
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [es_conductor, conductor_id]);

  // Cargar viaje
  useEffect(() => {
    if (!viaje_id) return;
    const cargar = async () => {
      try {
        const res = await fetch(`${API_URL}/api/viajes/detalle/${viaje_id}`);
        const data = await res.json();
        if (data.ok) setViaje(data.viaje);
      } catch {}
      finally { setCargando(false); }
    };
    cargar();
    const interval = setInterval(cargar, 8000);
    return () => clearInterval(interval);
  }, [viaje_id]);

  // Obtener ruta de Google Maps
  useEffect(() => {
    if (!ubicacionActual || !viaje) return;
    obtenerRuta();
  }, [ubicacionActual, viaje]);

  const obtenerRuta = async () => {
    if (!ubicacionActual || !viaje) return;
    try {
      const origen = `${ubicacionActual.latitude},${ubicacionActual.longitude}`;
      const destino = estado === 'en_camino'
        ? `${viaje.origen_lat},${viaje.origen_lng}`
        : `${viaje.destino_lat},${viaje.destino_lng}`;

      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origen}&destination=${destino}&key=${GOOGLE_MAPS_KEY}&mode=driving`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.routes?.length > 0) {
        const puntos = decodePolyline(data.routes[0].overview_polyline.points);
        setRutaCoordenadas(puntos);
      }
    } catch {}
  };

  const decodePolyline = (encoded) => {
    const poly = [];
    let index = 0, lat = 0, lng = 0;
    while (index < encoded.length) {
      let b, shift = 0, result = 0;
      do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      lat += (result & 1) ? ~(result >> 1) : result >> 1;
      shift = 0; result = 0;
      do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      lng += (result & 1) ? ~(result >> 1) : result >> 1;
      poly.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return poly;
  };

  const llegue = async () => {
    if (estado === 'en_camino') {
      setEstado('recogiendo');
      Alert.alert('✅ Llegaste al usuario', 'Espera que suba a la moto');
    } else {
      setEstado('en_ruta');
      await fetch(`${API_URL}/api/viajes/estado/${viaje_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'en_curso' }),
      });
    }
    obtenerRuta();
  };

  const completarViaje = async () => {
    await fetch(`${API_URL}/api/viajes/estado/${viaje_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'completado' }),
    });
    Alert.alert('🎉 ¡Viaje completado!', 'Gracias por usar ZAS');
    router.back();
  };

  if (cargando || !ubicacionActual) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator color="#FFD700" size="large" />
        <Text style={styles.cargandoTexto}>Cargando mapa...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.mapa}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: ubicacionActual.latitude,
          longitude: ubicacionActual.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation
        showsMyLocationButton
      >
        {/* Ruta */}
        {rutaCoordenadas.length > 0 && (
          <Polyline coordinates={rutaCoordenadas} strokeColor="#FFD700" strokeWidth={4} />
        )}

        {/* Marcador conductor */}
        {ubicacionActual && (
          <Marker coordinate={{ latitude: ubicacionActual.latitude, longitude: ubicacionActual.longitude }} title="Tu ubicación">
            <View style={styles.marcadorConductor}>
              <Text style={styles.marcadorIcon}>🏍️</Text>
            </View>
          </Marker>
        )}

        {/* Marcador origen (usuario) */}
        {viaje?.origen_lat && (
          <Marker coordinate={{ latitude: viaje.origen_lat, longitude: viaje.origen_lng }} title="Usuario" description={viaje.origen}>
            <View style={styles.marcadorUsuario}>
              <Text style={styles.marcadorIcon}>👤</Text>
            </View>
          </Marker>
        )}

        {/* Marcador destino */}
        {viaje?.destino_lat && (
          <Marker coordinate={{ latitude: viaje.destino_lat, longitude: viaje.destino_lng }} title="Destino" description={viaje.destino}>
            <View style={styles.marcadorDestino}>
              <Text style={styles.marcadorIcon}>📍</Text>
            </View>
          </Marker>
        )}
      </MapView>

      {/* Panel inferior */}
      <View style={styles.panel}>
        <Text style={styles.panelEstado}>
          {estado === 'en_camino' ? '🏍️ Yendo a recoger usuario' :
           estado === 'recogiendo' ? '👤 Esperando al usuario' :
           '🚀 En ruta al destino'}
        </Text>
        {viaje && (
          <View style={styles.panelInfo}>
            <Text style={styles.panelTexto}>📍 {estado === 'en_camino' ? viaje.origen : viaje.destino}</Text>
            <Text style={styles.panelPrecio}>${viaje.precio?.toLocaleString()} COP</Text>
          </View>
        )}

        {es_conductor && estado !== 'en_ruta' && (
          <TouchableOpacity style={styles.botonLlegue} onPress={llegue}>
            <Text style={styles.botonTexto}>
              {estado === 'en_camino' ? '✅ Llegué al usuario' : '🚀 Iniciar viaje'}
            </Text>
          </TouchableOpacity>
        )}

        {es_conductor && estado === 'en_ruta' && (
          <TouchableOpacity style={styles.botonCompletar} onPress={completarViaje}>
            <Text style={styles.botonTexto}>🎉 Completar viaje</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.botonVolver} onPress={() => router.back()}>
          <Text style={styles.botonVolverTexto}>← Volver</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centrado: { flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' },
  cargandoTexto: { color: '#888', marginTop: 16 },
  mapa: { flex: 1 },
  marcadorConductor: { backgroundColor: '#FFD700', borderRadius: 20, padding: 6 },
  marcadorUsuario: { backgroundColor: '#00c853', borderRadius: 20, padding: 6 },
  marcadorDestino: { backgroundColor: '#ff1744', borderRadius: 20, padding: 6 },
  marcadorIcon: { fontSize: 20 },
  panel: { backgroundColor: '#1a1a2e', padding: 20, paddingBottom: 36 },
  panelEstado: { color: '#FFD700', fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  panelInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  panelTexto: { color: '#fff', fontSize: 14, flex: 1 },
  panelPrecio: { color: '#FFD700', fontSize: 16, fontWeight: 'bold' },
  botonLlegue: { backgroundColor: '#00c853', borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 10 },
  botonCompletar: { backgroundColor: '#FFD700', borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 10 },
  botonTexto: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 15 },
  botonVolver: { alignItems: 'center', padding: 8 },
  botonVolverTexto: { color: '#888', fontSize: 13 },
});