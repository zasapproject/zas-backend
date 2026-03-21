import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, Image, TextInput, Modal } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';

const API_URL = 'https://zas-backend-production-fb4e.up.railway.app';
const GOOGLE_KEY = 'AIzaSyBRIoMFetJDcqNWyXe2hWhQy4_FSgW8n1I';

export default function HomeScreen() {
  const router = useRouter();
  const [usuarioId, setUsuarioId] = useState('');
  const [usuarioNombre, setUsuarioNombre] = useState('');
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [origenLat, setOrigenLat] = useState<number | null>(null);
  const [origenLng, setOrigenLng] = useState<number | null>(null);
  const [destinoLat, setDestinoLat] = useState<number | null>(null);
  const [destinoLng, setDestinoLng] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const [viaje, setViaje] = useState<any>(null);
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [navegandoAlMapa, setNavegandoAlMapa] = useState(false);
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
            if (viajeActual.estado === 'aceptado' && !navegandoAlMapa) {
              setNavegandoAlMapa(true);
              router.push({ pathname: '/mapa_viaje', params: { viaje_id: viajeActual.id, rol: 'usuario', conductor_id: viajeActual.conductor_id || '', conductor_nombre: viajeActual.conductor_nombre || '', conductor_telefono: viajeActual.conductor_telefono || '', conductor_foto: viajeActual.conductor_foto || '', conductor_placa: viajeActual.conductor_placa || '', conductor_modelo: viajeActual.conductor_modelo || '', origen: viajeActual.origen, destino: viajeActual.destino, origen_lat: viajeActual.origen_lat || '', origen_lng: viajeActual.origen_lng || '', destino_lat: viajeActual.destino_lat || '', destino_lng: viajeActual.destino_lng || '' } });
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
      } else {
        router.replace('/login');
        return;
      }
    } catch (e) {
      router.replace('/login');
      return;
    }
    setCargando(false);
  };

  const solicitarViaje = async () => {
    if (!origen || !destino) { Alert.alert('Error', 'Selecciona origen y destino de las sugerencias'); return; }
    setCargando(true);
    try {
      const res = await fetch(`${API_URL}/api/viajes/nuevo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: usuarioId, origen, destino, origen_lat: origenLat, origen_lng: origenLng, destino_lat: destinoLat, destino_lng: destinoLng, precio: 4000 }),
      });
      const data = await res.json();
      if (data.ok) {
        setViaje(data.viaje);
        Alert.alert('Viaje solicitado', 'Buscando conductor cercano...');
      } else {
        Alert.alert('Error', data.error || 'No se pudo solicitar el viaje');
      }
    } catch (e) { Alert.alert('Error', 'No se pudo conectar al servidor'); }
    finally { setCargando(false); }
  };
const abrirPerfil = async () => {
    const sesion = await AsyncStorage.getItem('usuario_sesion');
    if (sesion) {
      const u = JSON.parse(sesion);
      setEditTelefono(u.telefono || '');
      setEditEmail(u.email || '');
      setEditFoto(u.foto_url || '');
    }
    setEditandoPerfil(true);
  };

  const subirFotoStorage = async (base64: string) => {
    const sesion = await AsyncStorage.getItem('conductor_sesion');
    if (!sesion) return null;
    const c = JSON.parse(sesion);
    try {
      const res = await fetch(`${API_URL}/api/storage/subir-foto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, nombre: `conductor_${c.id}`, carpeta: 'conductores' }),
      });
      const data = await res.json();
      if (data.ok) return data.url;
      return null;
    } catch { return null; }
  };

  const seleccionarFotoPerfil = async () => {
    Alert.alert('Foto', '¿Cómo quieres agregar la foto?', [
      { text: 'Cámara', onPress: async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') return;
        const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1,1], quality: 0.3, base64: true });
        if (!result.canceled) {
          const url = await subirFotoStorage('data:image/jpeg;base64,' + result.assets[0].base64);
          if (url) setEditFoto(url);
          else Alert.alert('Error', 'No se pudo subir la foto');
        }
      }},
      { text: 'Galería', onPress: async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return;
        const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1,1], quality: 0.3, base64: true });
        if (!result.canceled) {
          const url = await subirFotoStorage('data:image/jpeg;base64,' + result.assets[0].base64);
          if (url) setEditFoto(url);
          else Alert.alert('Error', 'No se pudo subir la foto');
        }
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
      const res = await fetch(`${API_URL}/api/usuarios/perfil/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono: editTelefono, email: editEmail || null, foto_url: editFoto }),
      });
      const data = await res.json();
      if (data.ok) {
        const actualizado = { ...u, telefono: editTelefono, email: editEmail, foto_url: editFoto };
        await AsyncStorage.setItem('usuario_sesion', JSON.stringify(actualizado));
        setEditandoPerfil(false);
        Alert.alert('✅ Perfil actualizado');
      } else Alert.alert('Error', data.error || 'No se pudo guardar');
    } catch { Alert.alert('Error', 'No se pudo conectar'); }
    finally { setGuardando(false); }
  };
  const cancelarViaje = () => {
    setViaje(null);
    setOrigen('');
    setDestino('');
    setOrigenLat(null);
    setOrigenLng(null);
    setDestinoLat(null);
    setDestinoLng(null);
    setNavegandoAlMapa(false);
  };

  if (cargando && !viaje) {
    return <View style={styles.loadingContainer}><ActivityIndicator color="#FFD700" size="large" /></View>;
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.logo}>ZAS</Text>
          <TouchableOpacity onPress={abrirPerfil} style={styles.botonPerfil}>
            <Text style={styles.botonPerfilTexto}>✏️ Perfil</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.saludo}>Hola, {usuarioNombre || 'bienvenido'}</Text>
      </View>eOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, Image, TextInput, Modal } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
      {!viaje ? (
        <View style={styles.formulario}>
          <View style={styles.autocompleteContainer}>
            <Text style={styles.inputIcon}>O</Text>
            <View style={{ flex: 1 }}>
              <GooglePlacesAutocomplete
                placeholder="Desde donde?"
                onPress={(data, details = null) => {
                  setOrigen(data.description);
                  setOrigenLat(details?.geometry?.location?.lat || null);
                  setOrigenLng(details?.geometry?.location?.lng || null);
                }}
                query={{ key: GOOGLE_KEY, language: 'es', components: 'country:co|country:ve' }}
                fetchDetails={true}
                enablePoweredByContainer={false}
                styles={{
                  textInput: styles.autocompleteInput,
                  listView: styles.listView,
                  description: styles.description,
                  row: styles.row,
                }}
                textInputProps={{ placeholderTextColor: '#888' }}
              />
            </View>
          </View>
          <View style={styles.linea} />
          <View style={styles.autocompleteContainer}>
            <Text style={styles.inputIcon}>X</Text>
            <View style={{ flex: 1 }}>
              <GooglePlacesAutocomplete
                placeholder="A donde vas?"
                onPress={(data, details = null) => {
                  setDestino(data.description);
                  setDestinoLat(details?.geometry?.location?.lat || null);
                  setDestinoLng(details?.geometry?.location?.lng || null);
                }}
                query={{ key: GOOGLE_KEY, language: 'es', components: 'country:co|country:ve' }}
                fetchDetails={true}
                enablePoweredByContainer={false}
                styles={{
                  textInput: styles.autocompleteInput,
                  listView: styles.listView,
                  description: styles.description,
                  row: styles.row,
                }}
                textInputProps={{ placeholderTextColor: '#888' }}
              />
            </View>
          </View>
          <View style={styles.precioContainer}>
            <Text style={styles.precioLabel}>Precio estimado</Text>
            <Text style={styles.precio}>$4.000 COP</Text>
          </View>
          <View style={styles.pagoContainer}>
            <Text style={styles.pagoLabel}>Metodo de pago</Text>
            <View style={styles.pagoOpciones}>
              <TouchableOpacity style={[styles.pagoBoton, metodoPago === 'efectivo' && styles.pagoBotonActivo]} onPress={() => setMetodoPago('efectivo')}>
                <Text style={[styles.pagoTexto, metodoPago === 'efectivo' && styles.pagoTextoActivo]}>Efectivo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pagoBoton, metodoPago === 'tarjeta' && styles.pagoBotonActivo]} onPress={() => setMetodoPago('tarjeta')}>
                <Text style={[styles.pagoTexto, metodoPago === 'tarjeta' && styles.pagoTextoActivo]}>Tarjeta</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={styles.boton} onPress={solicitarViaje} disabled={cargando}>
            {cargando ? <ActivityIndicator color="#1a1a2e" /> : <Text style={styles.botonTexto}>Solicitar ZAS</Text>}
          </TouchableOpacity>
         
          <TouchableOpacity style={styles.botonConductor} onPress={() => router.push('/soporte')}>
            <Text style={styles.botonConductorTexto}>🆘 Soporte técnico</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.botonConductor, { backgroundColor: '#3a1a1a', borderColor: '#ff6b6b' }]} onPress={async () => {
            const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
            await AsyncStorage.removeItem('usuario_sesion');
            router.replace('/login');
          }}>
            <Text style={[styles.botonConductorTexto, { color: '#ff6b6b' }]}>Cerrar sesión</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.viajeActivo}>
          <Text style={styles.viajeActivoTitulo}>
            {viaje.estado === 'aceptado' ? 'Conductor en camino' : 'Buscando conductor...'}
          </Text>
          {viaje.estado === 'aceptado' && (
            <View style={styles.conductorCard}>
              {viaje.conductor_foto ? (
                <Image source={{ uri: viaje.conductor_foto }} style={styles.conductorFoto} />
              ) : (
                <View style={styles.conductorFotoPlaceholder}>
                  <Text style={styles.conductorFotoLetra}>{viaje.conductor_nombre ? viaje.conductor_nombre[0].toUpperCase() : '?'}</Text>
                </View>
              )}
              <View style={styles.conductorInfo}>
                <Text style={styles.conductorNombre}>{viaje.conductor_nombre || 'Conductor'}</Text>
                {viaje.conductor_placa ? <Text style={styles.conductorDetalle}>{viaje.conductor_modelo} - {viaje.conductor_placa}</Text> : null}
                <Text style={styles.conductorEta}>Va en camino hacia ti</Text>
              </View>
            </View>
          )}
          <View style={styles.viajeInfo}>
            <Text style={styles.viajeLabel}>Desde</Text>
            <Text style={styles.viajeValor}>{viaje.origen}</Text>
            <Text style={styles.viajeLabel}>Hasta</Text>
            <Text style={styles.viajeValor}>{viaje.destino}</Text>
            <Text style={styles.viajeLabel}>Precio</Text>
            <Text style={styles.viajeValor}>${viaje.precio?.toLocaleString()} COP</Text>
            <Text style={styles.viajeLabel}>Estado</Text>
            <Text style={styles.viajeEstado}>{viaje.estado?.toUpperCase()}</Text>
          </View>
          {viaje.estado === 'aceptado' && (
            <TouchableOpacity style={styles.botonVerMapa} onPress={() => router.push({ pathname: '/mapa_viaje', params: { viaje_id: viaje.id, rol: 'usuario', conductor_id: viaje.conductor_id || '', conductor_nombre: viaje.conductor_nombre || '', conductor_telefono: viaje.conductor_telefono || '', conductor_foto: viaje.conductor_foto || '', conductor_placa: viaje.conductor_placa || '', conductor_modelo: viaje.conductor_modelo || '', origen: viaje.origen, destino: viaje.destino, origen_lat: viaje.origen_lat || '', origen_lng: viaje.origen_lng || '', destino_lat: viaje.destino_lat || '', destino_lng: viaje.destino_lng || '' } })}>
              <Text style={styles.botonVerMapaTexto}>Ver en el mapa</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.botonCancelar} onPress={cancelarViaje}>
            <Text style={styles.botonCancelarTexto}>Cancelar viaje</Text>
          </TouchableOpacity>
        </View>
      )}
    <Modal visible={editandoPerfil} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContenido}>
            <Text style={styles.modalTitulo}>Editar perfil</Text>
            <TouchableOpacity onPress={seleccionarFotoPerfil} style={styles.fotoCirculo}>
              {editFoto
                ? <Image source={{ uri: editFoto }} style={styles.fotoCirculoImg} />
                : <Text style={styles.fotoCirculoTexto}>📷 Foto</Text>}
            </TouchableOpacity>
            <Text style={styles.modalLabel}>Teléfono</Text>
            <TextInput style={styles.modalInput} value={editTelefono} onChangeText={setEditTelefono} keyboardType="phone-pad" maxLength={11} placeholderTextColor="#888" placeholder="04121234567" />
            <Text style={styles.modalLabel}>Email</Text>
            <TextInput style={styles.modalInput} value={editEmail} onChangeText={setEditEmail} keyboardType="email-address" placeholderTextColor="#888" placeholder="tu@email.com" />
            <TouchableOpacity style={styles.boton} onPress={guardarPerfil} disabled={guardando}>
              {guardando ? <ActivityIndicator color="#1a1a2e" /> : <Text style={styles.botonTexto}>Guardar cambios</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEditandoPerfil(false)}>
              <Text style={styles.linkTexto}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: { padding: 24, paddingTop: 60 },
  logo: { fontSize: 28, fontWeight: 'bold', color: '#FFD700' },
  saludo: { fontSize: 20, color: '#fff', fontWeight: '600', marginTop: 4 },
  formulario: { padding: 20 },
  autocompleteContainer: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#16213e', borderRadius: 12, paddingLeft: 16, paddingTop: 8, marginBottom: 2, zIndex: 10 },
  autocompleteInput: { color: '#fff', fontSize: 16, backgroundColor: '#16213e', height: 44 },
  listView: { backgroundColor: '#16213e', borderRadius: 8, zIndex: 999 },
  description: { color: '#fff', fontSize: 14 },
  row: { backgroundColor: '#16213e', padding: 10 },
  inputIcon: { fontSize: 16, marginRight: 8, color: '#FFD700', fontWeight: 'bold', paddingTop: 12 },
  linea: { height: 1, backgroundColor: '#0f3460', marginHorizontal: 16, marginBottom: 2 },
  precioContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#16213e', borderRadius: 12, padding: 16, marginTop: 12 },
  precioLabel: { color: '#888', fontSize: 14 },
  precio: { color: '#FFD700', fontSize: 20, fontWeight: 'bold' },
  pagoContainer: { marginTop: 12 },
  pagoLabel: { color: '#888', fontSize: 13, marginBottom: 8, fontWeight: '600' },
  pagoOpciones: { flexDirection: 'row', gap: 10 },
  pagoBoton: { flex: 1, backgroundColor: '#16213e', borderRadius: 10, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#0f3460' },
  pagoBotonActivo: { borderColor: '#FFD700' },
  pagoTexto: { color: '#888', fontSize: 13, fontWeight: '600' },
  pagoTextoActivo: { color: '#FFD700' },
  boton: { backgroundColor: '#FFD700', borderRadius: 14, padding: 18, alignItems: 'center', marginTop: 16 },
  botonTexto: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 16 },
  botonConductor: { backgroundColor: '#16213e', borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: '#0f3460' },
  botonConductorTexto: { color: '#888', fontWeight: 'bold', fontSize: 14 },
  viajeActivo: { padding: 20 },
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
