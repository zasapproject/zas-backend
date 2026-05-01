import React, { useEffect, useRef, useState, useCallback } from 'react';
import SubirComprobante from './SubirComprobante';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking, ActivityIndicator, Platform, Animated, Image, ScrollView } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';

const BACKEND_URL = 'https://zasapps.com';
const GOOGLE_MAPS_API_KEY = 'AIzaSyBypfJWtZn_XRZBIl_bc18nncTMor2988Q';
const GOOGLE_SERVER_KEY = 'AIzaSyBRIoMFetJDcqNWyXe2hWhQy4_FSgW8n1I';
const POLLING_INTERVAL = 4000;

function decodificarPolyline(encoded) {
  const poly = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let shift = 0, result = 0, byte;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    poly.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return poly;
}

async function geocodificar(direccion) {
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(direccion + ', Venezuela')}&key=${GOOGLE_SERVER_KEY}`);
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      const loc = data.results[0].geometry.location;
      return { latitude: loc.lat, longitude: loc.lng };
    }
  } catch (e) {}
  return null;
}

async function obtenerRuta(origen, destino) {
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/directions/json?origin=${origen.latitude},${origen.longitude}&destination=${destino.latitude},${destino.longitude}&mode=driving&key=${GOOGLE_SERVER_KEY}`);
    const data = await res.json();
    if (data.routes && data.routes.length > 0) return decodificarPolyline(data.routes[0].overview_polyline.points);
  } catch (e) {}
  return [];
}

async function actualizarUbicacionConductor(conductorId, coords) {
  try {
    await fetch(`${BACKEND_URL}/api/conductores/ubicacion`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conductor_id: conductorId, latitud: coords.latitude, longitud: coords.longitude }) });
  } catch (e) {}
}

async function obtenerUbicacionConductor(conductorId) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/conductores/ubicacion/${conductorId}`);
    const data = await res.json();
    if (data.latitud && data.longitud) return { latitude: Number(data.latitud), longitude: Number(data.longitud) };
  } catch (e) {}
  return null;
}

async function obtenerEstadoViaje(viajeId) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/viajes/${viajeId}`);
    const data = await res.json();
    return data.viaje?.estado || data.estado || null;
  } catch (e) {}
  return null;
}

