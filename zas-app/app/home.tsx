import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
  ScrollView, Image, TextInput, Platform, BackHandler
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registrarNotificaciones } from '../notificaciones';
import { AppState } from 'react-native';
import ListaOfertas from './components/ListaOfertas';
import SubirComprobante from './SubirComprobante';
import Svg, { Ellipse, Line, Rect } from 'react-native-svg';

const API_URL = 'https://zasapps.com';
// GOOGLE_KEY eliminada — Places y Geocoding ahora van por el backend (/api/maps)

type Coord = { latitude: number; longitude: number };

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function geocodificarInverso(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(`${API_URL}/api/maps/geocode?lat=${lat}&lng=${lng}`);
    const data = await res.json();
    if (data.ok && data.direccion) return data.direccion;
  } catch (e) {}
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

async function buscarDireccion(texto: string): Promise<{ description: string; lat: number; lng: number }[]> {
  try {
    const res = await fetch(`${API_URL}/api/maps/autocomplete?input=${encodeURIComponent(texto)}`);
    const data = await res.json();
    const resultados = await Promise.all(
      (data.predictions || []).slice(0, 4).map(async (p: any) => {
        try {
          const det = await fetch(`${API_URL}/api/maps/place-details?place_id=${p.place_id}`);
          const detData = await det.json();
          return { description: p.description, lat: detData.lat || 0, lng: detData.lng || 0 };
        } catch { return null; }
      })
    );
    return resultados.filter(Boolean) as any;
  } catch { return []; }
}

async function calcularPrecio(origen: Coord, destino: Coord): Promise<{ precio: number; tipo: string; municipio: string | null; negociable: boolean; desglose: any }> {
  try {
    // Mandamos coordenadas de destino para que el backend use Google Directions (distancia real)
    const res = await fetch(
      `${API_URL}/api/tarifas/calcular?lat=${origen.latitude}&lng=${origen.longitude}&dest_lat=${destino.latitude}&dest_lng=${destino.longitude}`
    );
    const data = await res.json();
    if (data.ok) return {
      precio: data.precio,
      tipo: data.tipo,
      municipio: data.municipio,
      negociable: data.negociable || false,
      desglose: data.desglose || null,
    };
  } catch (e) {}
  const distancia_km = haversine(origen.latitude, origen.longitude, destino.latitude, destino.longitude);
  const precioFallback = Math.max(4000, Math.round(distancia_km * 1000));
  return { precio: precioFallback, tipo: 'fallback', municipio: null, negociable: false, desglose: null };
}

