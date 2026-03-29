import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
  ScrollView, Image, TextInput, Modal, Platform
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://zas-backend-production-fb4e.up.railway.app';
const GOOGLE_KEY = 'AIzaSyBRIoMFetJDcqNWyXe2hWhQy4_FSgW8n1I';

type Coord = { latitude: number; longitude: number };

async function geocodificarInverso(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_KEY}&language=es`);
    const data = await res.json();
    if (data.results && data.results.length > 0) return data.results[0].formatted_address;
  } catch (e) {}
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

async function buscarDireccion(texto: string): Promise<{ description: string; lat: number; lng: number }[]> {
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(texto)}&key=${GOOGLE_KEY}&language=es&components=country:ve|country:co`);
    const data = await res.json();
    const resultados = await Promise.all(
      (data.predictions || []).slice(0, 4).map(async (p: any) => {
        try {
          const det = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${p.place_id}&fields=geometry&key=${GOOGLE_KEY}`);
          const detData = await det.json();
          const loc = detData.result?.geometry?.location;
          return { description: p.description, lat: loc?.lat || 0, lng: loc?.lng || 0 };
        } catch { return null; }
      })
    );
    return resultados.filter(Boolean) as any;
  } catch { return []; }
}

export default function HomeScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const busquedaTimeout = useRef<any>(null);

  const [usuarioId, setUsuarioId] = useState('');
  const [usuarioNombre, setUsuarioNombre] = useState('');
  const [cargando, setCargando] = useState(true);
  const [viaje, setViaje] = useState<any>(null);
  const [navegandoAlMapa, setNavegandoAlMapa] = useState(false);

  const [paso, setPaso] = useState<'origen' | 'destino' | 'confirmar'>('origen');
  const [region, setRegion] = useState({ latitude: 7.7633, longitude: -72.2249, latitudeDelta: 0.01, longitudeDelta: 0.01 });
  const [pinCoord, setPinCoord] = useState<Coord>({ latitude: 7.7633, longitude: -72.2249 });
  const [coordOrigen, setCoordOrigen] = useState<Coord | null>(null);
  const [coordDestino, setCoordDestino] = useState<Coord | null>(null);
  const [nombreOrigen, setNombreOrigen] = useState('');
  const [nombreDestino, setNombreDestino] = useState('');
  const [cargandoDireccion, setCargandoDireccion] = useState(false);

  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [sugerencias, setSugerencias] = useState<any[]>([]);
  const [buscando, setBuscando] = useState(false);

  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [editandoPerfil, setEditandoPerfil] = useState(false);
  const [editTelefono, setEditTelefono] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editFoto, setEditFoto] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { cargarSesion(); }, []);

  useEffect(() => {
    if (!viaje || !usuarioId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/viajes/usuario/${usuarioId}`);
        const data = await res.json();
        if (data.ok && data.viajes.length > 0) {
          const viajeActual = data.viajes.find((v: any) => v.id === viaje.id) ||
            data.viajes.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
          if (viajeActual) {
            setViaje(viajeActual);
            await AsyncStorage.setItem('viaje_activo', JSON.stringify(viajeActual));
            if ((viajeActual.estado === 'aceptado' || viajeActual.estado === 'en_curso') && !navegandoAlMapa) {
              setNavegandoAlMapa(true);
              router.push({ pathname: '/mapa_viaje', params: { viaje_id: viajeActual.id, rol: 'usuario', conductor_id: viajeActual.conductor_id || '', conductor_nombre: viajeActual.conductor_nombre || '', conductor_telefono: viajeActual.conductor_telefono || '', conductor_foto: viajeActual.conductor_foto || '', conductor_placa: viajeActual.conductor_placa || '', conductor_modelo: viajeActual.conductor_modelo || '', origen: viajeActual.origen, destino: viajeActual.destino, origen_lat: viajeActual.origen_lat || '', origen_lng: viajeActual.origen_lng || '', destino_lat: viajeActual.destino_lat || '', destino_lng: viajeActual.destino_lng || '' } });
            }
            if (viajeActual.estado === 'completado' || viajeActual.estado === 'cancelado') {
              await AsyncStorage.removeItem('viaje_activo');
              setViaje(null);
              setNavegandoAlMapa(false);
            }
          }
        }
      } catch (e) {}
    }, 5000);
    return () => clearInterval(interval);
  }, [viaje, usuarioId, navegandoAlMapa]);

  const cargarSesion = async () => {
    try {
      const sesion = await AsyncStorage.getItem('usuario_sesion');
      if (sesion) {
        const usuario = JSON.parse(sesion);
        setUsuarioId(usuario.id);
        setUsuarioNombre(usuario.nombre);
      } else { router.replace('/login'); return; }
      const viajeGuardado = await AsyncStorage.getItem('viaje_activo');
      if (viajeGuardado) {
        const v = JSON.parse(viajeGuardado);
        if (v.estado !== 'completado' && v.estado !== 'cancelado') setViaje(v);
        else await AsyncStorage.removeItem('viaje_activo');
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setPinCoord(coords);
        setRegion({ ...coords, latitudeDelta: 0.01, longitudeDelta: 0.01 });
      }
    } catch (e) { router.replace('/login'); return; }
    setCargando(false);
  };

  const onRegionChangeComplete = (reg: any) => {
    setPinCoord({ latitude: reg.latitude, longitude: reg.longitude });
  };

  const confirmarPunto = async () => {
    setCargandoDireccion(true);
    const nombre = await geocodificarInverso(pinCoord.latitude, pinCoord.longitude);
    setCargandoDireccion(false);
    if (paso === 'origen') {
      setCoordOrigen(pinCoord); setNombreOrigen(nombre);
      setTextoBusqueda(''); setSugerencias([]); setPaso('destino');
    } else {
      setCoordDestino(pinCoord); setNombreDestino(nombre);
      setTextoBusqueda(''); setSugerencias([]); setPaso('confirmar');
    }
  };

  const onBusquedaChange = (texto: string) => {
    setTextoBusqueda(texto);
    if (busquedaTimeout.current) clearTimeout(busquedaTimeout.current);
    if (texto.length < 3) { setSugerencias([]); return; }
    setBuscando(true);
    busquedaTimeout.current = setTimeout(async () => {
      const resultados = await buscarDireccion(texto);
      setSugerencias(resultados);
      setBuscando(false);
    }, 600);
  };

  const seleccionarSugerencia = (sug: any) => {
    const coords = { latitude: sug.lat, longitude: sug.lng };
    setPinCoord(coords);
    setRegion({ ...coords, latitudeDelta: 0.01, longitudeDelta: 0.01 });
    setSugerencias([]); setTextoBusqueda('');
    if (paso === 'origen') { setCoordOrigen(coords); setNombreOrigen(sug.description); setPaso('destino'); }
    else { setCoordDestino(coords); setNombreDestino(sug.description); setPaso('confirmar'); }
  };

  const solicitarViaje = async () => {
    if (!coordOrigen || !coordDestino) return;
    setCargando(true);
    try {
      const res = await fetch(`${API_URL}/api/viajes/nuevo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: usuarioId, origen: nombreOrigen, destino: nombreDestino, origen_lat: coordOrigen.latitude, origen_lng: coordOrigen.longitude, destino_lat: coordDestino.latitude, destino_lng: coordDestino.longitude, precio: 4000 }),
      });
      const data = await res.json();
      if (data.ok) {
        setViaje(data.viaje);
        await AsyncStorage.setItem('viaje_activo', JSON.stringify(data.viaje));
        Alert.alert('Viaje solicitado', 'Buscando conductor cercano...');
      } else Alert.alert('Error', data.error || 'No se pudo solicitar el viaje');
    } catch (e) { Alert.alert('Error', 'No se pudo conectar al servidor'); }
    finally { setCargando(false); }
  };

  const reiniciarFlujo = () => {
    setPaso('origen'); setCoordOrigen(null); setCoordDestino(null);
    setNombreOrigen(''); setNombreDestino(''); setTextoBusqueda(''); setSugerencias([]);
  };

  const cancelarViaje = async () => {
    try {
      if (viaje?.id) {
        await fetch(`${API_URL}/api/viajes/estado/${viaje.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado: 'cancelado' }),
        });
      }
    } catch (e) {}
    await AsyncStorage.removeItem('viaje_activo');
    setViaje(null); setNavegandoAlMapa(false); reiniciarFlujo();
  };

  const abrirPerfil = async () => {
    const sesion = await AsyncStorage.getItem('usuario_sesion');
    if (sesion) { const u = JSON.parse(sesion); setEditTelefono(u.telefono || ''); setEditEmail(u.email || ''); setEditFoto(u.foto_url || ''); }
    setEditandoPerfil(true);
  };

  const subirFotoStorage = async (base64: string) => {
    const sesion = await AsyncStorage.getItem('usuario_sesion');
    if (!sesion) return null;
    const u = JSON.parse(sesion);
    try {
      const res = await fetch(`${API_URL}/api/storage/subir-foto`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ base64, nombre: `usuario_${u.id}`, carpeta: 'usuarios' }) });
      const data = await res.json();
      return data.ok ? data.url : null;
    } catch { return null; }
  };

  const seleccionarFotoPerfil = async () => {
    Alert.alert('Foto', '¿Cómo quieres agregar la foto?', [
      { text: 'Cámara', onPress: async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') return;
        const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1,1], quality: 0.3, base64: true });
        if (!result.canceled) { const url = await subirFotoStorage('data:image/jpeg;base64,' + result.assets[0].base64); if (url) setEditFoto(url); }
      }},
      { text: 'Galería', onPress: async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return;
        const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1,1], quality: 0.3, base64: true });
        if (!result.canceled) { const url = await subirFotoStorage('data:image/jpeg;base64,' + result.assets[0].base64); if (url) setEditFoto(url); }
      }},
      { text: 'Cancelar', style: 'cancel' }
    ]);
  };

  const guardarPerfil = async () => {
    const sesion = await AsyncStorage.getItem('usuario_sesion');
    if (!sesion) return;
    const u = JSON.parse(sesion);
    setGuardando(true);
    try {
      const res = await fetch(`${API_URL}/api/usuarios/perfil/${u.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ telefono: editTelefono, email: editEmail || null, foto_url: editFoto }) });
      const data = await res.json();
      if (data.ok) {
        await AsyncStorage.setItem('usuario_sesion', JSON.stringify({ ...u, telefono: editTelefono, email: editEmail, foto_url: editFoto }));
        setEditandoPerfil(false); Alert.alert('✅ Perfil actualizado');
      } else Alert.alert('Error', data.error || 'No se pudo guardar');
    } catch { Alert.alert('Error', 'No se pudo conectar'); }
    finally { setGuardando(false); }
  };

  const ModalPerfil = () => (
    <Modal visible={editandoPerfil} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContenido}>
          <Text style={styles.modalTitulo}>Editar perfil</Text>
          <TouchableOpacity onPress={seleccionarFotoPerfil} style={styles.fotoCirculo}>
            {editFoto ? <Image source={{ uri: editFoto }} style={styles.fotoCirculoImg} /> : <Text style={styles.fotoCirculoTexto}>📷 Foto</Text>}
          </TouchableOpacity>
          <Text style={styles.modalLabel}>Teléfono</Text>
          <TextInput style={styles.modalInput} value={editTelefono} onChangeText={setEditTelefono} keyboardType="phone-pad" maxLength={11} placeholderTextColor="#888" placeholder="04121234567" />
          <Text style={styles.modalLabel}>Email</Text>
          <TextInput style={styles.modalInput} value={editEmail} onChangeText={setEditEmail} keyboardType="email-address" placeholderTextColor="#888" placeholder="tu@email.com" />
          <TouchableOpacity style={styles.boton} onPress={guardarPerfil} disabled={guardando}>
            {guardando ? <ActivityIndicator color="#1a1a2e" /> : <Text style={styles.botonTexto}>Guardar cambios</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setEditandoPerfil(false)}><Text style={styles.linkTexto}>Cancelar</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  if (cargando && !viaje) return <View style={styles.loadingContainer}><ActivityIndicator color="#FFD700" size="large" /></View>;

  if (viaje) {
    return (
      <View style={styles.container}>
        <View style={styles.header}><Text style={styles.logo}>ZAS</Text><Text style={styles.saludo}>Hola, {usuarioNombre}</Text></View>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={styles.viajeActivoTitulo}>{viaje.estado === 'aceptado' || viaje.estado === 'en_curso' ? 'Conductor en camino' : 'Buscando conductor...'}</Text>
          {(viaje.estado === 'aceptado' || viaje.estado === 'en_curso') && (
            <View style={styles.conductorCard}>
              {viaje.conductor_foto ? <Image source={{ uri: viaje.conductor_foto }} style={styles.conductorFoto} /> : <View style={styles.conductorFotoPlaceholder}><Text style={styles.conductorFotoLetra}>{viaje.conductor_nombre?.[0]?.toUpperCase() || '?'}</Text></View>}
              <View style={styles.conductorInfo}>
                <Text style={styles.conductorNombre}>{viaje.conductor_nombre || 'Conductor'}</Text>
                {viaje.conductor_placa ? <Text style={styles.conductorDetalle}>{viaje.conductor_modelo} · {viaje.conductor_placa}</Text> : null}
                <Text style={styles.conductorEta}>Va en camino hacia ti</Text>
              </View>
            </View>
          )}
          <View style={styles.viajeInfo}>
            <Text style={styles.viajeLabel}>Desde</Text><Text style={styles.viajeValor}>{viaje.origen}</Text>
            <Text style={styles.viajeLabel}>Hasta</Text><Text style={styles.viajeValor}>{viaje.destino}</Text>
            <Text style={styles.viajeLabel}>Estado</Text><Text style={styles.viajeEstado}>{viaje.estado?.toUpperCase()}</Text>
          </View>
          {(viaje.estado === 'aceptado' || viaje.estado === 'en_curso') && (
            <TouchableOpacity style={styles.botonVerMapa} onPress={() => router.push({ pathname: '/mapa_viaje', params: { viaje_id: viaje.id, rol: 'usuario', conductor_id: viaje.conductor_id || '', conductor_nombre: viaje.conductor_nombre || '', conductor_telefono: viaje.conductor_telefono || '', conductor_foto: viaje.conductor_foto || '', conductor_placa: viaje.conductor_placa || '', conductor_modelo: viaje.conductor_modelo || '', origen: viaje.origen, destino: viaje.destino, origen_lat: viaje.origen_lat || '', origen_lng: viaje.origen_lng || '', destino_lat: viaje.destino_lat || '', destino_lng: viaje.destino_lng || '' } })}>
              <Text style={styles.botonVerMapaTexto}>Ver en el mapa</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.botonCancelar} onPress={cancelarViaje}><Text style={styles.botonCancelarTexto}>Cancelar viaje</Text></TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (paso === 'confirmar') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.logo}>ZAS</Text>
            <TouchableOpacity onPress={abrirPerfil} style={styles.botonPerfil}><Text style={styles.botonPerfilTexto}>✏️ Perfil</Text></TouchableOpacity>
          </View>
          <Text style={styles.saludo}>Hola, {usuarioNombre}</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={[styles.viajeActivoTitulo, { marginBottom: 20 }]}>Confirma tu viaje</Text>
          <View style={styles.viajeInfo}>
            <Text style={styles.viajeLabel}>Origen</Text><Text style={styles.viajeValor}>{nombreOrigen}</Text>
            <Text style={styles.viajeLabel}>Destino</Text><Text style={styles.viajeValor}>{nombreDestino}</Text>
            <Text style={styles.viajeLabel}>Precio estimado</Text><Text style={[styles.viajeEstado, { color: '#FFD700' }]}>$4.000 COP</Text>
          </View>
          <View style={styles.pagoContainer}>
            <Text style={styles.pagoLabel}>Método de pago</Text>
            <View style={styles.pagoOpciones}>
              <TouchableOpacity style={[styles.pagoBoton, metodoPago === 'efectivo' && styles.pagoBotonActivo]} onPress={() => setMetodoPago('efectivo')}><Text style={[styles.pagoTexto, metodoPago === 'efectivo' && styles.pagoTextoActivo]}>Efectivo</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.pagoBoton, metodoPago === 'tarjeta' && styles.pagoBotonActivo]} onPress={() => setMetodoPago('tarjeta')}><Text style={[styles.pagoTexto, metodoPago === 'tarjeta' && styles.pagoTextoActivo]}>Tarjeta</Text></TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={styles.boton} onPress={solicitarViaje} disabled={cargando}>
            {cargando ? <ActivityIndicator color="#1a1a2e" /> : <Text style={styles.botonTexto}>⚡ Solicitar ZAS</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.botonCancelar, { marginTop: 12 }]} onPress={reiniciarFlujo}><Text style={styles.botonCancelarTexto}>Cambiar ruta</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.botonCancelar, { marginTop: 8 }]} onPress={async () => { await AsyncStorage.removeItem('usuario_sesion'); router.replace('/login'); }}><Text style={styles.botonCancelarTexto}>Cerrar sesión</Text></TouchableOpacity>
        </ScrollView>
        <ModalPerfil />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView ref={mapRef} style={styles.mapa} provider={PROVIDER_GOOGLE} region={region} onRegionChangeComplete={onRegionChangeComplete} showsUserLocation={true} showsMyLocationButton={false}>
        {paso === 'destino' && coordOrigen && <Marker coordinate={coordOrigen} pinColor="#00c853" title="Origen" />}
      </MapView>

      <View style={styles.pinContainer} pointerEvents="none">
        <Text style={styles.pinEmoji}>📍</Text>
        <View style={styles.pinSombra} />
      </View>

      <View style={styles.headerFlotante}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Text style={styles.logoFlotante}>⚡ ZAS — {usuarioNombre}</Text>
          <TouchableOpacity onPress={abrirPerfil} style={styles.botonPerfilFlotante}><Text style={styles.botonPerfilTexto}>✏️</Text></TouchableOpacity>
        </View>
        <View style={styles.progreso}>
          <View style={[styles.progresoStep, paso === 'origen' && styles.progresoStepActivo]}><Text style={[styles.progresoTexto, paso === 'origen' && styles.progresoTextoActivo]}>1. Origen</Text></View>
          <View style={styles.progresoLinea} />
          <View style={[styles.progresoStep, paso === 'destino' && styles.progresoStepActivo]}><Text style={[styles.progresoTexto, paso === 'destino' && styles.progresoTextoActivo]}>2. Destino</Text></View>
        </View>
        <Text style={styles.instruccion}>{paso === 'origen' ? '📍 Mueve el mapa a tu ubicación de origen' : '🏁 Mueve el mapa a tu destino'}</Text>
        <View style={styles.barraBusqueda}>
          <Text style={styles.lupita}>🔍</Text>
          <TextInput style={styles.inputBusqueda} placeholder={paso === 'origen' ? 'Buscar origen...' : 'Buscar destino...'} placeholderTextColor="#888" value={textoBusqueda} onChangeText={onBusquedaChange} />
          {buscando && <ActivityIndicator size="small" color="#FFD700" style={{ marginRight: 8 }} />}
        </View>
        {sugerencias.length > 0 && (
          <View style={styles.sugerencias}>
            {sugerencias.map((sug, i) => (
              <TouchableOpacity key={i} style={styles.sugerenciaItem} onPress={() => seleccionarSugerencia(sug)}>
                <Text style={styles.sugerenciaTexto} numberOfLines={2}>{sug.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {paso === 'destino' && nombreOrigen ? (
          <View style={styles.origenConfirmado}>
            <Text style={styles.origenConfirmadoLabel}>✅ Origen confirmado</Text>
            <Text style={styles.origenConfirmadoValor} numberOfLines={1}>{nombreOrigen}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.botonConfirmarContainer}>
        <TouchableOpacity style={[styles.botonConfirmar, cargandoDireccion && { opacity: 0.7 }]} onPress={confirmarPunto} disabled={cargandoDireccion}>
          {cargandoDireccion ? <ActivityIndicator color="#1a1a2e" /> : <Text style={styles.botonConfirmarTexto}>{paso === 'origen' ? '✅ Confirmar origen' : '✅ Confirmar destino'}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.botonCerrarSesion} onPress={async () => { await AsyncStorage.removeItem('usuario_sesion'); router.replace('/login'); }}>
          <Text style={styles.botonCerrarSesionTexto}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>

      <ModalPerfil />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  mapa: { flex: 1 },
  pinContainer: { position: 'absolute', top: '50%', left: '50%', marginLeft: -16, marginTop: -44, alignItems: 'center', zIndex: 10 },
  pinEmoji: { fontSize: 36 },
  pinSombra: { width: 8, height: 4, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 4, marginTop: -4 },
  headerFlotante: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(26,26,46,0.97)', paddingTop: Platform.OS === 'ios' ? 54 : 40, paddingHorizontal: 16, paddingBottom: 12, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, zIndex: 20 },
  logoFlotante: { fontSize: 16, fontWeight: 'bold', color: '#FFD700' },
  botonPerfilFlotante: { backgroundColor: '#16213e', borderRadius: 8, padding: 6, borderWidth: 1, borderColor: '#FFD700' },
  progreso: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  progresoStep: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 8, backgroundColor: '#16213e' },
  progresoStepActivo: { backgroundColor: '#FFD700' },
  progresoTexto: { color: '#888', fontSize: 13, fontWeight: '600' },
  progresoTextoActivo: { color: '#1a1a2e' },
  progresoLinea: { width: 16, height: 2, backgroundColor: '#333', marginHorizontal: 4 },
  instruccion: { color: '#aaa', fontSize: 13, textAlign: 'center', marginBottom: 10 },
  barraBusqueda: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16213e', borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#0f3460' },
  lupita: { fontSize: 16, marginRight: 8 },
  inputBusqueda: { flex: 1, color: '#fff', fontSize: 14, paddingVertical: 12 },
  sugerencias: { backgroundColor: '#16213e', borderRadius: 12, marginTop: 4, overflow: 'hidden', borderWidth: 1, borderColor: '#0f3460' },
  sugerenciaItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#0f3460' },
  sugerenciaTexto: { color: '#fff', fontSize: 13 },
  origenConfirmado: { backgroundColor: 'rgba(0,200,83,0.1)', borderRadius: 8, padding: 8, marginTop: 8, borderWidth: 1, borderColor: '#00c853' },
  origenConfirmadoLabel: { color: '#00c853', fontSize: 11, fontWeight: '700' },
  origenConfirmadoValor: { color: '#fff', fontSize: 13, marginTop: 2 },
  botonConfirmarContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 16, backgroundColor: 'rgba(26,26,46,0.97)', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  botonConfirmar: { backgroundColor: '#FFD700', borderRadius: 14, padding: 16, alignItems: 'center' },
  botonConfirmarTexto: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 16 },
  botonCerrarSesion: { marginTop: 10, alignItems: 'center', padding: 8 },
  botonCerrarSesionTexto: { color: '#ff6b6b', fontSize: 13 },
  header: { padding: 24, paddingTop: Platform.OS === 'ios' ? 54 : 40, backgroundColor: '#1a1a2e' },
  logo: { fontSize: 28, fontWeight: 'bold', color: '#FFD700' },
  saludo: { fontSize: 18, color: '#fff', fontWeight: '600', marginTop: 4 },
  viajeActivoTitulo: { fontSize: 20, color: '#FFD700', fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  conductorCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16213e', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#FFD700' },
  conductorFoto: { width: 64, height: 64, borderRadius: 32, marginRight: 14, borderWidth: 2, borderColor: '#FFD700' },
  conductorFotoPlaceholder: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFD700', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  conductorFotoLetra: { fontSize: 28, fontWeight: 'bold', color: '#1a1a2e' },
  conductorInfo: { flex: 1 },
  conductorNombre: { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 4 },
  conductorDetalle: { color: '#aaa', fontSize: 13, marginBottom: 4 },
  conductorEta: { color: '#FFD700', fontSize: 12, fontWeight: '600' },
  viajeInfo: { backgroundColor: '#16213e', borderRadius: 16, padding: 16, marginBottom: 12 },
  viajeLabel: { color: '#888', fontSize: 12, marginTop: 10, textTransform: 'uppercase', fontWeight: '600' },
  viajeValor: { color: '#fff', fontSize: 15, marginTop: 2 },
  viajeEstado: { color: '#FFD700', fontSize: 15, fontWeight: 'bold', marginTop: 2 },
  botonVerMapa: { backgroundColor: '#0f3460', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 10 },
  botonVerMapaTexto: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  botonCancelar: { backgroundColor: '#3a1a1a', borderRadius: 12, padding: 14, alignItems: 'center' },
  botonCancelarTexto: { color: '#ff6b6b', fontWeight: 'bold', fontSize: 15 },
  pagoContainer: { marginTop: 12, marginBottom: 16 },
  pagoLabel: { color: '#888', fontSize: 13, marginBottom: 8, fontWeight: '600' },
  pagoOpciones: { flexDirection: 'row', gap: 10 },
  pagoBoton: { flex: 1, backgroundColor: '#16213e', borderRadius: 10, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#0f3460' },
  pagoBotonActivo: { borderColor: '#FFD700' },
  pagoTexto: { color: '#888', fontSize: 13, fontWeight: '600' },
  pagoTextoActivo: { color: '#FFD700' },
  boton: { backgroundColor: '#FFD700', borderRadius: 14, padding: 18, alignItems: 'center', marginTop: 8 },
  botonTexto: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 16 },
  botonPerfil: { backgroundColor: '#16213e', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#FFD700' },
  botonPerfilTexto: { color: '#FFD700', fontSize: 13, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContenido: { backgroundColor: '#1a1a2e', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitulo: { fontSize: 20, color: '#FFD700', fontWeight: 'bold', marginBottom: 16 },
  modalLabel: { color: '#aaa', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  modalInput: { backgroundColor: '#16213e', borderRadius: 10, padding: 14, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#0f3460', marginBottom: 12 },
  linkTexto: { color: '#888', textAlign: 'center', marginTop: 12, fontSize: 14 },
  fotoCirculo: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#16213e', borderWidth: 2, borderColor: '#FFD700', alignSelf: 'center', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  fotoCirculoImg: { width: 90, height: 90, borderRadius: 45 },
  fotoCirculoTexto: { color: '#FFD700', fontSize: 13 },
});