export default function MapaViaje() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const mapRef = useRef(null);
  const pollingRef = useRef(null);
  const locationSub = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const esCondutorRef = useRef(params.rol === 'conductor');
  const conductorIdRef = useRef(params.conductor_id || '');
  const viajeIdRef = useRef(params.viaje_id || '');
  const metodoPagoRef = useRef(String(params.metodo_pago || 'efectivo').trim());
  const pagoIdRef = useRef(String(params.pago_id || '').trim());
  const datosZasRef = useRef(params.datos_zas ? String(params.datos_zas) : '');
  const montoViajeRef = useRef(Number(params.monto_viaje) || 0);

  const esCondutor = params.rol === 'conductor';

  const [miUbicacion, setMiUbicacion] = useState(null);
  const [ubicacionConductor, setUbicacionConductor] = useState(null);
  const [coordOrigen, setCoordOrigen] = useState(null);
  const [coordDestino, setCoordDestino] = useState(null);
  const [ruta, setRuta] = useState([]);
  const [estadoViaje, setEstadoViaje] = useState('aceptado');
  const estadoViajeRef = useRef('aceptado');
  const [cargando, setCargando] = useState(true);
  const [etaTexto, setEtaTexto] = useState('Calculando...');
  const [mostrarComprobante, setMostrarComprobante] = useState(false);
  const [pagoId, setPagoId] = useState<string | null>(null);
  const [datosZas, setDatosZas] = useState<any>(null);
  const [montoViaje, setMontoViaje] = useState<number>(0);
  const [metodoViaje, setMetodoViaje] = useState<string>('efectivo');
  const [mostrarPagoEfectivo, setMostrarPagoEfectivo] = useState(false);
  const [mostrarCalificacion, setMostrarCalificacion] = useState(false);
  const [calificacionTitulo, setCalificacionTitulo] = useState('');
  const coordOrigenRef = useRef(null);
  const coordDestinoRef = useRef(null);
  const miUbicacionRef = useRef(null);

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.3, duration: 800, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
    ])).start();
  }, []);

  useEffect(() => {
    inicializar();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (locationSub.current) locationSub.current.remove();
    };
  }, []);

  async function inicializar() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso requerido', 'Necesitamos acceso a tu ubicacion'); setCargando(false); return; }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    setMiUbicacion(coords);
    miUbicacionRef.current = coords;

    if (params.origen_lat && params.destino_lat) {
      const cOrig = { latitude: Number(params.origen_lat), longitude: Number(params.origen_lng) };
      const cDest = { latitude: Number(params.destino_lat), longitude: Number(params.destino_lng) };
      setCoordOrigen(cOrig);
      setCoordDestino(cDest);
      coordOrigenRef.current = cOrig;
      coordDestinoRef.current = cDest;
      actualizarRuta(cOrig, cDest);
    } else if (params.origen && params.destino) {
      const [cOrig, cDest] = await Promise.all([geocodificar(params.origen), geocodificar(params.destino)]);
      setCoordOrigen(cOrig);
      setCoordDestino(cDest);
      coordOrigenRef.current = cOrig;
      coordDestinoRef.current = cDest;
      if (cOrig && cDest) actualizarRuta(cOrig, cDest);
    }

    if (esCondutorRef.current && conductorIdRef.current) {
      locationSub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
        (newLoc) => {
          const c = { latitude: newLoc.coords.latitude, longitude: newLoc.coords.longitude };
          setMiUbicacion(c);
          miUbicacionRef.current = c;
          actualizarUbicacionConductor(conductorIdRef.current, c);
        }
      );
    }

    iniciarPolling();
    setCargando(false);
  }

  const actualizarRuta = useCallback(async (desde, hasta) => {
    const pts = await obtenerRuta(desde, hasta);
    setRuta(pts);
    if (pts.length > 1 && mapRef.current) mapRef.current.fitToCoordinates(pts, { edgePadding: { top: 80, right: 40, bottom: 220, left: 40 }, animated: true });
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?origins=${desde.latitude},${desde.longitude}&destinations=${hasta.latitude},${hasta.longitude}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`);
      const data = await res.json();
      const elem = data.rows?.[0]?.elements?.[0];
      if (elem?.status === 'OK') setEtaTexto(elem.duration.text);
    } catch (_) {}
  }, []);

  function iniciarPolling() {
    pollingRef.current = setInterval(async () => {
      const viajeId = viajeIdRef.current;
      if (!viajeId) return;

      const estado = await obtenerEstadoViaje(viajeId);
      if (!estado) return;

      setEstadoViaje(estado);
      estadoViajeRef.current = estado;

      if (estado === 'completado' || estado === 'cancelado') {
        if (pollingRef.current) clearInterval(pollingRef.current);
        if (locationSub.current) locationSub.current.remove();

        if (estado === 'cancelado') {
          Alert.alert('Viaje cancelado', '', [{ text: 'OK', onPress: () => router.replace(esCondutorRef.current ? '/conductor' : '/home') }]);
          return;
        }

        if (esCondutorRef.current) {
          setCalificacionTitulo('¿Cómo fue el usuario?');
          setMostrarCalificacion(true);
        } else {
          const metodo = metodoPagoRef.current;
          const pId = pagoIdRef.current;
          if (metodo && metodo !== 'efectivo' && metodo !== '') {
            setPagoId(pId || null);
            setMontoViaje(montoViajeRef.current);
            setMetodoViaje(metodo);
            try {
              const resDatos = await fetch(`${BACKEND_URL}/api/pagos/datos-pago/${metodo}`);
              const jsonDatos = await resDatos.json();
              setDatosZas(jsonDatos.ok ? jsonDatos.datos : null);
            } catch { setDatosZas(null); }
            setMostrarComprobante(true);
          } else {
            setMostrarPagoEfectivo(true);
          }
        }
        return;
      }

      if (!esCondutorRef.current && conductorIdRef.current) {
        const ubicCond = await obtenerUbicacionConductor(conductorIdRef.current);
        if (ubicCond) {
          setUbicacionConductor(ubicCond);
          const ev = estadoViajeRef.current;
          if ((ev === 'aceptado' || ev === 'en_camino') && coordOrigenRef.current) {
            await actualizarRuta(ubicCond, coordOrigenRef.current);
          } else if (ev === 'en_curso' && coordDestinoRef.current) {
            await actualizarRuta(ubicCond, coordDestinoRef.current);
          }
        }
      }

      if (esCondutorRef.current) {
        const ubicActual = miUbicacionRef.current;
        const ev = estadoViajeRef.current;
        if (ubicActual) {
          if ((ev === 'aceptado' || ev === 'en_camino') && coordOrigenRef.current) {
            await actualizarRuta(ubicActual, coordOrigenRef.current);
          } else if (ev === 'en_curso' && coordDestinoRef.current) {
            await actualizarRuta(ubicActual, coordDestinoRef.current);
          }
        }
      }
    }, POLLING_INTERVAL);
  }

  function getCodigoPais(tel) {
    if (!tel) return '57';
    const limpio = tel.replace(/\D/g, '');
    if (limpio.startsWith('04') || limpio.startsWith('58')) return '58';
    return '57';
  }

  function llamar(tel) { if (tel) Linking.openURL(`tel:+${getCodigoPais(tel)}${tel.replace(/\D/g, '')}`); }

  function whatsapp(tel) {
    if (!tel) { Alert.alert('Sin número', 'No se encontró el número de teléfono.'); return; }
    const limpio = tel.replace(/\D/g, '');
    const codigo = getCodigoPais(tel);
    Linking.openURL(`https://wa.me/${codigo}${limpio}`).catch(() => {
      Alert.alert('Error', 'No se pudo abrir WhatsApp. Verifica que esté instalado.');
    });
  }

  function sms(tel) { if (tel) Linking.openURL(`sms:+${getCodigoPais(tel)}${tel.replace(/\D/g, '')}`); }

  async function iniciarViaje() {
    Alert.alert('Iniciar viaje?', 'Confirma que el pasajero esta contigo.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Iniciar', onPress: async () => {
        await fetch(`${BACKEND_URL}/api/viajes/estado/${viajeIdRef.current}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado: 'en_curso' })
        });
        setEstadoViaje('en_curso');
        estadoViajeRef.current = 'en_curso';
      }},
    ]);
  }

  async function cancelarViaje() {
    Alert.alert('Cancelar viaje', '¿Estás seguro?', [
      { text: 'No', style: 'cancel' },
      { text: 'Sí, cancelar', style: 'destructive', onPress: async () => {
        if (pollingRef.current) clearInterval(pollingRef.current);
        if (locationSub.current) locationSub.current.remove();
        await fetch(`${BACKEND_URL}/api/viajes/estado/${viajeIdRef.current}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado: 'cancelado' })
        });
        router.replace(esCondutorRef.current ? '/conductor' : '/home');
      }},
    ]);
  }

  async function calificar(estrellas) {
    try {
      const idCalificar = esCondutorRef.current ? params.usuario_id : params.conductor_id;
      const rutaApi = esCondutorRef.current ? 'usuarios' : 'conductores';
      await fetch(`${BACKEND_URL}/api/${rutaApi}/calificar/${idCalificar}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calificacion: estrellas })
      });
    } catch {}
    router.replace(esCondutorRef.current ? '/conductor' : '/home');
  }

  // ─── FIX: detener polling ANTES del fetch para evitar interferencia ───
  async function terminarViaje() {
    Alert.alert('Terminar viaje?', 'Confirma que llegaste al destino.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Terminar', onPress: async () => {
        if (pollingRef.current) clearInterval(pollingRef.current);
        if (locationSub.current) locationSub.current.remove();
        await fetch(`${BACKEND_URL}/api/viajes/estado/${viajeIdRef.current}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado: 'completado' })
        });
        setCalificacionTitulo('¿Cómo fue el usuario?');
        setMostrarCalificacion(true);
      }},
    ]);
  }

  const regionInicial = miUbicacion
    ? { latitude: miUbicacion.latitude, longitude: miUbicacion.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }
    : { latitude: 4.7110, longitude: -74.0721, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  const etiquetaEstado = () => {
    if (esCondutor) {
      if (estadoViaje === 'aceptado' || estadoViaje === 'en_camino') return 'Ve hacia el usuario';
      if (estadoViaje === 'en_curso') return 'Lleva al pasajero al destino';
    } else {
      if (estadoViaje === 'aceptado' || estadoViaje === 'en_camino') return 'Mototaxi en camino';
      if (estadoViaje === 'en_curso') return 'En viaje al destino';
    }
    return '';
  };

  const telefonoOtro = esCondutor ? params.usuario_telefono : params.conductor_telefono;
  const nombreOtro = esCondutor ? params.usuario_nombre : params.conductor_nombre;
  const fotoOtro = esCondutor ? params.usuario_foto : params.conductor_foto;

  if (cargando) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#F5A623" /><Text style={styles.loadingText}>Cargando mapa...</Text></View>;
  }

  if (mostrarCalificacion) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ fontSize: 60, marginBottom: 20 }}>🏍</Text>
        <Text style={{ color: '#FFD700', fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 }}>
          {calificacionTitulo}
        </Text>
        <Text style={{ color: '#888', fontSize: 14, textAlign: 'center', marginBottom: 32 }}>
          Tu opinión ayuda a mejorar el servicio
        </Text>
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 32 }}>
          {[1, 2, 3, 4, 5].map(estrella => (
            <TouchableOpacity
              key={estrella}
              style={{ backgroundColor: '#16213e', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#FFD700', minWidth: 52 }}
              onPress={() => { setMostrarCalificacion(false); calificar(estrella); }}
            >
              <Text style={{ fontSize: 24 }}>⭐</Text>
              <Text style={{ color: '#FFD700', fontWeight: 'bold', fontSize: 14, marginTop: 4 }}>{estrella}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={{ padding: 12 }} onPress={() => { setMostrarCalificacion(false); calificar(5); }}>
          <Text style={{ color: '#555', fontSize: 13 }}>Saltar calificación</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (mostrarPagoEfectivo) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ fontSize: 60, marginBottom: 20 }}>💵</Text>
        <Text style={{ color: '#FFD700', fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 }}>
          Pago en efectivo
        </Text>
        <Text style={{ color: '#fff', fontSize: 16, textAlign: 'center', marginBottom: 8 }}>
          Recuerda pagar al conductor:
        </Text>
        <Text style={{ color: '#FFD700', fontSize: 32, fontWeight: 'bold', marginBottom: 32 }}>
          ${montoViajeRef.current || params.monto_viaje || '0'}
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: '#FFD700', borderRadius: 14, padding: 18, width: '100%', alignItems: 'center', marginBottom: 12 }}
          onPress={() => {
            setMostrarPagoEfectivo(false);
            setCalificacionTitulo('¿Cómo fue tu conductor?');
            setMostrarCalificacion(true);
          }}
        >
          <Text style={{ color: '#1A1A2E', fontWeight: 'bold', fontSize: 16 }}>✅ Ya pagué al conductor</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (mostrarComprobante) {
    return (
      <SubirComprobante
        pagoId={pagoId}
        metodo={metodoViaje}
        monto={montoViaje}
        datosZas={datosZas}
        onComprobanteEnviado={() => {
          setMostrarComprobante(false);
          setCalificacionTitulo('¿Cómo fue tu conductor?');
          setMostrarCalificacion(true);
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <MapView ref={mapRef} style={styles.map} provider={PROVIDER_GOOGLE} initialRegion={regionInicial}>
        {miUbicacion && (
          <Marker coordinate={miUbicacion} anchor={{ x: 0.5, y: 0.5 }}>
            <Text style={{ fontSize: 28 }}>{esCondutor ? (estadoViaje === 'en_curso' ? '🏍' : '🏍🧍') : '🧍'}</Text>
          </Marker>
        )}
        {!esCondutor && ubicacionConductor && (
          <Marker coordinate={ubicacionConductor} anchor={{ x: 0.5, y: 0.5 }}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Text style={{ fontSize: 28 }}>{estadoViaje === 'en_curso' ? '🏍' : '🏍🧍'}</Text>
            </Animated.View>
          </Marker>
        )}
        {coordOrigen && <Marker coordinate={coordOrigen} title="Origen" pinColor="#F5A623" />}
        {coordDestino && <Marker coordinate={coordDestino} title="Destino" pinColor="#E53935" />}
        {ruta.length > 1 && <Polyline coordinates={ruta} strokeColor="#F5A623" strokeWidth={4} />}
      </MapView>

      <View style={styles.bannerEstado}>
        <Text style={styles.bannerTexto}>{etiquetaEstado()}</Text>
        <Text style={styles.etaTexto}>{etaTexto}</Text>
      </View>

      <View style={styles.cardInferior}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.infoRow}>
            {fotoOtro ? (
              <Image source={{ uri: fotoOtro }} style={styles.fotoCircle} />
            ) : (
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarLetra}>{nombreOtro ? nombreOtro[0].toUpperCase() : '?'}</Text>
              </View>
            )}
            <View style={styles.infoTextos}>
              <Text style={styles.nombreOtro}>{esCondutor ? 'Usuario' : 'Conductor'}</Text>
              <Text style={styles.nombreOtroValor}>{nombreOtro || '-'}</Text>
              {!esCondutor && params.conductor_placa ? <Text style={styles.placaTexto}>{params.conductor_modelo} - {params.conductor_placa}</Text> : null}
            </View>
          </View>

          <View style={styles.rutaInfo}>
            <View style={styles.rutaFila}>
              <View style={[styles.rutaPunto, { backgroundColor: '#F5A623' }]} />
              <Text style={styles.rutaDireccion} numberOfLines={1}>{params.origen || '-'}</Text>
            </View>
            <View style={styles.rutaLinea} />
            <View style={styles.rutaFila}>
              <View style={[styles.rutaPunto, { backgroundColor: '#E53935' }]} />
              <Text style={styles.rutaDireccion} numberOfLines={1}>{params.destino || '-'}</Text>
            </View>
          </View>

          <View style={styles.botonesContacto}>
            <TouchableOpacity style={[styles.btnContacto, { backgroundColor: '#4CAF50' }]} onPress={() => llamar(telefonoOtro)}>
              <Text style={styles.btnContactoTexto}>Llamar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnContacto, { backgroundColor: '#25D366' }]} onPress={() => whatsapp(telefonoOtro)}>
              <Text style={styles.btnContactoTexto}>WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnContacto, { backgroundColor: '#2196F3' }]} onPress={() => sms(telefonoOtro)}>
              <Text style={styles.btnContactoTexto}>SMS</Text>
            </TouchableOpacity>
          </View>

          {esCondutor && (
            <View>
              {(estadoViaje === 'aceptado' || estadoViaje === 'en_camino') && (
                <TouchableOpacity style={[styles.btnAccion, { backgroundColor: '#F5A623' }]} onPress={iniciarViaje}>
                  <Text style={styles.btnAccionTexto}>Pasajero a bordo - Iniciar viaje</Text>
                </TouchableOpacity>
              )}
              {estadoViaje === 'en_curso' && (
                <TouchableOpacity style={[styles.btnAccion, { backgroundColor: '#E53935' }]} onPress={terminarViaje}>
                  <Text style={styles.btnAccionTexto}>Llegamos - Terminar viaje</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.btnAccion, { backgroundColor: '#3a1a1a', marginTop: 8 }]} onPress={cancelarViaje}>
                <Text style={[styles.btnAccionTexto, { color: '#ff6b6b' }]}>Cancelar viaje</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1A2E' },
  map: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A1A2E', gap: 12 },
  loadingText: { color: '#F5A623', fontSize: 16, fontWeight: '600' },
  bannerEstado: { position: 'absolute', top: Platform.OS === 'ios' ? 56 : 40, left: 16, right: 16, backgroundColor: 'rgba(26,26,46,0.92)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 6, borderLeftWidth: 4, borderLeftColor: '#F5A623' },
  bannerTexto: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  etaTexto: { color: '#F5A623', fontSize: 13, fontWeight: '600' },
  cardInferior: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#1A1A2E', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 20, elevation: 10, maxHeight: '70%' },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  fotoCircle: { width: 52, height: 52, borderRadius: 26, marginRight: 12, borderWidth: 2, borderColor: '#F5A623' },
  avatarCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F5A623', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarLetra: { color: '#1A1A2E', fontSize: 20, fontWeight: '800' },
  infoTextos: { flex: 1 },
  nombreOtro: { color: '#9E9E9E', fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  nombreOtroValor: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  placaTexto: { color: '#9E9E9E', fontSize: 11, marginTop: 2 },
  rutaInfo: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12, marginBottom: 14 },
  rutaFila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rutaPunto: { width: 10, height: 10, borderRadius: 5 },
  rutaDireccion: { color: '#E0E0E0', fontSize: 13, flex: 1 },
  rutaLinea: { width: 2, height: 10, backgroundColor: '#555', marginLeft: 4, marginVertical: 2 },
  botonesContacto: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  btnContacto: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  btnContactoTexto: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  btnAccion: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  btnAccionTexto: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  marcadorConductor: { borderRadius: 20, padding: 4 },
  marcadorUsuario: { borderRadius: 20, padding: 4 },
  marcadorMoto: { borderRadius: 24, padding: 4 },
  marcadorEmoji: { fontSize: 16, color: '#fff', fontWeight: 'bold' },
});