export default function HomeScreen() {
  const router = useRouter();
  const ultimaUbicacionConductorRef = useRef<any>(null);
  const [conductorSinSenal, setConductorSinSenal] = useState(false);
  const ultimaActualizacionRef = useRef<number>(Date.now());
  const timerSenalRef = useRef<any>(null);
  const UMBRAL_SIN_SENAL_MS = 20000;
  const mapRef = useRef<MapView>(null);
  const busquedaTimeout = useRef<any>(null);
  const inactividadTimer = useRef<any>(null);

  const resetearTimer = () => {
    if (inactividadTimer.current) clearTimeout(inactividadTimer.current);
    inactividadTimer.current = setTimeout(async () => {
      try {
        const sesion = await AsyncStorage.getItem('usuario_sesion');
        if (sesion) {
          const usuario = JSON.parse(sesion);
          if (usuario?.id) {
            await fetch(`${API_URL}/api/usuarios/logout/${usuario.id}`, { method: 'POST' });
          }
        }
      } catch {}
      await AsyncStorage.removeItem('usuario_sesion');
      await AsyncStorage.removeItem('viaje_activo');
      await AsyncStorage.removeItem('session_token');
      router.replace('/login');
    }, 3 * 60 * 1000);
  };

  const [usuarioId, setUsuarioId] = useState('');
  const [usuarioNombre, setUsuarioNombre] = useState('');
  const [cargando, setCargando] = useState(true);
  const [viaje, setViaje] = useState<any>(null);
  const [navegandoAlMapa, setNavegandoAlMapa] = useState(false);
  const [mapKey, setMapKey] = useState(0);

  const [paso, setPaso] = useState<'origen' | 'destino' | 'confirmar' | 'pagar'>('origen');
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

  const [precioCalculado, setPrecioCalculado] = useState<number>(0);
  const precioCalculadoRef = useRef<number>(0);
  const [precioUsuario, setPrecioUsuario] = useState<number>(0);
  const precioUsuarioRef = useRef<number>(0);
  const [esNegociable, setEsNegociable] = useState(false);
  const [esNegociableViaje, setEsNegociableViaje] = useState(false); // persiste cuando el viaje ya está activo
  const [desglosePrecios, setDesglosePrecios] = useState<any>(null);
  const [tipoTarifa, setTipoTarifa] = useState<string>('');
  const [municipioTarifa, setMunicipioTarifa] = useState<string | null>(null);
  const [calculandoPrecio, setCalculandoPrecio] = useState(false);

  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [pagoId, setPagoId] = useState<string | null>(null);
  const pagoIdRef = useRef<string | null>(null);
  const metodoPagoRef = useRef<string>('efectivo');
  const datosZasRef = useRef<any>(null);
  const cerrandoSesionRef = useRef(false);
  const [datosZas, setDatosZas] = useState<any>(null);
  const [tasas, setTasas] = useState({ cop_bs: 4.3, usd_cop: 3600 });
  const [conductoresActivos, setConductoresActivos] = useState<any[]>([]);
  const [mostrarComprobantePrevio, setMostrarComprobantePrevio] = useState(false);
  const [datosZasPrevio, setDatosZasPrevio] = useState<any>(null);
  const [cargandoDatosZas, setCargandoDatosZas] = useState(false);
  const [comprobanteEnviado, setComprobanteEnviado] = useState(false);
  const [urlComprobantePrevio, setUrlComprobantePrevio] = useState<string | null>(null);

  useEffect(() => { metodoPagoRef.current = metodoPago; }, [metodoPago]);
  useEffect(() => { precioCalculadoRef.current = precioCalculado; }, [precioCalculado]);
  useEffect(() => { precioUsuarioRef.current = precioUsuario; }, [precioUsuario]);
  useEffect(() => { datosZasRef.current = datosZas; }, [datosZas]);

  useEffect(() => {
    if (viaje) {
      if (inactividadTimer.current) clearTimeout(inactividadTimer.current);
      return;
    }
    resetearTimer();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') resetearTimer();
    });
    return () => {
      if (inactividadTimer.current) clearTimeout(inactividadTimer.current);
      sub.remove();
    };
  }, [viaje]);

  useEffect(() => { cargarSesion(); }, []);

  useEffect(() => {
    if (!usuarioId) return;
    const intervaloSesion = setInterval(async () => {
      try {
        const tokenLocal = await AsyncStorage.getItem('session_token');
        // Sin token = ya cerró sesión intencionalmente, no verificar
        if (!tokenLocal) return;
        const resVerif = await fetch(`${API_URL}/api/usuarios/verificar-sesion/${usuarioId}`, {
          headers: { 'x-session-token': tokenLocal }
        });
        const dataVerif = await resVerif.json();
        if (!dataVerif.ok) {
          clearInterval(intervaloSesion);
          // Solo alertar si no fue un cierre intencional
          if (!cerrandoSesionRef.current) {
            Alert.alert('Sesion cerrada', 'Tu cuenta fue iniciada en otro dispositivo.');
          }
          await AsyncStorage.removeItem('usuario_sesion');
          await AsyncStorage.removeItem('session_token');
          await AsyncStorage.removeItem('viaje_activo');
          router.replace('/login');
        }
      } catch {}
    }, 10000);
    return () => clearInterval(intervaloSesion);
  }, [usuarioId]);

  useEffect(() => {
    if (usuarioId) {
      (async () => {
        const token = await registrarNotificaciones();
        if (token) {
          await fetch(`${API_URL}/api/usuarios/push-token/${usuarioId}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ push_token: token })
          });
        }
      })();
    }
  }, [usuarioId]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (viaje) { BackHandler.exitApp(); return true; }
      if (paso === 'destino') { setPaso('origen'); return true; }
      if (paso === 'pagar') { setPaso('confirmar'); return true; }
      if (paso === 'confirmar') { setPaso('destino'); return true; }
      return false;
    });
    return () => backHandler.remove();
  }, [viaje, paso]);

  // Polling del viaje activo — solo para estado aceptado/en_curso/completado
  // El estado buscando lo maneja ListaOfertas directamente
  useEffect(() => {
    if (!viaje || !usuarioId) return;
    if (viaje.estado === 'buscando') return; // ListaOfertas se encarga
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/viajes/usuario/${usuarioId}`);
        const data = await res.json();
        if (data.ok && data.viajes.length > 0) {
          const viajeActual = data.viajes.find((v: any) => v.id === viaje.id) ||
            data.viajes.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
          if (viajeActual) {
            setViaje(viajeActual);
            if (viajeActual.conductor_id) {
              ultimaActualizacionRef.current = Date.now();
              setConductorSinSenal(false);
            }
            await AsyncStorage.setItem('viaje_activo', JSON.stringify(viajeActual));
            if ((viajeActual.estado === 'aceptado' || viajeActual.estado === 'en_curso') && !navegandoAlMapa) {
              setNavegandoAlMapa(true);
              router.push({
                pathname: '/mapa_viaje',
                params: {
                  viaje_id: viajeActual.id,
                  rol: 'usuario',
                  conductor_id: viajeActual.conductor_id || '',
                  conductor_nombre: viajeActual.conductor_nombre || '',
                  conductor_telefono: viajeActual.conductor_telefono || '',
                  conductor_foto: viajeActual.conductor_foto || '',
                  conductor_placa: viajeActual.conductor_placa || '',
                  conductor_modelo: viajeActual.conductor_modelo || '',
                  origen: viajeActual.origen,
                  destino: viajeActual.destino,
                  origen_lat: viajeActual.origen_lat || '',
                  origen_lng: viajeActual.origen_lng || '',
                  destino_lat: viajeActual.destino_lat || '',
                  destino_lng: viajeActual.destino_lng || '',
                  pago_id: pagoIdRef.current || '',
                  metodo_pago: metodoPagoRef.current || 'efectivo',
                  monto_viaje: String(precioCalculadoRef.current || viajeActual.precio || 0),
                  datos_zas: datosZasRef.current ? JSON.stringify(datosZasRef.current) : '',
                },
              });
            }
            if (viajeActual.estado === 'completado' || viajeActual.estado === 'cancelado') {
              await AsyncStorage.removeItem('viaje_activo');
              setViaje(null);
              setNavegandoAlMapa(false);
              setPaso('origen');
              setMapKey(k => k + 1);
              setCoordOrigen(null);
              setCoordDestino(null);
              setNombreOrigen('');
              setNombreDestino('');
              setPrecioCalculado(0);
              precioCalculadoRef.current = 0;
              setPrecioUsuario(0);
              precioUsuarioRef.current = 0;
              setEsNegociable(false);
              setEsNegociableViaje(false);
              setDesglosePrecios(null);
              setTipoTarifa('');
              setMunicipioTarifa(null);
              setPagoId(null);
              pagoIdRef.current = null;
              metodoPagoRef.current = 'efectivo';
              setDatosZas(null);
              datosZasRef.current = null;
              setMetodoPago('efectivo');
            }
          }
        }
      } catch (e) {}
    }, 8000);
    timerSenalRef.current = setInterval(() => {
      if (viaje && (viaje.estado === 'aceptado' || viaje.estado === 'en_curso')) {
        const segundosSin = Date.now() - ultimaActualizacionRef.current;
        if (segundosSin >= UMBRAL_SIN_SENAL_MS) {
          setConductorSinSenal(true);
        } else {
          setConductorSinSenal(false);
        }
      }
    }, 5000);
    return () => {
      clearInterval(interval);
      if (timerSenalRef.current) clearInterval(timerSenalRef.current);
    };
  }, [viaje, usuarioId, navegandoAlMapa]);

  const cargarSesion = async () => {
    try {
      const sesion = await AsyncStorage.getItem('usuario_sesion');
      if (sesion) {
        const usuario = JSON.parse(sesion);
        try {
          const tokenLocal = await AsyncStorage.getItem('session_token');
          const resVerif = await fetch(`${API_URL}/api/usuarios/verificar-sesion/${usuario.id}`, {
            headers: { 'x-session-token': tokenLocal || '' }
          });
          const dataVerif = await resVerif.json();
          if (!dataVerif.ok) {
            await AsyncStorage.removeItem('usuario_sesion');
            await AsyncStorage.removeItem('session_token');
            await AsyncStorage.removeItem('viaje_activo');
            router.replace('/login');
            return;
          }
        } catch {}
        setUsuarioId(usuario.id);
        setUsuarioNombre(usuario.nombre);
      } else { router.replace('/login'); return; }

      const viajeGuardado = await AsyncStorage.getItem('viaje_activo');
      if (viajeGuardado) {
        const vCached = JSON.parse(viajeGuardado);
        if (vCached.estado !== 'completado' && vCached.estado !== 'cancelado') {
          // Usar caché inmediatamente para no mostrar pantalla en blanco
          setViaje(vCached);
          // Luego verificar estado real en el backend
          try {
            const resViaje = await fetch(`${API_URL}/api/viajes/usuario/${usuarioId}`);
            const dataViaje = await resViaje.json();
            if (dataViaje.ok && dataViaje.viajes && dataViaje.viajes.length > 0) {
              const viajeActivo = dataViaje.viajes.find((vj: any) => vj.id === vCached.id)
                || dataViaje.viajes.find((vj: any) => !['completado', 'cancelado'].includes(vj.estado));
              if (viajeActivo && !['completado', 'cancelado'].includes(viajeActivo.estado)) {
                setViaje(viajeActivo);
                await AsyncStorage.setItem('viaje_activo', JSON.stringify(viajeActivo));
              } else {
                // El viaje ya terminó mientras estaba fuera
                await AsyncStorage.removeItem('viaje_activo');
                setViaje(null);
                setPaso('origen');
                setMapKey(k => k + 1);
              }
            }
          } catch {
            // Sin conexión — mantener el caché
          }
        } else {
          await AsyncStorage.removeItem('viaje_activo');
          setPaso('origen');
          setMetodoPago('efectivo');
          metodoPagoRef.current = 'efectivo';
        }
      } else {
        setPaso('origen');
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setPinCoord(coords);
        setRegion({ ...coords, latitudeDelta: 0.01, longitudeDelta: 0.01 });
      }
    } catch (e) { router.replace('/login'); return; }

    try {
      const resTasas = await fetch(`${API_URL}/api/tasas`);
      const dataTasas = await resTasas.json();
      if (dataTasas.ok) {
        setTasas(dataTasas.tasas);
        await AsyncStorage.setItem('cache_tasas', JSON.stringify(dataTasas.tasas));
      }
    } catch {
      const cached = await AsyncStorage.getItem('cache_tasas');
      if (cached) setTasas(JSON.parse(cached));
    }
    setCargando(false);
  };

  const obtenerConductoresActivos = async () => {
    try {
      const res = await fetch(`${API_URL}/api/conductores/disponibles`);
      const data = await res.json();
      if (data.ok) setConductoresActivos(data.conductores || []);
    } catch {}
  };

  useEffect(() => {
    if (viaje && viaje.estado !== 'buscando') return;
    obtenerConductoresActivos();
    const intervalo = setInterval(obtenerConductoresActivos, 6000);
    const intervaloTasas = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/tasas`);
        const data = await res.json();
        if (data.ok) setTasas(data.tasas);
      } catch {}
    }, 60000);
    return () => { clearInterval(intervalo); clearInterval(intervaloTasas); };
  }, [viaje]);

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
      setTextoBusqueda(''); setSugerencias([]);
      setCalculandoPrecio(true);
      setPaso('confirmar');
      const resultado = await calcularPrecio(coordOrigen!, pinCoord);
      setPrecioCalculado(resultado.precio);
      precioCalculadoRef.current = resultado.precio;
      setPrecioUsuario(resultado.precio);
      precioUsuarioRef.current = resultado.precio;
      setEsNegociable(resultado.negociable);
      setEsNegociableViaje(resultado.negociable);
      setDesglosePrecios(resultado.desglose);
      setTipoTarifa(resultado.tipo);
      setMunicipioTarifa(resultado.municipio);
      setCalculandoPrecio(false);
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

  const seleccionarSugerencia = async (sug: any) => {
    const coords = { latitude: sug.lat, longitude: sug.lng };
    setPinCoord(coords);
    setRegion({ ...coords, latitudeDelta: 0.01, longitudeDelta: 0.01 });
    setSugerencias([]); setTextoBusqueda('');
    if (paso === 'origen') {
      setCoordOrigen(coords); setNombreOrigen(sug.description); setPaso('destino');
    } else {
      setCoordDestino(coords); setNombreDestino(sug.description);
      setCalculandoPrecio(true);
      setPaso('confirmar');
      const resultado = await calcularPrecio(coordOrigen!, coords);
      setPrecioCalculado(resultado.precio);
      precioCalculadoRef.current = resultado.precio;
      setPrecioUsuario(resultado.precio);
      precioUsuarioRef.current = resultado.precio;
      setEsNegociable(resultado.negociable);
      setEsNegociableViaje(resultado.negociable);
      setDesglosePrecios(resultado.desglose);
      setTipoTarifa(resultado.tipo);
      setMunicipioTarifa(resultado.municipio);
      setCalculandoPrecio(false);
    }
  };

  const ajustarPrecioUsuario = (delta: number) => {
    const nuevo = Math.max(precioCalculado, precioUsuario + delta);
    setPrecioUsuario(nuevo);
    precioUsuarioRef.current = nuevo;
  };

  const solicitarViaje = async () => {
    if (!coordOrigen || !coordDestino || !precioCalculado) return;
    setCargando(true);
    try {
      const precioFinal = esNegociable ? precioUsuario : precioCalculado;
      const res = await fetch(`${API_URL}/api/viajes/nuevo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_id: usuarioId,
          origen: nombreOrigen,
          destino: nombreDestino,
          origen_lat: coordOrigen.latitude,
          origen_lng: coordOrigen.longitude,
          destino_lat: coordDestino.latitude,
          destino_lng: coordDestino.longitude,
          precio: precioFinal,
          precio_usuario: precioFinal,
          metodo_pago: metodoPago,
        }),
      });
      const data = await res.json();
      if (!data.ok && data.error?.includes('conductor')) {
        Alert.alert('Sin conductores', 'No hay conductores disponibles en este momento. Intenta en unos minutos.');
        setCargando(false);
        return;
      }
      if (data.ok) {
        setViaje(data.viaje);
        setEsNegociableViaje(data.negociable || esNegociable);
        await AsyncStorage.setItem('viaje_activo', JSON.stringify(data.viaje));
        metodoPagoRef.current = metodoPago;
        // Si es negociable, el pago digital se gestiona despues de elegir conductor (ver ListaOfertas)
        if (!esNegociable) {
          try {
            const resPago = await fetch(`${API_URL}/api/pagos/nuevo`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ viaje_id: data.viaje.id, monto: precioFinal, metodo: metodoPago })
            });
            const dataPago = await resPago.json();
            if (dataPago.ok) {
              setPagoId(dataPago.pago.id);
              pagoIdRef.current = dataPago.pago.id;
              if (dataPago.datos_pago_zas) {
                setDatosZas(dataPago.datos_pago_zas);
                datosZasRef.current = dataPago.datos_pago_zas;
              }
              if (urlComprobantePrevio) {
                try {
                  await fetch(`${API_URL}/api/pagos/subir-comprobante/${dataPago.pago.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ comprobante_url: urlComprobantePrevio, referencia: null })
                  });
                } catch {}
              }
            }
          } catch {}
        }
      } else Alert.alert('Error', data.error || 'No se pudo solicitar el viaje');
    } catch (e) { Alert.alert('Error', 'No se pudo conectar al servidor'); }
    finally { setCargando(false); }
  };

  const reiniciarFlujo = () => {
    setMapKey(k => k + 1);
    setPaso('origen'); setCoordOrigen(null); setCoordDestino(null);
    setNombreOrigen(''); setNombreDestino(''); setTextoBusqueda(''); setSugerencias([]);
    setPrecioCalculado(0); precioCalculadoRef.current = 0;
    setPrecioUsuario(0); precioUsuarioRef.current = 0;
    setEsNegociable(false); setEsNegociableViaje(false); setDesglosePrecios(null);
    setTipoTarifa(''); setMunicipioTarifa(null);
    setMostrarComprobantePrevio(false); setDatosZasPrevio(null);
    setComprobanteEnviado(false); setCargandoDatosZas(false);
    setUrlComprobantePrevio(null);
  };

  const cancelarViaje = async () => {
    try {
      if (viaje?.id) {
        await fetch(`${API_URL}/api/viajes/estado/${viaje.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado: 'cancelado' }),
        });
      }
    } catch (e) {}
    await AsyncStorage.removeItem('viaje_activo');
    setViaje(null); setNavegandoAlMapa(false); reiniciarFlujo();
  };

  const cerrarSesion = async () => {
    cerrandoSesionRef.current = true;
    try {
      if (usuarioId) {
        await fetch(`${API_URL}/api/usuarios/logout/${usuarioId}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch {}
    await AsyncStorage.removeItem('usuario_sesion');
    await AsyncStorage.removeItem('session_token');
    await AsyncStorage.removeItem('viaje_activo');
    router.replace('/login');
  };

  const abrirPerfil = () => router.push('/editar_perfil');

  const formatearPrecio = (precio: number) => {
    const cop = precio.toLocaleString('es-CO', { maximumFractionDigits: 0 });
    const bs  = (precio / tasas.cop_bs).toLocaleString('es-VE', { maximumFractionDigits: 2 });
    const usd = (precio / tasas.usd_cop).toFixed(2);
    return { cop, usd, bs };
  };

  if (cargando && !viaje) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator color="#FFD700" size="large" />
    </View>
  );

  // ── VIAJE BUSCANDO — mapa + panel inferior ──────────────────────────────────
  const onConductorElegidoCb = (viajeActualizado: any, conductor: any) => {
    setViaje(viajeActualizado);
    AsyncStorage.setItem('viaje_activo', JSON.stringify(viajeActualizado));
    setNavegandoAlMapa(true);
    router.push({
      pathname: '/mapa_viaje',
      params: {
        viaje_id: viajeActualizado.id,
        rol: 'usuario',
        conductor_id: conductor.id || '',
        conductor_nombre: conductor.nombre || '',
        conductor_telefono: conductor.telefono || '',
        conductor_foto: conductor.foto_url || '',
        conductor_placa: conductor.placa_moto || '',
        conductor_modelo: conductor.modelo_moto || '',
        origen: viajeActualizado.origen,
        destino: viajeActualizado.destino,
        origen_lat: viajeActualizado.origen_lat || '',
        origen_lng: viajeActualizado.origen_lng || '',
        destino_lat: viajeActualizado.destino_lat || '',
        destino_lng: viajeActualizado.destino_lng || '',
        pago_id: pagoIdRef.current || '',
        metodo_pago: metodoPagoRef.current || 'efectivo',
        monto_viaje: String(viajeActualizado.precio || 0),
        datos_zas: datosZasRef.current ? JSON.stringify(datosZasRef.current) : '',
      },
    });
  };

  if (viaje && viaje.estado === 'buscando') {
    const origenCoord = viaje.origen_lat
      ? { latitude: Number(viaje.origen_lat), longitude: Number(viaje.origen_lng) }
      : coordOrigen;
    const destinoCoord = viaje.destino_lat
      ? { latitude: Number(viaje.destino_lat), longitude: Number(viaje.destino_lng) }
      : coordDestino;
    const regionBuscando = origenCoord
      ? { latitude: origenCoord.latitude, longitude: origenCoord.longitude, latitudeDelta: 0.03, longitudeDelta: 0.03 }
      : region;

    return (
      <View style={{ flex: 1 }}>
        {/* MAPA CON CONDUCTORES CERCANOS */}
        <MapView
          style={{ flex: 1 }}
          provider={PROVIDER_GOOGLE}
          region={regionBuscando}
          showsUserLocation={true}
          showsMyLocationButton={false}
          scrollEnabled={false}
          zoomEnabled={false}
        >
          {origenCoord && (
            <Marker coordinate={origenCoord} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#00c853', borderWidth: 2, borderColor: '#fff', elevation: 6, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#fff' }}>A</Text>
              </View>
            </Marker>
          )}
          {destinoCoord && (
            <Marker coordinate={destinoCoord} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={{ backgroundColor: 'transparent', elevation: 6, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 22 }}>🏁</Text>
              </View>
            </Marker>
          )}
          {conductoresActivos.map(c =>
            c.latitud && c.longitud ? (
              <Marker key={c.id} coordinate={{ latitude: Number(c.latitud), longitude: Number(c.longitud) }} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={{ backgroundColor: 'transparent', elevation: 5, alignItems: 'center', justifyContent: 'center' }}>
                  <Svg width={32} height={36} viewBox="0 0 32 36">
                    <Ellipse cx="16" cy="16" rx="5" ry="10" fill="#FFD700"/>
                    <Ellipse cx="16" cy="28" rx="4" ry="5" fill="none" stroke="#FFD700" strokeWidth="2.5"/>
                    <Ellipse cx="16" cy="5" rx="4" ry="5" fill="none" stroke="#FFD700" strokeWidth="2.5"/>
                    <Line x1="9" y1="7" x2="23" y2="7" stroke="#FFD700" strokeWidth="2" strokeLinecap="round"/>
                    <Rect x="12" y="13" width="8" height="6" rx="2" fill="#1a1a2e"/>
                  </Svg>
                </View>
              </Marker>
            ) : null
          )}
        </MapView>

        {/* PANEL INFERIOR — ListaOfertas como bottom sheet */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
          <ListaOfertas
            viaje={viaje}
            usuarioId={usuarioId}
            esNegociable={esNegociableViaje}
            metodoPago={metodoPagoRef.current}
            conductoresCercanos={conductoresActivos.length}
            onConductorElegido={onConductorElegidoCb}
            onCancelar={cancelarViaje}
            tasas={tasas}
            comprobanteYaEnviado={comprobanteEnviado}
          />
        </View>
      </View>
    );
  }

  // ── VIAJE ACEPTADO / EN CURSO — mostrar conductor en camino ─────────────────
  if (viaje) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.logo}>ZAS</Text>
          <Text style={styles.saludo}>Hola, {usuarioNombre}</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={styles.viajeActivoTitulo}>
            {viaje.estado === 'aceptado' || viaje.estado === 'en_curso' ? 'Conductor en camino' : 'Procesando...'}
          </Text>
          {(viaje.estado === 'aceptado' || viaje.estado === 'en_curso') && (
            <View style={styles.conductorCard}>
              {viaje.conductor_foto
                ? <Image source={{ uri: viaje.conductor_foto }} style={styles.conductorFoto} />
                : <View style={styles.conductorFotoPlaceholder}>
                    <Text style={styles.conductorFotoLetra}>{viaje.conductor_nombre?.[0]?.toUpperCase() || '?'}</Text>
                  </View>
              }
              <View style={styles.conductorInfo}>
                <Text style={styles.conductorNombre}>{viaje.conductor_nombre || 'Conductor'}</Text>
                {viaje.conductor_placa ? <Text style={styles.conductorDetalle}>{viaje.conductor_modelo} · {viaje.conductor_placa}</Text> : null}
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
            {viaje.precio ? (
              <View>
                <Text style={[styles.viajeEstado, { color: '#FFD700', fontSize: 20 }]}>
                  {formatearPrecio(Number(viaje.precio)).cop} COP
                </Text>
                <View style={{ flexDirection: 'row', gap: 16, marginTop: 2 }}>
                  <Text style={{ color: '#aaa', fontSize: 12 }}>Bs {formatearPrecio(Number(viaje.precio)).bs}</Text>
                  <Text style={{ color: '#aaa', fontSize: 12 }}>$ {formatearPrecio(Number(viaje.precio)).usd}</Text>
                </View>
              </View>
            ) : <Text style={styles.viajeEstado}>—</Text>}
            <Text style={styles.viajeLabel}>Estado</Text>
            <Text style={styles.viajeEstado}>{viaje.estado?.toUpperCase()}</Text>
          </View>
          {(viaje.estado === 'aceptado' || viaje.estado === 'en_curso') && (
            <TouchableOpacity style={styles.botonVerMapa} onPress={() => router.push({
              pathname: '/mapa_viaje',
              params: {
                viaje_id: viaje.id, rol: 'usuario',
                conductor_id: viaje.conductor_id || '',
                conductor_nombre: viaje.conductor_nombre || '',
                conductor_telefono: viaje.conductor_telefono || '',
                conductor_foto: viaje.conductor_foto || '',
                conductor_placa: viaje.conductor_placa || '',
                conductor_modelo: viaje.conductor_modelo || '',
                origen: viaje.origen, destino: viaje.destino,
                origen_lat: viaje.origen_lat || '', origen_lng: viaje.origen_lng || '',
                destino_lat: viaje.destino_lat || '', destino_lng: viaje.destino_lng || '',
                pago_id: pagoIdRef.current || '',
                metodo_pago: metodoPagoRef.current || 'efectivo',
                monto_viaje: String(precioCalculadoRef.current || viaje.precio || 0),
                datos_zas: datosZasRef.current ? JSON.stringify(datosZasRef.current) : '',
              },
            })}>
              <Text style={styles.botonVerMapaTexto}>Ver en el mapa</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.botonCancelar} onPress={cancelarViaje}>
            <Text style={styles.botonCancelarTexto}>Cancelar viaje</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.botonCancelar, { marginTop: 8, borderColor: '#FFD700' }]} onPress={() => router.push('/historial')}>
            <Text style={[styles.botonCancelarTexto, { color: '#FFD700' }]}>Ver historial</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── PANTALLA CONFIRMAR VIAJE ──────────────────────────────────────────────
  if (paso === 'confirmar') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.logo}>ZAS</Text>
            <TouchableOpacity onPress={cerrarSesion} style={styles.botonCerrarHeader}>
              <Text style={styles.botonCerrarHeaderTexto}>Salir</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.saludo}>Hola, {usuarioNombre}</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={[styles.viajeActivoTitulo, { marginBottom: 20 }]}>Confirma tu viaje</Text>
          <View style={styles.viajeInfo}>
            <Text style={styles.viajeLabel}>Origen</Text>
            <Text style={styles.viajeValor}>{nombreOrigen}</Text>
            <Text style={styles.viajeLabel}>Destino</Text>
            <Text style={styles.viajeValor}>{nombreDestino}</Text>
            <Text style={styles.viajeLabel}>Precio calculado</Text>
            {calculandoPrecio ? (
              <ActivityIndicator color="#FFD700" style={{ marginTop: 8 }} />
            ) : (
              <View>
                <Text style={[styles.viajeEstado, { color: '#FFD700', fontSize: 26 }]}>
                  {formatearPrecio(esNegociable ? precioUsuario : precioCalculado).cop} COP
                </Text>
                <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
                  <Text style={{ color: '#aaa', fontSize: 13 }}>Bs {formatearPrecio(esNegociable ? precioUsuario : precioCalculado).bs}</Text>
                  <Text style={{ color: '#aaa', fontSize: 13 }}>$ {formatearPrecio(esNegociable ? precioUsuario : precioCalculado).usd}</Text>
                </View>
                {desglosePrecios && esNegociable && (
                  <View style={{ marginTop: 8, backgroundColor: '#0f3460', borderRadius: 8, padding: 10 }}>
                    <Text style={{ color: '#aaa', fontSize: 11 }}>
                      Base: {desglosePrecios.base?.toLocaleString('es-CO')} + Km: {desglosePrecios.km_cobrado?.toLocaleString('es-CO')} + Tiempo: {desglosePrecios.min_cobrado?.toLocaleString('es-CO')} COP
                    </Text>
                  </View>
                )}
              </View>
            )}
            {municipioTarifa ? <Text style={{ color: '#888', fontSize: 12, marginTop: 4 }}>Tarifa {tipoTarifa} — {municipioTarifa}</Text> : null}
          </View>

          {/* NEGOCIACIÓN — solo interurbanos */}
          {esNegociable && !calculandoPrecio && (
            <View style={styles.negociacionContainer}>
              <Text style={styles.negociacionTitulo}>Ajusta tu oferta al conductor</Text>
              <Text style={styles.negociacionSubtitulo}>
                Precio sugerido: {formatearPrecio(precioCalculado).cop} COP. Puedes ofrecer mas para que te acepten mas rapido.
              </Text>
              <View style={styles.negociacionControles}>
                <TouchableOpacity
                  style={styles.negociacionBoton}
                  onPress={() => ajustarPrecioUsuario(-1000)}
                  disabled={precioUsuario <= precioCalculado}
                >
                  <Text style={[styles.negociacionBotonTexto, precioUsuario <= precioCalculado && { opacity: 0.3 }]}>− 1.000</Text>
                </TouchableOpacity>
                <View style={styles.negociacionPrecio}>
                  <Text style={styles.negociacionPrecioTexto}>{precioUsuario.toLocaleString('es-CO')}</Text>
                  <Text style={styles.negociacionPrecioLabel}>COP</Text>
                </View>
                <TouchableOpacity style={styles.negociacionBoton} onPress={() => ajustarPrecioUsuario(1000)}>
                  <Text style={styles.negociacionBotonTexto}>+ 1.000</Text>
                </TouchableOpacity>
              </View>
              {precioUsuario > precioCalculado && (
                <Text style={{ color: '#00c853', fontSize: 12, textAlign: 'center', marginTop: 4 }}>
                  Estas ofreciendo {(precioUsuario - precioCalculado).toLocaleString('es-CO')} COP mas del precio base
                </Text>
              )}
              <Text style={{ color: '#888', fontSize: 11, textAlign: 'center', marginTop: 6 }}>
                Los conductores veran tu oferta y podran aceptarla o proponer otro precio
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.boton, (calculandoPrecio || !precioCalculado) && { opacity: 0.5 }]}
            onPress={() => setPaso('pagar')}
            disabled={calculandoPrecio || !precioCalculado}
          >
            <Text style={styles.botonTexto}>Continuar al pago →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.botonCancelar, { marginTop: 12 }]} onPress={reiniciarFlujo}>
            <Text style={styles.botonCancelarTexto}>Cambiar ruta</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── PANTALLA PAGAR — selección de método + comprobante previo ───────────────
  if (paso === 'pagar') {
    const precios = formatearPrecio(esNegociable ? precioUsuario : precioCalculado);
    const esDigital = metodoPago !== 'efectivo' && metodoPago !== 'pago_movil';

    // Si ya se eligió método digital y se pide mostrar el comprobante
    if (mostrarComprobantePrevio && esDigital && datosZasPrevio) {
      // Si el viaje ya fue aceptado mientras estaba en pantalla de comprobante → ir al mapa
      if (viaje && (viaje.estado === 'aceptado' || viaje.estado === 'en_curso') && !navegandoAlMapa) {
        setNavegandoAlMapa(true);
        setMostrarComprobantePrevio(false);
        router.push({
          pathname: '/mapa_viaje',
          params: {
            viaje_id: viaje.id,
            rol: 'usuario',
            conductor_id: viaje.conductor_id || '',
            conductor_nombre: viaje.conductor_nombre || '',
            conductor_telefono: viaje.conductor_telefono || '',
            conductor_foto: viaje.conductor_foto || '',
            conductor_placa: viaje.conductor_placa || '',
            conductor_modelo: viaje.conductor_modelo || '',
            origen: viaje.origen,
            destino: viaje.destino,
            origen_lat: viaje.origen_lat || '',
            origen_lng: viaje.origen_lng || '',
            destino_lat: viaje.destino_lat || '',
            destino_lng: viaje.destino_lng || '',
            pago_id: pagoIdRef.current || '',
            metodo_pago: metodoPagoRef.current || 'efectivo',
            monto_viaje: String(precioCalculadoRef.current || viaje.precio || 0),
            datos_zas: datosZasRef.current ? JSON.stringify(datosZasRef.current) : '',
          },
        });
        return null;
      }

      return (
        <View style={{ flex: 1, backgroundColor: '#1a1a2e' }}>
          <SubirComprobante
            pagoId={'previo'}
            metodo={metodoPago}
            monto={esNegociable ? precioUsuario : precioCalculado}
            datosZas={datosZasPrevio}
            tasas={{ usd_cop: tasas.usd_cop, usd_bs: tasas.cop_bs }}
            onComprobanteEnviado={(url) => {
              setComprobanteEnviado(true);
              setMostrarComprobantePrevio(false);
              if (url) setUrlComprobantePrevio(url);
            }}
          />
          {/* Botón volver */}
          <TouchableOpacity
            style={{ margin: 16, padding: 14, alignItems: 'center', backgroundColor: '#16213e', borderRadius: 12 }}
            onPress={() => setMostrarComprobantePrevio(false)}
          >
            <Text style={{ color: '#ff6b6b', fontWeight: 'bold' }}>← Cambiar método de pago</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Si el viaje ya fue solicitado y está buscando conductor
    // mostrar ListaOfertas para que su polling detecte la aceptación
    if (viaje && viaje.estado === 'buscando' && comprobanteEnviado) {
      const origenCoord = viaje.origen_lat
        ? { latitude: Number(viaje.origen_lat), longitude: Number(viaje.origen_lng) }
        : coordOrigen;
      const destinoCoord = viaje.destino_lat
        ? { latitude: Number(viaje.destino_lat), longitude: Number(viaje.destino_lng) }
        : coordDestino;
      const regionBuscando = origenCoord
        ? { latitude: origenCoord.latitude, longitude: origenCoord.longitude, latitudeDelta: 0.03, longitudeDelta: 0.03 }
        : region;
      return (
        <View style={{ flex: 1 }}>
          <MapView
            style={{ flex: 1 }}
            provider={PROVIDER_GOOGLE}
            region={regionBuscando}
            showsUserLocation={true}
            showsMyLocationButton={false}
            scrollEnabled={false}
            zoomEnabled={false}
          >
            {origenCoord && (
              <Marker coordinate={origenCoord} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#00c853', borderWidth: 2, borderColor: '#fff', elevation: 6, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#fff' }}>A</Text>
                </View>
              </Marker>
            )}
            {destinoCoord && (
              <Marker coordinate={destinoCoord} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={{ backgroundColor: 'transparent', elevation: 6, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 22 }}>🏁</Text>
                </View>
              </Marker>
            )}
          </MapView>
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
            <ListaOfertas
              viaje={viaje}
              usuarioId={usuarioId}
              esNegociable={esNegociableViaje}
              metodoPago={metodoPagoRef.current}
              conductoresCercanos={conductoresActivos.length}
              onConductorElegido={onConductorElegidoCb}
              onCancelar={cancelarViaje}
              tasas={tasas}
              comprobanteYaEnviado={comprobanteEnviado}
            />
          </View>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.logo}>ZAS</Text>
            <TouchableOpacity onPress={cerrarSesion} style={styles.botonCerrarHeader}>
              <Text style={styles.botonCerrarHeaderTexto}>Salir</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.saludo}>Elige cómo pagar</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20 }}>

          {/* RESUMEN DEL VIAJE */}
          <View style={styles.viajeInfo}>
            <Text style={styles.viajeLabel}>Origen</Text>
            <Text style={styles.viajeValor}>{nombreOrigen}</Text>
            <Text style={styles.viajeLabel}>Destino</Text>
            <Text style={styles.viajeValor}>{nombreDestino}</Text>
            <Text style={styles.viajeLabel}>Total a pagar</Text>
            <Text style={[styles.viajeEstado, { fontSize: 26, color: '#FFD700' }]}>{precios.cop} COP</Text>
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
              <Text style={{ color: '#aaa', fontSize: 13 }}>Bs {precios.bs}</Text>
              <Text style={{ color: '#aaa', fontSize: 13 }}>$ {precios.usd}</Text>
            </View>
          </View>

          {/* SELECCIÓN MÉTODO DE PAGO */}
          <View style={styles.pagoContainer}>
            <Text style={styles.pagoLabel}>Método de pago</Text>
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {['efectivo', 'bancolombia', 'nequi'].map(m => (
                  <TouchableOpacity key={m} style={[styles.pagoBoton, metodoPago === m && styles.pagoBotonActivo]} onPress={() => { setMetodoPago(m); setComprobanteEnviado(false); }}>
                    <Text style={[styles.pagoTexto, metodoPago === m && styles.pagoTextoActivo]}>
                      {m === 'efectivo' ? 'Efectivo' : m === 'bancolombia' ? 'Bancolombia' : 'Nequi'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {['pago_movil', 'zelle', 'usdt'].map(m => (
                  <TouchableOpacity key={m} style={[styles.pagoBoton, metodoPago === m && styles.pagoBotonActivo]} onPress={() => { setMetodoPago(m); setComprobanteEnviado(false); }}>
                    <Text style={[styles.pagoTexto, metodoPago === m && styles.pagoTextoActivo]}>
                      {m === 'pago_movil' ? 'Pago Movil' : m === 'zelle' ? 'Zelle' : 'USDT'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <Text style={{ color: '#888', fontSize: 12, marginTop: 8, textAlign: 'center' }}>
              {metodoPago === 'efectivo' ? 'Pago directo al conductor en efectivo' : 'Transfiere a ZAS y sube el comprobante para confirmar'}
            </Text>
          </View>

          {/* ESTADO COMPROBANTE ENVIADO */}
          {comprobanteEnviado && (
            <View style={{ backgroundColor: 'rgba(0,200,83,0.1)', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#00c853', alignItems: 'center' }}>
              <Text style={{ fontSize: 28, marginBottom: 8 }}>✅</Text>
              <Text style={{ color: '#00c853', fontWeight: 'bold', fontSize: 15, marginBottom: 4 }}>Comprobante enviado</Text>
              <Text style={{ color: '#aaa', fontSize: 12, textAlign: 'center' }}>ZAS verificará el pago mientras realizas el viaje</Text>
            </View>
          )}

          {/* BOTÓN PRINCIPAL */}
          {metodoPago === 'efectivo' || metodoPago === 'pago_movil' || comprobanteEnviado || esNegociable ? (
            // Efectivo o comprobante ya enviado → solicitar directo
            <TouchableOpacity
              style={[styles.boton, (calculandoPrecio || !precioCalculado || cargando) && { opacity: 0.5 }]}
              onPress={solicitarViaje}
              disabled={cargando || calculandoPrecio || !precioCalculado}
            >
              {cargando
                ? <ActivityIndicator color="#1a1a2e" />
                : <Text style={styles.botonTexto}>Solicitar ZAS ⚡</Text>
              }
            </TouchableOpacity>
          ) : (
            // Digital sin comprobante → ir a pagar primero
            <TouchableOpacity
              style={[styles.boton, cargandoDatosZas && { opacity: 0.6 }]}
              disabled={cargandoDatosZas}
              onPress={async () => {
                setCargandoDatosZas(true);
                try {
                  const res = await fetch(`${API_URL}/api/pagos/datos-pago/${metodoPago}`);
                  const data = await res.json();
                  setDatosZasPrevio(data.ok ? data.datos : null);
                } catch {
                  setDatosZasPrevio(null);
                }
                setCargandoDatosZas(false);
                setMostrarComprobantePrevio(true);
              }}
            >
              {cargandoDatosZas
                ? <ActivityIndicator color="#1a1a2e" />
                : <Text style={styles.botonTexto}>Pagar ahora →</Text>
              }
            </TouchableOpacity>
          )}

          <TouchableOpacity style={[styles.botonCancelar, { marginTop: 12 }]} onPress={() => setPaso('confirmar')}>
            <Text style={styles.botonCancelarTexto}>← Volver</Text>
          </TouchableOpacity>

        </ScrollView>
      </View>
    );
  }

  // ── MAPA PRINCIPAL ───────────────────────────────────────────────────────────
  return (
    <View style={styles.container} onTouchStart={resetearTimer}>
      <MapView key={mapKey} ref={mapRef} style={styles.mapa} provider={PROVIDER_GOOGLE} region={region} onRegionChangeComplete={onRegionChangeComplete} showsUserLocation={true} showsMyLocationButton={false}>
        {paso === 'destino' && coordOrigen && (
  <Marker coordinate={coordOrigen} anchor={{ x: 0.5, y: 1 }}>
    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#00c853', borderWidth: 2, borderColor: '#fff', elevation: 6, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#fff' }}>A</Text>
    </View>
  </Marker>
)}
        {conductoresActivos.map(conductor => (
          conductor.latitud && conductor.longitud ? (
            <Marker key={conductor.id} coordinate={{ latitude: Number(conductor.latitud), longitude: Number(conductor.longitud) }} title={conductor.nombre} description={conductor.modelo_moto || 'Mototaxi ZAS'}>
              <View style={{ backgroundColor: 'transparent', elevation: 5, alignItems: 'center', justifyContent: 'center' }}>
                <Svg width={32} height={36} viewBox="0 0 32 36">
                  <Ellipse cx="16" cy="16" rx="5" ry="10" fill="#FFD700"/>
                  <Ellipse cx="16" cy="28" rx="4" ry="5" fill="none" stroke="#FFD700" strokeWidth="2.5"/>
                  <Ellipse cx="16" cy="5" rx="4" ry="5" fill="none" stroke="#FFD700" strokeWidth="2.5"/>
                  <Line x1="9" y1="7" x2="23" y2="7" stroke="#FFD700" strokeWidth="2" strokeLinecap="round"/>
                  <Rect x="12" y="13" width="8" height="6" rx="2" fill="#1a1a2e"/>
                </Svg>
              </View>
            </Marker>
          ) : null
        ))}
      </MapView>

      {conductorSinSenal && viaje &&
       (viaje.estado === 'aceptado' || viaje.estado === 'en_curso') && (
        <View style={{
          position: 'absolute',
          bottom: 120,
          left: 16,
          right: 16,
          backgroundColor: 'rgba(0,0,0,0.85)',
          borderRadius: 12,
          padding: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          zIndex: 999,
        }}>
          <View style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: '#F59E0B',
          }} />
          <View style={{ flex: 1 }}>
            <Text style={{
              color: '#fff',
              fontWeight: 'bold',
              fontSize: 13,
            }}>
              Señal débil del conductor
            </Text>
            <Text style={{
              color: '#ccc',
              fontSize: 12,
              marginTop: 2,
            }}>
              Mostrando última posición conocida.
              El conductor sigue en camino.
            </Text>
          </View>
        </View>
      )}

      <View style={styles.pinContainer} pointerEvents="none">
        <Text style={styles.pinEmoji}>📍</Text>
        <View style={styles.pinSombra} />
      </View>

      <View style={styles.headerFlotante}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Text style={styles.logoFlotante}>ZAS — {usuarioNombre}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={abrirPerfil} style={styles.botonPerfilFlotante}><Text style={styles.botonPerfilTexto}>✏️</Text></TouchableOpacity>
            <TouchableOpacity onPress={cerrarSesion} style={styles.botonCerrarFlotante}><Text style={styles.botonCerrarFlotanteTexto}>Salir</Text></TouchableOpacity>
          </View>
        </View>
        <View style={styles.progreso}>
          <View style={[styles.progresoStep, paso === 'origen' && styles.progresoStepActivo]}><Text style={[styles.progresoTexto, paso === 'origen' && styles.progresoTextoActivo]}>1. Origen</Text></View>
          <View style={styles.progresoLinea} />
          <View style={[styles.progresoStep, paso === 'destino' && styles.progresoStepActivo]}><Text style={[styles.progresoTexto, paso === 'destino' && styles.progresoTextoActivo]}>2. Destino</Text></View>
        </View>
        <Text style={styles.instruccion}>{paso === 'origen' ? 'Mueve el mapa a tu ubicacion de origen' : 'Mueve el mapa a tu destino'}</Text>
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
            <Text style={styles.origenConfirmadoLabel}>Origen confirmado</Text>
            <Text style={styles.origenConfirmadoValor} numberOfLines={1}>{nombreOrigen}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.botonConfirmarContainer}>
        <TouchableOpacity style={[styles.botonConfirmar, cargandoDireccion && { opacity: 0.7 }]} onPress={confirmarPunto} disabled={cargandoDireccion}>
          {cargandoDireccion ? <ActivityIndicator color="#1a1a2e" /> : <Text style={styles.botonConfirmarTexto}>{paso === 'origen' ? 'Confirmar origen' : 'Confirmar destino'}</Text>}
        </TouchableOpacity>
      </View>
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
  botonCerrarFlotante: { backgroundColor: '#16213e', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: '#ff6b6b' },
  botonCerrarFlotanteTexto: { color: '#ff6b6b', fontSize: 12, fontWeight: '600' },
  botonCerrarHeader: { backgroundColor: '#16213e', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: '#ff6b6b' },
  botonCerrarHeaderTexto: { color: '#ff6b6b', fontSize: 13, fontWeight: '600' },
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
  botonConfirmarContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 48, backgroundColor: 'rgba(26,26,46,0.97)', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  botonConfirmar: { backgroundColor: '#FFD700', borderRadius: 14, padding: 16, alignItems: 'center' },
  botonConfirmarTexto: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 16 },
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
  pagoBoton: { flex: 1, backgroundColor: '#16213e', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#0f3460' },
  pagoBotonActivo: { borderColor: '#FFD700' },
  pagoTexto: { color: '#888', fontSize: 12, fontWeight: '600' },
  pagoTextoActivo: { color: '#FFD700' },
  boton: { backgroundColor: '#FFD700', borderRadius: 14, padding: 18, alignItems: 'center', marginTop: 8 },
  botonTexto: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 16 },
  botonPerfilTexto: { color: '#FFD700', fontSize: 13, fontWeight: 'bold' },
  negociacionContainer: { backgroundColor: '#0f3460', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#FFD700' },
  negociacionTitulo: { color: '#FFD700', fontSize: 15, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  negociacionSubtitulo: { color: '#aaa', fontSize: 12, textAlign: 'center', marginBottom: 14 },
  negociacionControles: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  negociacionBoton: { backgroundColor: '#16213e', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#FFD700' },
  negociacionBotonTexto: { color: '#FFD700', fontWeight: 'bold', fontSize: 14 },
  negociacionPrecio: { alignItems: 'center' },
  negociacionPrecioTexto: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  negociacionPrecioLabel: { color: '#888', fontSize: 12 },
});
