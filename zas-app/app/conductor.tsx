import { enviarNotificacion, registrarNotificaciones } from '../notificaciones';
import BilleteraConductor from './BilleteraConductor';
import DatosBancarios from './DatosBancarios';
import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, RefreshControl, Linking, TextInput, KeyboardAvoidingView, Platform, Image, Modal, BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline } from 'react-native-maps';
import polyline from '@mapbox/polyline';
import * as Application from 'expo-application';

const API_URL = 'https://zasapps.com';

export default function ConductorScreen() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(true);
  const [pantalla, setPantalla] = useState('login');
  const [sesion, setSesion] = useState<any>(null);
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [viajes, setViajes] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [verPassword, setVerPassword] = useState(false);
  const [verPasswordReg, setVerPasswordReg] = useState(false);
  const [editandoPerfil, setEditandoPerfil] = useState(false);
  const [editTelefono, setEditTelefono] = useState('');
  const [editFoto, setEditFoto] = useState('');
  const [editPlaca, setEditPlaca] = useState('');
  const [editModelo, setEditModelo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [suscripcionActiva, setSuscripcionActiva] = useState(false);
  const [diasRestantes, setDiasRestantes] = useState(0);
  const [mostrarBilletera, setMostrarBilletera] = useState(false);
  const [mostrarDatosBancarios, setMostrarDatosBancarios] = useState(false);
  const viajesRechazados = useRef<{ [id: string]: number }>({});
  const ofertaEnviadaIdRef = useRef<string | null>(null);
  const [conductorLat, setConductorLat] = useState<number>(0);
  const [conductorLng, setConductorLng] = useState<number>(0);
  const conductorLatRef = useRef<number>(0);
  const conductorLngRef = useRef<number>(0);
  const cerrandoSesionRef = useRef(false);

  // ── NEGOCIACIÓN ──────────────────────────────
  const [modalContraoferta, setModalContraoferta] = useState(false);
  const [viajeNegociando, setViajeNegociando] = useState<any>(null);
  const [precioContraoferta, setPrecioContraoferta] = useState('');
  const [enviandoContraoferta, setEnviandoContraoferta] = useState(false);
  // ─────────────────────────────────────────────

  const [regNombre, setRegNombre] = useState('');
  const [regTelefono, setRegTelefono] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regFoto, setRegFoto] = useState('');
  const [regPlaca, setRegPlaca] = useState('');
  const [regModelo, setRegModelo] = useState('');
  const [regFotoCedula, setRegFotoCedula] = useState('');
  const [regFotoLicencia, setRegFotoLicencia] = useState('');
  const [regFotoRegistro, setRegFotoRegistro] = useState('');
  const [regFotoRcv, setRegFotoRcv] = useState('');
  const [regFotoAntecedentes, setRegFotoAntecedentes] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [recEmail, setRecEmail] = useState('');
  const [recCargando, setRecCargando] = useState(false);
  const [conductorIdTemp, setConductorIdTemp] = useState('');
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [cambCargando, setCambCargando] = useState(false);
  const [recordarDatos, setRecordarDatos] = useState(false);
  const [deviceId, setDeviceId] = useState('');

  useEffect(() => {
    (async () => {
      const id = Application.getAndroidId() ?? Application.applicationId ?? '';
      setDeviceId(id);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const guardado = await AsyncStorage.getItem('conductor_recordar');
      if (guardado) {
        const { tel, pass } = JSON.parse(guardado);
        setTelefono(tel || '');
        setPassword(pass || '');
        setRecordarDatos(true);
      }
    })();
  }, []);

  useEffect(() => { cargarSesion(); }, []);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => false);
    return () => backHandler.remove();
  }, [sesion]);

  useEffect(() => {
    if (sesion) {
      (async () => {
        const token = await registrarNotificaciones();
        if (token) {
          await fetch(`${API_URL}/api/conductores/push-token/${sesion.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ push_token: token })
          });
        }
      })();
      verificarSuscripcion(sesion.id);

      const intervalo = setInterval(async () => {
        try {
          const tokenLocal = await AsyncStorage.getItem('conductor_session_token');
          // Sin token = ya cerró sesión intencionalmente, no verificar
          if (!tokenLocal) return;
          const resVerif = await fetch(`${API_URL}/api/conductores/verificar-sesion/${sesion.id}`, {
            headers: { 'x-session-token': tokenLocal }
          });
          const dataVerif = await resVerif.json();
          if (!dataVerif.ok) {
            // Solo alertar si no fue un cierre intencional
            if (!cerrandoSesionRef.current) {
              Alert.alert('Sesion cerrada', 'Tu cuenta fue iniciada en otro dispositivo.');
            }
            await AsyncStorage.removeItem('conductor_sesion');
            await AsyncStorage.removeItem('conductor_session_token');
            setSesion(null);
            setViajes([]);
            setSuscripcionActiva(false);
            return;
          }
        } catch {}
        buscarViajes();
      }, 5000);

      const intervaloSub = setInterval(() => verificarSuscripcion(sesion.id), 30000);
    

      // Polling contraoferta aceptada — pregunta especificamente por el viaje que se ofertó
      const intervaloContraoferta = setInterval(async () => {
        if (!ofertaEnviadaIdRef.current) return;
        try {
          const res = await fetch(`${API_URL}/api/viajes/${ofertaEnviadaIdRef.current}`);
          const data = await res.json();
          if (data.ok && data.viaje && data.viaje.estado === 'aceptado' && data.viaje.conductor_id === sesion.id) {
            const viajeAceptado = data.viaje;
            ofertaEnviadaIdRef.current = null;
            enviarNotificacion('Contraoferta aceptada', 'El usuario acepto tu precio. Ve a recogerlo.');
            router.push({
              pathname: '/mapa_viaje',
              params: {
                viaje_id: viajeAceptado.id,
                rol: 'conductor',
                conductor_id: sesion.id,
                usuario_nombre: viajeAceptado.usuario_nombre || '',
                usuario_telefono: viajeAceptado.usuario_telefono || '',
                usuario_foto: viajeAceptado.usuario_foto || '',
                origen: viajeAceptado.origen,
                destino: viajeAceptado.destino,
                origen_lat: viajeAceptado.origen_lat || '',
                origen_lng: viajeAceptado.origen_lng || '',
                destino_lat: viajeAceptado.destino_lat || '',
                destino_lng: viajeAceptado.destino_lng || '',
              }
            });
          }
        } catch {}
      }, 4000);
 
      return () => { clearInterval(intervalo); clearInterval(intervaloSub); clearInterval(intervaloContraoferta); };
    }
  }, [sesion]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
        (loc) => {
          setConductorLat(loc.coords.latitude);
          setConductorLng(loc.coords.longitude);
          conductorLatRef.current = loc.coords.latitude;
          conductorLngRef.current = loc.coords.longitude;
        }
      );
    })();
  }, []);

  const cargarSesion = async () => {
    try {
      const data = await AsyncStorage.getItem('conductor_sesion');
      if (data) {
        const conductor = JSON.parse(data);
        try {
          const tokenLocal = await AsyncStorage.getItem('conductor_session_token');
          const resVerif = await fetch(`${API_URL}/api/conductores/verificar-sesion/${conductor.id}`, {
            headers: { 'x-session-token': tokenLocal || '' }
          });
          const dataVerif = await resVerif.json();
          if (!dataVerif.ok) {
            await AsyncStorage.removeItem('conductor_sesion');
            await AsyncStorage.removeItem('conductor_session_token');
            return;
          }
        } catch {}
        setSesion(conductor);
        await verificarSuscripcion(conductor.id);
      }
    } catch {}
  };

  const verificarSuscripcion = async (conductorId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/suscripciones/estado/${conductorId}`);
      const data = await res.json();
      setSuscripcionActiva(data.activo);
      setDiasRestantes(data.dias_restantes || 0);
      await AsyncStorage.setItem('cache_suscripcion_' + conductorId, JSON.stringify(data));
      return data.activo;
    } catch {
      const cached = await AsyncStorage.getItem('cache_suscripcion_' + conductorId);
      if (cached) {
        const data = JSON.parse(cached);
        setSuscripcionActiva(data.activo);
        setDiasRestantes(data.dias_restantes || 0);
        return data.activo;
      }
      return false;
    }
  };

  const tomarOSeleccionarFoto = async (setter: (v: string) => void) => {
    Alert.alert('Foto', '¿Como quieres agregar la foto?', [
      { text: 'Camara', onPress: async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') return;
        const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1,1], quality: 0.1, base64: true });
        if (!result.canceled) setter('data:image/jpeg;base64,' + result.assets[0].base64);
      }},
      { text: 'Galeria', onPress: async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return;
        const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1,1], quality: 0.1, base64: true });
        if (!result.canceled) setter('data:image/jpeg;base64,' + result.assets[0].base64);
      }},
      { text: 'Cancelar', style: 'cancel' }
    ]);
  };

  const tomarOSeleccionarDocumento = async (setter: (v: string) => void) => {
    Alert.alert('Foto', '¿Como quieres agregar la foto?', [
      { text: 'Camara', onPress: async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') return;
        const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [16,10], quality: 0.5, base64: true });
        if (!result.canceled) setter('data:image/jpeg;base64,' + result.assets[0].base64);
      }},
      { text: 'Galeria', onPress: async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return;
        const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [16,10], quality: 0.5, base64: true });
        if (!result.canceled) setter('data:image/jpeg;base64,' + result.assets[0].base64);
      }},
      { text: 'Cancelar', style: 'cancel' }
    ]);
  };

  const tomarOSeleccionarAntecedentes = async (setter: (v: string) => void) => {
    Alert.alert('Foto', '¿Como quieres agregar la foto?', [
      { text: 'Camara', onPress: async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') return;
        const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [3,4], quality: 0.5, base64: true });
        if (!result.canceled) setter('data:image/jpeg;base64,' + result.assets[0].base64);
      }},
      { text: 'Galeria', onPress: async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return;
        const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [3,4], quality: 0.5, base64: true });
        if (!result.canceled) setter('data:image/jpeg;base64,' + result.assets[0].base64);
      }},
      { text: 'Cancelar', style: 'cancel' }
    ]);
  };

  const cambiarPasswordTemporal = async () => {
    if (nuevaPassword.length < 4) { Alert.alert('Error', 'La contrasena debe tener minimo 4 caracteres'); return; }
    if (nuevaPassword !== confirmarPassword) { Alert.alert('Error', 'Las contrasenas no coinciden'); return; }
    setCambCargando(true);
    try {
      const res = await fetch(`${API_URL}/api/conductores/reset-password/${conductorIdTemp}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: nuevaPassword }),
      });
      const data = await res.json();
      if (data.ok) {
        Alert.alert('Listo!', 'Tu contrasena fue actualizada. Ahora inicia sesion.', [
          { text: 'OK', onPress: () => { setNuevaPassword(''); setConfirmarPassword(''); setConductorIdTemp(''); setPantalla('login'); } }
        ]);
      } else {
        Alert.alert('Error', data.error || 'No se pudo actualizar la contrasena');
      }
    } catch { Alert.alert('Error', 'No se pudo conectar. Verifica tu internet.'); }
    finally { setCambCargando(false); }
  };

  const recuperarPassword = async () => {
    if (!recEmail || !recEmail.includes('@')) { Alert.alert('Error', 'Ingresa un email valido'); return; }
    setRecCargando(true);
    try {
      const res = await fetch(`${API_URL}/api/conductores/recuperar-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recEmail })
      });
      const data = await res.json();
      if (data.ok) {
        Alert.alert('Listo', 'Te enviamos una contrasena temporal a tu correo. Revisa tu bandeja de entrada.', [
          { text: 'OK', onPress: () => { setRecEmail(''); setPantalla('login'); } }
        ]);
      } else {
        Alert.alert('Error', data.error || 'No encontramos una cuenta con ese email');
      }
    } catch { Alert.alert('Error', 'No se pudo conectar. Verifica tu internet.'); }
    finally { setRecCargando(false); }
  };

  const login = async () => {
    if (!telefono || !password) { Alert.alert('Error', 'Ingresa telefono y contrasena'); return; }
    setCargando(true);
    try {
      const res = await fetch(API_URL + '/api/conductores/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono, password, device_id: deviceId })
      });

      if (res.status === 403) {
        const dataErr = await res.json();
        if (dataErr.dispositivo_bloqueado) {
          Alert.alert(
            'Dispositivo no autorizado',
            'Esta cuenta está registrada en otro dispositivo. Si cambiaste de teléfono, contacta al soporte.',
            [{ text: 'Entendido', style: 'cancel' }]
          );
          setCargando(false);
          return;
        }
        Alert.alert(
          'Sesión activa',
          'Esta cuenta ya está abierta en otro dispositivo. Cierra sesión desde ese dispositivo para poder entrar aquí.',
          [{ text: 'Entendido', style: 'cancel' }]
        );
        setCargando(false);
        return;
      }

      const data = await res.json();
      if (data.ok) {
        await AsyncStorage.setItem('conductor_sesion', JSON.stringify(data.conductor));
        await AsyncStorage.setItem('conductor_session_token', data.conductor.session_token || '');
        if (data.conductor.contrasena_temporal === true) {
          setConductorIdTemp(data.conductor.id);
          setPantalla('cambiar-password');
          setCargando(false);
          return;
        }
        if (recordarDatos) {
          await AsyncStorage.setItem('conductor_recordar', JSON.stringify({ tel: telefono, pass: password }));
        } else {
          await AsyncStorage.removeItem('conductor_recordar');
        }
        setSesion(data.conductor);
        await verificarSuscripcion(data.conductor.id);
        try {
          await fetch(`${API_URL}/api/conductores/estado/${data.conductor.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado: 'disponible' })
          });
        } catch {}
      } else Alert.alert('Error', data.error || 'Telefono o contrasena incorrectos');
    } catch { Alert.alert('Error', 'No se pudo conectar'); }
    finally { setCargando(false); }
  };

  const registrarConductor = async () => {
    if (!regFotoCedula || !regFotoLicencia || !regFotoRegistro || !regFotoRcv || !regFotoAntecedentes) {
      Alert.alert('Error', 'Debes subir todos los documentos'); return;
    }
    setCargando(true);
    try {
      const subirAStorage = async (base64: string, nombre: string) => {
        try {
          const res = await fetch(`${API_URL}/api/storage/subir-foto`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64, nombre, carpeta: 'documentos' }),
          });
          const data = await res.json();
          if (!data.ok) { Alert.alert('Error storage', data.error || 'No subio'); return null; }
          return data.url;
        } catch (e: any) { Alert.alert('Error', e.message); return null; }
      };
      let urlFotoPerfil = regFoto;
      if (regFoto && regFoto.startsWith('data:')) {
        const resFoto = await fetch(`${API_URL}/api/storage/subir-foto`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64: regFoto, nombre: `perfil_${regTelefono}`, carpeta: 'conductores' }),
        });
        const dataFoto = await resFoto.json();
        if (dataFoto.ok) urlFotoPerfil = dataFoto.url;
      }
      const urlCedula = await subirAStorage(regFotoCedula, `cedula_${regTelefono}`);
      if (!urlCedula) { setCargando(false); return; }
      const urlLicencia = await subirAStorage(regFotoLicencia, `licencia_${regTelefono}`);
      if (!urlLicencia) { setCargando(false); return; }
      const urlRegistro = await subirAStorage(regFotoRegistro, `registro_${regTelefono}`);
      if (!urlRegistro) { setCargando(false); return; }
      const urlRcv = await subirAStorage(regFotoRcv, `rcv_${regTelefono}`);
      if (!urlRcv) { setCargando(false); return; }
      const urlAntecedentes = await subirAStorage(regFotoAntecedentes, `antecedentes_${regTelefono}`);
      if (!urlAntecedentes) { setCargando(false); return; }
      router.push({
        pathname: '/VerificarTelefono',
        params: {
          telefono: regTelefono,
          tipo: 'conductor',
          nombre: regNombre,
          email: regEmail || '',
          password: regPassword,
          fotoUrl: urlFotoPerfil,
          placa: regPlaca,
          modelo: regModelo,
          fotoCedula: urlCedula,
          fotoLicencia: urlLicencia,
          fotoRegistro: urlRegistro,
          fotoRcv: urlRcv,
          fotoAntecedentes: urlAntecedentes,
        }
      });
    } catch { Alert.alert('Error', 'No se pudo conectar'); }
    finally { setCargando(false); }
  };

  const abrirPerfil = async () => {
    const data = await AsyncStorage.getItem('conductor_sesion');
    if (data) {
      const c = JSON.parse(data);
      setEditTelefono(c.telefono || '');
      setEditFoto(c.foto_url || '');
      setEditPlaca(c.placa_moto || '');
      setEditModelo(c.modelo_moto || '');
    }
    setEditandoPerfil(true);
  };

  const guardarPerfil = async () => {
    const data = await AsyncStorage.getItem('conductor_sesion');
    if (!data) return;
    const c = JSON.parse(data);
    setGuardando(true);
    try {
      const tokenLocal = await AsyncStorage.getItem('conductor_session_token');
      const res = await fetch(`${API_URL}/api/conductores/perfil/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-session-token': tokenLocal || '' },
        body: JSON.stringify({ telefono: editTelefono, placa_moto: editPlaca, modelo_moto: editModelo, foto_url: editFoto }),
      });
      const resp = await res.json();
      if (resp.ok) {
        const actualizado = { ...c, telefono: editTelefono, foto_url: editFoto, placa_moto: editPlaca, modelo_moto: editModelo };
        await AsyncStorage.setItem('conductor_sesion', JSON.stringify(actualizado));
        setSesion(actualizado);
        setEditandoPerfil(false);
        Alert.alert('Perfil actualizado');
      } else Alert.alert('Error', resp.error || 'No se pudo guardar');
    } catch { Alert.alert('Error', 'No se pudo conectar'); }
    finally { setGuardando(false); }
  };

  const subirFotoStorage = async (base64: string) => {
    const sesionData = await AsyncStorage.getItem('conductor_sesion');
    if (!sesionData) return null;
    const c = JSON.parse(sesionData);
    try {
      const res = await fetch(`${API_URL}/api/storage/subir-foto`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, nombre: `conductor_${c.id}`, carpeta: 'conductores' }),
      });
      const data = await res.json();
      return data.ok ? data.url : null;
    } catch { return null; }
  };

  const seleccionarFotoPerfil = async () => {
    Alert.alert('Foto', '¿Como quieres agregar la foto?', [
      { text: 'Camara', onPress: async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') return;
        const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1,1], quality: 0.3, base64: true });
        if (!result.canceled) {
          const url = await subirFotoStorage('data:image/jpeg;base64,' + result.assets[0].base64);
          if (url) setEditFoto(url); else Alert.alert('Error', 'No se pudo subir la foto');
        }
      }},
      { text: 'Galeria', onPress: async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return;
        const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1,1], quality: 0.3, base64: true });
        if (!result.canceled) {
          const url = await subirFotoStorage('data:image/jpeg;base64,' + result.assets[0].base64);
          if (url) setEditFoto(url); else Alert.alert('Error', 'No se pudo subir la foto');
        }
      }},
      { text: 'Cancelar', style: 'cancel' }
    ]);
  };

  const cerrarSesion = async () => {
    cerrandoSesionRef.current = true;
    try {
      await fetch(`${API_URL}/api/conductores/logout/${sesion.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }
      });
    } catch {}
    await AsyncStorage.removeItem('conductor_sesion');
    await AsyncStorage.removeItem('conductor_session_token');
    setSesion(null);
    setViajes([]);
    setSuscripcionActiva(false);
  };

  const buscarViajes = async () => {
    try {
      const lat = conductorLatRef.current;
      const lng = conductorLngRef.current;
      if (lat === 0 || lng === 0) return;
      const url = `${API_URL}/api/viajes/cercanos/${lat}/${lng}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.ok) {
        const ahora = Date.now();
        const BLOQUEO_MS = 3 * 60 * 1000;
        const filtrados = (data.viajes || []).filter((v: any) => {
          const rechazadoEn = viajesRechazados.current[v.id];
          if (rechazadoEn && ahora - rechazadoEn < BLOQUEO_MS) return false;
          if (rechazadoEn && ahora - rechazadoEn >= BLOQUEO_MS) delete viajesRechazados.current[v.id];
          return true;
        });
        setViajes(filtrados);
      }
    } catch {}
    setRefreshing(false);
  };

  const aceptarViaje = async (viaje: any) => {
    if (!sesion) return;
    try {
      const res = await fetch(API_URL + '/api/viajes/estado/' + viaje.id, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'aceptado', conductor_id: sesion.id })
      });
      const data = await res.json();
      if (data.ok) {
        enviarNotificacion('Viaje aceptado', 'Vas a recoger a ' + viaje.usuario_nombre);
        router.push({ pathname: '/mapa_viaje', params: { viaje_id: viaje.id, rol: 'conductor', conductor_id: sesion.id, usuario_nombre: viaje.usuario_nombre, usuario_telefono: viaje.usuario_telefono, usuario_foto: viaje.usuario_foto, origen: viaje.origen, destino: viaje.destino, origen_lat: viaje.origen_lat || '', origen_lng: viaje.origen_lng || '', destino_lat: viaje.destino_lat || '', destino_lng: viaje.destino_lng || '' } });
      } else if (data.error?.includes('ya fue tomado')) {
        Alert.alert('Viaje no disponible', 'Otro conductor tomo este viaje primero.');
        buscarViajes();
      } else {
        Alert.alert('Error', data.error || 'No se pudo aceptar');
      }
    } catch { Alert.alert('Error', 'No se pudo conectar'); }
  };

  const rechazarViaje = async (viaje: any) => {
    Alert.alert('Rechazar viaje', '¿Estas seguro que no quieres tomar este viaje?', [
      { text: 'No', style: 'cancel' },
      { text: 'Si, rechazar', style: 'destructive', onPress: async () => {
        viajesRechazados.current[viaje.id] = Date.now();
        setViajes(prev => prev.filter(v => v.id !== viaje.id));
      }},
    ]);
  };

  // ── CONTRAOFERTA ────────────────────────────────────────────────────────────
  const abrirContraoferta = (viaje: any) => {
    setViajeNegociando(viaje);
    setPrecioContraoferta(String(viaje.precio || ''));
    setModalContraoferta(true);
  };

  const enviarContraoferta = async () => {
    if (!viajeNegociando || !sesion) return;
    const monto = parseInt(precioContraoferta.replace(/\D/g, ''));
    if (!monto || monto < 1000) {
      Alert.alert('Error', 'Ingresa un monto valido (minimo 1.000 COP)');
      return;
    }
    setEnviandoContraoferta(true);
    try {
      const res = await fetch(`${API_URL}/api/viajes/oferta/${viajeNegociando.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conductor_id: sesion.id, precio_oferta: monto }),
      });
      const data = await res.json();
      if (data.ok) {
        ofertaEnviadaIdRef.current = viajeNegociando.id;
        setModalContraoferta(false);
        setViajeNegociando(null);
        setPrecioContraoferta('');
        // Quitar de la lista — ya queda en espera de respuesta del usuario
        setViajes(prev => prev.filter(v => v.id !== viajeNegociando.id));
        Alert.alert('Contraoferta enviada', 'El usuario recibio tu propuesta. Te avisaremos si acepta.');
      } else {
        Alert.alert('Error', data.error || 'No se pudo enviar la contraoferta');
      }
    } catch {
      Alert.alert('Error', 'No se pudo conectar');
    } finally {
      setEnviandoContraoferta(false);
    }
  };
  // ────────────────────────────────────────────────────────────────────────────

  if (!sesion) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {pantalla === 'login' && (
            <>
              <Text style={styles.titulo}>Login Conductor</Text>
              <Text style={styles.label}>Telefono</Text>
              <TextInput style={styles.input} placeholder="04121234567" placeholderTextColor="#888" keyboardType="phone-pad" value={telefono} onChangeText={setTelefono} maxLength={11} />
              <Text style={styles.label}>Contrasena</Text>
              <View style={styles.inputContenedor}>
                <TextInput style={styles.inputFlex} placeholder="Tu contrasena" placeholderTextColor="#888" secureTextEntry={!verPassword} value={password} onChangeText={setPassword} />
                <TouchableOpacity onPress={() => setVerPassword(!verPassword)}>
                  <Text style={styles.ojo}>{verPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}
                onPress={() => setRecordarDatos(!recordarDatos)}
              >
                <View style={{
                  width: 20, height: 20, borderRadius: 4, borderWidth: 2,
                  borderColor: recordarDatos ? '#FFD700' : '#555',
                  backgroundColor: recordarDatos ? '#FFD700' : 'transparent',
                  justifyContent: 'center', alignItems: 'center'
                }}>
                  {recordarDatos && <Text style={{ color: '#1a1a2e', fontSize: 12, fontWeight: 'bold' }}>✓</Text>}
                </View>
                <Text style={{ color: '#aaa', fontSize: 13 }}>Recordar mis datos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.boton} onPress={login} disabled={cargando}>
                {cargando ? <ActivityIndicator color="#1a1a2e" /> : <Text style={styles.botonTexto}>Entrar</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.botonOutline} onPress={() => setPantalla('reg1')}>
                <Text style={styles.botonOutlineTexto}>Registrarme como conductor</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={styles.linkTexto}>Volver</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setPantalla('recuperar')}>
                <Text style={[styles.linkTexto, { color: '#FFD700' }]}>¿Olvidaste tu contrasena?</Text>
              </TouchableOpacity>
            </>
          )}
          {pantalla === 'cambiar-password' && (
            <>
              <Text style={styles.titulo}>Crea tu contrasena</Text>
              <Text style={[styles.pasoTexto, { marginBottom: 16 }]}>Recibiste una contrasena temporal. Por seguridad, crea una nueva antes de continuar.</Text>
              <Text style={styles.label}>Nueva contrasena</Text>
              <TextInput style={styles.input} placeholder="Minimo 4 caracteres" placeholderTextColor="#888" secureTextEntry value={nuevaPassword} onChangeText={setNuevaPassword} />
              <Text style={styles.label}>Confirmar contrasena</Text>
              <TextInput style={styles.input} placeholder="Repite tu contrasena" placeholderTextColor="#888" secureTextEntry value={confirmarPassword} onChangeText={setConfirmarPassword} />
              <TouchableOpacity style={styles.boton} onPress={cambiarPasswordTemporal} disabled={cambCargando}>
                {cambCargando ? <ActivityIndicator color="#1a1a2e" /> : <Text style={styles.botonTexto}>Guardar contrasena</Text>}
              </TouchableOpacity>
            </>
          )}
          {pantalla === 'recuperar' && (
            <>
              <Text style={styles.titulo}>Recuperar contrasena</Text>
              <Text style={[styles.pasoTexto, { marginBottom: 20 }]}>Ingresa tu correo y te enviaremos una contrasena temporal.</Text>
              <Text style={styles.label}>Correo electronico</Text>
              <TextInput style={styles.input} placeholder="tu@email.com" placeholderTextColor="#888" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} value={recEmail} onChangeText={setRecEmail} />
              <TouchableOpacity style={styles.boton} onPress={recuperarPassword} disabled={recCargando}>
                {recCargando ? <ActivityIndicator color="#1a1a2e" /> : <Text style={styles.botonTexto}>Enviar contrasena temporal</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setRecEmail(''); setPantalla('login'); }}>
                <Text style={styles.linkTexto}>Volver al login</Text>
              </TouchableOpacity>
            </>
          )}
          {pantalla === 'reg1' && (
            <>
              <Text style={styles.titulo}>Registro Paso 1/3</Text>
              <Text style={styles.pasoTexto}>Datos personales</Text>
              <TouchableOpacity onPress={() => tomarOSeleccionarFoto(setRegFoto)} style={styles.fotoCirculo}>
                {regFoto ? <Image source={{ uri: regFoto }} style={styles.fotoCirculoImg} /> : <Text style={styles.fotoCirculoTexto}>Foto</Text>}
              </TouchableOpacity>
              <Text style={styles.label}>Nombre completo</Text>
              <TextInput style={styles.input} placeholder="Nombre(s) y Apellido(s)" placeholderTextColor="#888" value={regNombre} onChangeText={setRegNombre} />
              <Text style={styles.label}>Telefono</Text>
              <TextInput style={styles.input} placeholder="04121234567" placeholderTextColor="#888" keyboardType="phone-pad" value={regTelefono} onChangeText={setRegTelefono} maxLength={11} />
              <Text style={styles.label}>Correo electronico</Text>
              <TextInput style={styles.input} placeholder="tu@email.com" placeholderTextColor="#888" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="off" value={regEmail} onChangeText={setRegEmail} />
              <Text style={styles.label}>Contrasena</Text>
              <View style={styles.inputContenedor}>
                <TextInput style={styles.inputFlex} placeholder="Minimo 8 caracteres" placeholderTextColor="#888" secureTextEntry={!verPasswordReg} value={regPassword} onChangeText={setRegPassword} />
                <TouchableOpacity onPress={() => setVerPasswordReg(!verPasswordReg)}>
                  <Text style={styles.ojo}>{verPasswordReg ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.boton} onPress={() => {
                if (!regNombre || !regTelefono || !regPassword || !regEmail) { Alert.alert('Error', 'Todos los campos son obligatorios incluyendo el correo'); return; }
                if (!regFoto) { Alert.alert('Error', 'La foto de perfil es obligatoria'); return; }
                if (regPassword.length < 8) { Alert.alert('Error', 'La contrasena debe tener minimo 8 caracteres'); return; }
                setPantalla('reg2');
              }}>
                <Text style={styles.botonTexto}>Siguiente</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setPantalla('login')}>
                <Text style={styles.linkTexto}>Volver</Text>
              </TouchableOpacity>
            </>
          )}
          {pantalla === 'reg2' && (
            <>
              <Text style={styles.titulo}>Registro Paso 2/3</Text>
              <Text style={styles.pasoTexto}>Datos de la moto</Text>
              <Text style={styles.label}>Placa</Text>
              <TextInput style={styles.input} placeholder="ABC123" placeholderTextColor="#888" value={regPlaca} onChangeText={setRegPlaca} autoCapitalize="characters" />
              <Text style={styles.label}>Modelo</Text>
              <TextInput style={styles.input} placeholder="Honda CB 125 2020" placeholderTextColor="#888" value={regModelo} onChangeText={setRegModelo} />
              <TouchableOpacity style={styles.boton} onPress={() => {
                if (!regPlaca || !regModelo) { Alert.alert('Error', 'Ingresa placa y modelo'); return; }
                setPantalla('reg3');
              }}>
                <Text style={styles.botonTexto}>Siguiente</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => {
                Alert.alert('¿Salir del registro?', 'Perderás los datos que has ingresado hasta ahora.', [
                  { text: 'Seguir registrando', style: 'cancel' },
                  { text: 'Salir', style: 'destructive', onPress: () => setPantalla('login') },
                ]);
              }}>
                <Text style={styles.linkTexto}>Volver</Text>
              </TouchableOpacity>
            </>
          )}
          {pantalla === 'reg3' && (
            <>
              <Text style={styles.titulo}>Registro Paso 3/3</Text>
              <Text style={styles.pasoTexto}>Documentos</Text>
              <Text style={styles.label}>Foto Cedula</Text>
              <TouchableOpacity style={styles.docBoton} onPress={() => tomarOSeleccionarDocumento(setRegFotoCedula)}>
                {regFotoCedula ? <Image source={{ uri: regFotoCedula }} style={styles.docImg} /> : <Text style={styles.docBotonTexto}>Subir cedula</Text>}
              </TouchableOpacity>
              <Text style={styles.label}>Foto Licencia</Text>
              <TouchableOpacity style={styles.docBoton} onPress={() => tomarOSeleccionarDocumento(setRegFotoLicencia)}>
                {regFotoLicencia ? <Image source={{ uri: regFotoLicencia }} style={styles.docImg} /> : <Text style={styles.docBotonTexto}>Subir licencia</Text>}
              </TouchableOpacity>
              <Text style={styles.label}>Foto Registro de Moto</Text>
              <TouchableOpacity style={styles.docBoton} onPress={() => tomarOSeleccionarDocumento(setRegFotoRegistro)}>
                {regFotoRegistro ? <Image source={{ uri: regFotoRegistro }} style={styles.docImg} /> : <Text style={styles.docBotonTexto}>Subir registro</Text>}
              </TouchableOpacity>
              <Text style={styles.label}>RCV (Seguro de la moto)</Text>
              <TouchableOpacity style={styles.docBoton} onPress={() => tomarOSeleccionarDocumento(setRegFotoRcv)}>
                {regFotoRcv ? <Image source={{ uri: regFotoRcv }} style={styles.docImg} /> : <Text style={styles.docBotonTexto}>Subir RCV</Text>}
              </TouchableOpacity>
              <Text style={styles.label}>Antecedentes Penales</Text>
              <TouchableOpacity style={styles.docBoton} onPress={() => tomarOSeleccionarAntecedentes(setRegFotoAntecedentes)}>
                {regFotoAntecedentes ? <Image source={{ uri: regFotoAntecedentes }} style={styles.docImg} /> : <Text style={styles.docBotonTexto}>Subir antecedentes</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.boton} onPress={registrarConductor} disabled={cargando}>
                {cargando ? <ActivityIndicator color="#1a1a2e" /> : <Text style={styles.botonTexto}>Enviar solicitud</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => {
                Alert.alert('¿Salir del registro?', 'Perderás los datos y documentos que has subido hasta ahora.', [
                  { text: 'Seguir registrando', style: 'cancel' },
                  { text: 'Salir', style: 'destructive', onPress: () => setPantalla('login') },
                ]);
              }}>
                <Text style={styles.linkTexto}>Volver</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (mostrarDatosBancarios) {
    return (
      <View style={{ flex: 1 }}>
        <TouchableOpacity onPress={() => setMostrarDatosBancarios(false)} style={{ backgroundColor: '#1a1a2e', padding: 16, paddingTop: 50 }}>
          <Text style={{ color: '#FFD700', fontSize: 16 }}>Volver</Text>
        </TouchableOpacity>
        <DatosBancarios conductorId={sesion.id} onGuardado={() => setMostrarDatosBancarios(false)} />
      </View>
    );
  }

  if (mostrarBilletera) {
    return (
      <View style={{ flex: 1 }}>
        <TouchableOpacity onPress={() => setMostrarBilletera(false)} style={{ backgroundColor: '#1a1a2e', padding: 16, paddingTop: 50 }}>
          <Text style={{ color: '#FFD700', fontSize: 16 }}>Volver</Text>
        </TouchableOpacity>
        <BilleteraConductor conductorId={sesion.id} onIrDatosBancarios={() => { setMostrarBilletera(false); setMostrarDatosBancarios(true); }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!isOnline && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 999, backgroundColor: '#ff6b6b', padding: 8, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Sin conexion no puedes recibir viajes</Text>
        </View>
      )}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={styles.titulo}>Hola, {sesion.nombre}</Text>
          <TouchableOpacity onPress={abrirPerfil} style={styles.botonPerfil}>
            <Text style={styles.botonPerfilTexto}>✏️</Text>
          </TouchableOpacity>
        </View>
        <View style={{ gap: 8, marginTop: 8 }}>
          <TouchableOpacity onPress={() => router.push('/suscripcion')} style={{ backgroundColor: '#FFD700', borderRadius: 8, padding: 10, alignItems: 'center' }}>
            <Text style={{ color: '#1a1a2e', fontWeight: 'bold', fontSize: 13 }}>
              {suscripcionActiva ? `Suscripcion activa ${diasRestantes}d` : 'Ver suscripcion'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMostrarBilletera(true)} style={{ backgroundColor: '#0f3460', borderRadius: 8, padding: 10, alignItems: 'center' }}>
            <Text style={{ color: '#FFD700', fontWeight: 'bold', fontSize: 13 }}>Mi Billetera</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/soporte')} style={{ backgroundColor: '#0f3460', borderRadius: 8, padding: 10, alignItems: 'center' }}>
            <Text style={{ color: '#FFD700', fontWeight: 'bold', fontSize: 13 }}>Soporte</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={cerrarSesion} style={{ backgroundColor: '#3a1a1a', borderRadius: 8, padding: 10, alignItems: 'center' }}>
            <Text style={{ color: '#ff6b6b', fontWeight: 'bold', fontSize: 13 }}>Cerrar sesion</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); buscarViajes(); verificarSuscripcion(sesion.id); }} />}>
        {!suscripcionActiva ? (
          <View style={{ padding: 24, alignItems: 'center', marginTop: 20 }}>
            <Text style={{ fontSize: 60, marginBottom: 16 }}>🔒</Text>
            <Text style={{ color: '#FFD700', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 }}>Suscripcion inactiva</Text>
            <Text style={{ color: '#888', fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 22 }}>
              Para recibir viajes necesitas activar tu suscripcion.{'\n'}Acercate a la oficina ZAS para pagar.
            </Text>
            <TouchableOpacity onPress={() => router.push('/suscripcion')} style={{ backgroundColor: '#FFD700', borderRadius: 12, padding: 16, alignItems: 'center', width: '100%' }}>
              <Text style={{ color: '#1a1a2e', fontWeight: 'bold', fontSize: 16 }}>Ver informacion de suscripcion</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {diasRestantes <= 3 && (
              <View style={{ backgroundColor: '#3a2a00', margin: 12, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#FFD700' }}>
                <Text style={{ color: '#FFD700', fontWeight: 'bold', textAlign: 'center', fontSize: 14 }}>
                  Tu suscripcion vence en {diasRestantes} dia{diasRestantes !== 1 ? 's' : ''}. Renovela pronto.
                </Text>
              </View>
            )}
            {viajes.length === 0 ? (
              <Text style={styles.sinViajes}>Esperando viajes...</Text>
            ) : (
              viajes.map(viaje => {
                const coordenadasRuta = viaje.polyline
                  ? polyline.decode(viaje.polyline).map(([lat, lng]: [number, number]) => ({ latitude: lat, longitude: lng }))
                  : [];
                const latitudCentro = viaje.origen_lat && viaje.destino_lat ? (viaje.origen_lat + viaje.destino_lat) / 2 : viaje.origen_lat || 0;
                const longitudCentro = viaje.origen_lng && viaje.destino_lng ? (viaje.origen_lng + viaje.destino_lng) / 2 : viaje.origen_lng || 0;
                const latDelta = viaje.origen_lat && viaje.destino_lat ? Math.abs(viaje.origen_lat - viaje.destino_lat) * 2.5 + 0.01 : 0.05;
                const lngDelta = viaje.origen_lng && viaje.destino_lng ? Math.abs(viaje.origen_lng - viaje.destino_lng) * 2.5 + 0.01 : 0.05;
                const esNegociable = viaje.estado_negociacion === 'propuesto';

                return (
                  <View key={viaje.id} style={styles.card}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      {viaje.usuario_foto
                        ? <Image source={{ uri: viaje.usuario_foto }} style={styles.foto} />
                        : <View style={[styles.foto, { backgroundColor: '#FFD700', justifyContent: 'center', alignItems: 'center' }]}>
                            <Text style={{ color: '#1a1a2e', fontWeight: 'bold', fontSize: 22 }}>{viaje.usuario_nombre?.[0]?.toUpperCase() || '?'}</Text>
                          </View>
                      }
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={styles.cardTitulo}>{viaje.usuario_nombre}</Text>
                          {viaje.metodo_pago && (
                            <Text style={{ color: '#888', fontSize: 11, fontWeight: '600', textTransform: 'uppercase' }}>
                              {viaje.metodo_pago.replace('_', ' ')}
                            </Text>
                          )}
                        </View>
                        <Text style={{ color: '#FFD700', fontSize: 15, fontWeight: 'bold' }}>
                          {Number(viaje.precio_usuario || viaje.precio)?.toLocaleString('es-CO')} COP
                        </Text>
                        {esNegociable && (
                          <Text style={{ color: '#aaa', fontSize: 11, marginTop: 2 }}>
                            Viaje interurbano — puedes negociar el precio
                          </Text>
                        )}
                      </View>
                    </View>

                    <View style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
                      <MapView
                        style={{ width: '100%', height: 180 }}
                        scrollEnabled={false} zoomEnabled={false} rotateEnabled={false} pitchEnabled={false} pointerEvents="none"
                        initialRegion={{ latitude: latitudCentro, longitude: longitudCentro, latitudeDelta: latDelta, longitudeDelta: lngDelta }}
                      >
                        {conductorLat !== 0 && <Marker coordinate={{ latitude: conductorLat, longitude: conductorLng }} pinColor="#2196F3" title="Tu ubicacion" />}
                        {viaje.origen_lat && <Marker coordinate={{ latitude: viaje.origen_lat, longitude: viaje.origen_lng }} pinColor="#4CAF50" title="Origen" />}
                        {viaje.destino_lat && <Marker coordinate={{ latitude: viaje.destino_lat, longitude: viaje.destino_lng }} pinColor="#F44336" title="Destino" />}
                        {coordenadasRuta.length > 0 && <Polyline coordinates={coordenadasRuta} strokeColor="#1565C0" strokeWidth={3} />}
                      </MapView>
                      <View style={{ backgroundColor: '#0f3460', padding: 12 }}>
                        <Text style={{ color: '#00c853', fontSize: 11, fontWeight: '700', marginBottom: 2 }}>ORIGEN</Text>
                        <Text style={{ color: '#fff', fontSize: 13, marginBottom: 8 }} numberOfLines={2}>{viaje.origen_texto || viaje.origen}</Text>
                        <Text style={{ color: '#ff1744', fontSize: 11, fontWeight: '700', marginBottom: 2 }}>DESTINO</Text>
                        <Text style={{ color: '#fff', fontSize: 13 }} numberOfLines={2}>{viaje.destino_texto || viaje.destino}</Text>
                        {viaje.distancia_km && (
                          <Text style={{ color: '#FFD700', fontSize: 13, marginTop: 6 }}>{viaje.distancia_km} km - {viaje.duracion_minutos} min</Text>
                        )}
                      </View>
                    </View>

                    {/* BOTONES — urbano: Aceptar + Rechazar / interurbano: Aceptar + Contraoferta + Rechazar */}
                    {esNegociable ? (
                      <View style={{ gap: 8 }}>
                        <View style={styles.botones}>
                          <TouchableOpacity style={styles.botonAceptar} onPress={() => aceptarViaje(viaje)}>
                            <Text style={styles.botonTexto}>Aceptar precio</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.botonLlamar, { backgroundColor: '#3a1a1a' }]} onPress={() => rechazarViaje(viaje)}>
                            <Text style={[styles.botonTexto, { color: '#ff6b6b' }]}>Rechazar</Text>
                          </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                          style={{ backgroundColor: '#0f3460', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#FFD700' }}
                          onPress={() => abrirContraoferta(viaje)}
                        >
                          <Text style={{ color: '#FFD700', fontWeight: 'bold', fontSize: 14 }}>Proponer otro precio</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.botones}>
                        <TouchableOpacity style={styles.botonAceptar} onPress={() => aceptarViaje(viaje)}>
                          <Text style={styles.botonTexto}>Aceptar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.botonLlamar, { backgroundColor: '#3a1a1a' }]} onPress={() => rechazarViaje(viaje)}>
                          <Text style={[styles.botonTexto, { color: '#ff6b6b' }]}>Rechazar</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      {/* MODAL CONTRAOFERTA */}
      <Modal visible={modalContraoferta} animationType="slide" transparent onRequestClose={() => { setModalContraoferta(false); setViajeNegociando(null); setPrecioContraoferta(''); }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContenido}>
              <Text style={styles.modalTitulo}>Proponer precio</Text>

              {/* INPUT PRIMERO — visible antes de que el teclado suba */}
              <Text style={styles.modalLabel}>Tu precio (COP)</Text>
              <TextInput
                style={[styles.modalInput, { fontSize: 26, fontWeight: 'bold', color: '#FFD700', textAlign: 'center', letterSpacing: 1 }]}
                placeholder="0"
                placeholderTextColor="#555"
                keyboardType="numeric"
                value={precioContraoferta}
                onChangeText={setPrecioContraoferta}
                autoFocus
              />

              <Text style={{ color: '#aaa', fontSize: 13, marginBottom: 8, textAlign: 'center' }}>
                El usuario ofrece{' '}
                <Text style={{ color: '#FFD700', fontWeight: 'bold' }}>
                  {Number(viajeNegociando?.precio_usuario || viajeNegociando?.precio)?.toLocaleString('es-CO')} COP
                </Text>
              </Text>
              <Text style={{ color: '#888', fontSize: 11, marginBottom: 16, textAlign: 'center' }}>
                El usuario recibira tu propuesta y podra aceptarla o rechazarla.
              </Text>

              <TouchableOpacity style={styles.boton} onPress={enviarContraoferta} disabled={enviandoContraoferta}>
                {enviandoContraoferta ? <ActivityIndicator color="#1a1a2e" /> : <Text style={styles.botonTexto}>Enviar propuesta</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setModalContraoferta(false); setViajeNegociando(null); setPrecioContraoferta(''); }}>
                <Text style={styles.linkTexto}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL EDITAR PERFIL */}
      <Modal visible={editandoPerfil} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContenido}>
            <Text style={styles.modalTitulo}>Editar perfil</Text>
            <TouchableOpacity onPress={seleccionarFotoPerfil} style={styles.fotoCirculo}>
              {editFoto ? <Image source={{ uri: editFoto }} style={styles.fotoCirculoImg} /> : <Text style={styles.fotoCirculoTexto}>Foto</Text>}
            </TouchableOpacity>
            <Text style={styles.modalLabel}>Telefono</Text>
            <TextInput style={styles.modalInput} value={editTelefono} onChangeText={setEditTelefono} keyboardType="phone-pad" maxLength={11} placeholderTextColor="#888" placeholder="04121234567" />
            <Text style={styles.modalLabel}>Placa</Text>
            <TextInput style={styles.modalInput} value={editPlaca} onChangeText={setEditPlaca} autoCapitalize="characters" placeholderTextColor="#888" placeholder="ABC123" />
            <Text style={styles.modalLabel}>Modelo moto</Text>
            <TextInput style={styles.modalInput} value={editModelo} onChangeText={setEditModelo} placeholderTextColor="#888" placeholder="Honda CB 125 2020" />
            <TouchableOpacity style={styles.boton} onPress={guardarPerfil} disabled={guardando}>
              {guardando ? <ActivityIndicator color="#1a1a2e" /> : <Text style={styles.botonTexto}>Guardar cambios</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEditandoPerfil(false)}>
              <Text style={styles.linkTexto}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { padding: 20, paddingTop: 50 },
  titulo: { fontSize: 22, color: '#FFD700', fontWeight: 'bold', marginBottom: 4 },
  pasoTexto: { color: '#888', fontSize: 13, marginBottom: 16 },
  label: { color: '#aaa', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  input: { backgroundColor: '#16213e', borderRadius: 10, padding: 14, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#0f3460', marginBottom: 12 },
  boton: { backgroundColor: '#FFD700', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  botonTexto: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 16 },
  botonOutline: { backgroundColor: 'transparent', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#FFD700', marginTop: 8 },
  botonOutlineTexto: { color: '#FFD700', fontWeight: 'bold', fontSize: 16 },
  linkTexto: { color: '#888', textAlign: 'center', marginTop: 12, fontSize: 14 },
  sinViajes: { color: '#888', textAlign: 'center', marginTop: 40, fontSize: 16 },
  card: { backgroundColor: '#16213e', borderRadius: 12, padding: 16, margin: 12, borderWidth: 1, borderColor: '#0f3460' },
  cardTitulo: { color: '#FFD700', fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  foto: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: '#FFD700' },
  botones: { flexDirection: 'row', gap: 10, marginTop: 4 },
  botonAceptar: { flex: 1, backgroundColor: '#FFD700', borderRadius: 10, padding: 12, alignItems: 'center' },
  botonLlamar: { flex: 1, backgroundColor: '#0f3460', borderRadius: 10, padding: 12, alignItems: 'center' },
  inputContenedor: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16213e', borderRadius: 10, borderWidth: 1, borderColor: '#0f3460', marginBottom: 12 },
  inputFlex: { flex: 1, padding: 14, color: '#fff', fontSize: 15 },
  ojo: { paddingHorizontal: 14, fontSize: 18 },
  botonPerfil: { backgroundColor: '#16213e', borderRadius: 8, padding: 6, borderWidth: 1, borderColor: '#FFD700' },
  botonPerfilTexto: { color: '#FFD700', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContenido: { backgroundColor: '#1a1a2e', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitulo: { fontSize: 20, color: '#FFD700', fontWeight: 'bold', marginBottom: 16 },
  modalLabel: { color: '#aaa', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  modalInput: { backgroundColor: '#16213e', borderRadius: 10, padding: 14, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#0f3460', marginBottom: 12 },
  fotoCirculo: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#16213e', borderWidth: 2, borderColor: '#FFD700', alignSelf: 'center', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  fotoCirculoImg: { width: 90, height: 90, borderRadius: 45 },
  fotoCirculoTexto: { color: '#FFD700', fontSize: 13 },
  docBoton: { backgroundColor: '#16213e', borderRadius: 10, borderWidth: 1, borderColor: '#0f3460', padding: 14, alignItems: 'center', marginBottom: 12 },
  docBotonTexto: { color: '#aaa', fontSize: 14 },
  docImg: { width: '100%', height: 120, borderRadius: 8 },
});
