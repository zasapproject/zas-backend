// ═══════════════════════════════════════════
// ListaOfertas.tsx
// Pantalla que el usuario ve mientras espera conductores
// Muestra temporizador + lista de ofertas en interurbanos
// Copiar a: zas-app/app/components/ListaOfertas.tsx
//   (o crear carpeta components si no existe)
// ═══════════════════════════════════════════
import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Image, ActivityIndicator, Alert, Platform
} from 'react-native';
import SubirComprobante from '../SubirComprobante';

const API_URL = 'https://zasapps.com';

interface Oferta {
  id: string;
  precio_oferta: number;
  conductor_id: string;
  conductor_nombre: string;
  conductor_foto: string;
  conductor_calificacion: number;
  conductor_modelo: string;
  conductor_placa: string;
  created_at: string;
}

interface Props {
  viaje: any;
  usuarioId: string;
  esNegociable: boolean;
  metodoPago: string;
  onConductorElegido: (viaje: any, conductor: any) => void;
  onCancelar: () => void;
  tasas?: { cop_bs: number; usd_cop: number };
  comprobanteYaEnviado?: boolean;
  conductoresCercanos?: number;
}

export default function ListaOfertas({
  viaje, usuarioId, esNegociable, metodoPago, onConductorElegido, onCancelar, tasas, comprobanteYaEnviado
}: Props) {
  const [segundos, setSegundos] = useState(0);
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [cargandoOfertas, setCargandoOfertas] = useState(false);
  const [eligiendo, setEligiendo] = useState<string | null>(null);
  const intervaloTimer = useRef<any>(null);
  const intervaloOfertas = useRef<any>(null);
  const [pagoPendienteNegociacion, setPagoPendienteNegociacion] = useState<{
    viaje: any; conductor: any; ofertaPrecio: number;
  } | null>(null);
  const [datosZasNegociacion, setDatosZasNegociacion] = useState<any>(null);
  const [pagoIdNegociacion, setPagoIdNegociacion] = useState<string | null>(null);
  const [cargandoPagoNegociacion, setCargandoPagoNegociacion] = useState(false);

  // Temporizador de espera
  useEffect(() => {
    intervaloTimer.current = setInterval(() => {
      setSegundos(s => s + 1);
    }, 1000);
    return () => clearInterval(intervaloTimer.current);
  }, []);

  // Polling de ofertas — solo para interurbanos
  useEffect(() => {
    if (!esNegociable) return;
    const buscarOfertas = async () => {
      try {
        // 1. Buscar ofertas de conductores
        const res = await fetch(`${API_URL}/api/viajes/${viaje.id}/ofertas`);
        const data = await res.json();
        if (data.ok) setOfertas(data.ofertas || []);

        // 2. Verificar si el conductor aceptó directo (sin contraofertar)
        const resViaje = await fetch(`${API_URL}/api/viajes/usuario/${usuarioId}`);
        const dataViaje = await resViaje.json();
        if (dataViaje.ok && dataViaje.viajes.length > 0) {
          const viajeActual = dataViaje.viajes.find((v: any) => v.id === viaje.id);
          if (viajeActual && (viajeActual.estado === 'aceptado' || viajeActual.estado === 'en_curso')) {
            clearInterval(intervaloOfertas.current);
            clearInterval(intervaloTimer.current);
            const conductorObj = {
              id: viajeActual.conductor_id,
              nombre: viajeActual.conductor_nombre,
              telefono: viajeActual.conductor_telefono,
              foto_url: viajeActual.conductor_foto,
              placa_moto: viajeActual.conductor_placa,
              modelo_moto: viajeActual.conductor_modelo,
            };
            if (metodoPago && metodoPago !== 'efectivo' && metodoPago !== 'pago_movil' && !comprobanteYaEnviado) {
              // Pago digital sin comprobante previo — crear pago y mostrar comprobante
              setCargandoPagoNegociacion(true);
              try {
                const [resDatos, resPago] = await Promise.all([
                  fetch(`${API_URL}/api/pagos/datos-pago/${metodoPago}`),
                  fetch(`${API_URL}/api/pagos/nuevo`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      viaje_id: viajeActual.id,
                      monto: viajeActual.precio,
                      metodo: metodoPago,
                    }),
                  }),
                ]);
                const dataDatos = await resDatos.json();
                const dataPago = await resPago.json();
                setDatosZasNegociacion(dataDatos.ok ? dataDatos.datos : null);
                setPagoIdNegociacion(dataPago.ok ? dataPago.pago.id : null);
                setPagoPendienteNegociacion({
                  viaje: viajeActual,
                  conductor: conductorObj,
                  ofertaPrecio: viajeActual.precio,
                });
              } catch {
                Alert.alert('Error', 'No se pudo iniciar el pago. Intenta de nuevo.');
                onConductorElegido(viajeActual, conductorObj);
              } finally {
                setCargandoPagoNegociacion(false);
              }
            } else {
              // Efectivo, Pago Móvil o comprobante ya enviado → directo al mapa
              onConductorElegido(viajeActual, conductorObj);
            }
          }
        }
      } catch {}
    };
    buscarOfertas();
    intervaloOfertas.current = setInterval(buscarOfertas, 6000);
    return () => clearInterval(intervaloOfertas.current);
  }, [viaje.id, esNegociable, usuarioId]);

  // Polling de respaldo — viajes NO negociables (aceptacion directa del conductor)
  // Sin esto, el usuario depende solo de push notification y puede quedar
  // congelado en "buscando" aunque el conductor ya haya aceptado.
  const intervaloEstadoDirecto = useRef<any>(null);
  useEffect(() => {
    if (esNegociable) return;
    const revisarEstado = async () => {
      try {
        const res = await fetch(`${API_URL}/api/viajes/usuario/${usuarioId}`);
        const data = await res.json();
        if (data.ok && data.viajes.length > 0) {
          const viajeActual = data.viajes.find((v: any) => v.id === viaje.id);
          if (viajeActual && (viajeActual.estado === 'aceptado' || viajeActual.estado === 'en_curso')) {
            clearInterval(intervaloEstadoDirecto.current);
            clearInterval(intervaloTimer.current);
            const conductorObj = {
              id: viajeActual.conductor_id,
              nombre: viajeActual.conductor_nombre,
              telefono: viajeActual.conductor_telefono,
              foto_url: viajeActual.conductor_foto,
              placa_moto: viajeActual.conductor_placa,
              modelo_moto: viajeActual.conductor_modelo,
            };
            if (metodoPago && metodoPago !== 'efectivo' && metodoPago !== 'pago_movil' && !comprobanteYaEnviado) {
              // Pago digital sin comprobante previo — crear pago y mostrar comprobante
              setCargandoPagoNegociacion(true);
              try {
                const [resDatos, resPago] = await Promise.all([
                  fetch(`${API_URL}/api/pagos/datos-pago/${metodoPago}`),
                  fetch(`${API_URL}/api/pagos/nuevo`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      viaje_id: viajeActual.id,
                      monto: viajeActual.precio,
                      metodo: metodoPago,
                    }),
                  }),
                ]);
                const dataDatos = await resDatos.json();
                const dataPago = await resPago.json();
                setDatosZasNegociacion(dataDatos.ok ? dataDatos.datos : null);
                setPagoIdNegociacion(dataPago.ok ? dataPago.pago.id : null);
                setPagoPendienteNegociacion({
                  viaje: viajeActual,
                  conductor: conductorObj,
                  ofertaPrecio: viajeActual.precio,
                });
              } catch {
                Alert.alert('Error', 'No se pudo iniciar el pago. Intenta de nuevo.');
                onConductorElegido(viajeActual, conductorObj);
              } finally {
                setCargandoPagoNegociacion(false);
              }
            } else {
              // Efectivo, Pago Móvil o comprobante ya enviado → directo al mapa
              onConductorElegido(viajeActual, conductorObj);
            }
          }
        }
      } catch {}
    };
    revisarEstado();
    intervaloEstadoDirecto.current = setInterval(revisarEstado, 6000);
    return () => clearInterval(intervaloEstadoDirecto.current);
  }, [viaje.id, esNegociable, usuarioId]);

  const formatearTiempo = (s: number) => {
    const min = Math.floor(s / 60);
    const seg = s % 60;
    return `${min}:${seg.toString().padStart(2, '0')}`;
  };

  const elegirConductor = async (oferta: Oferta) => {
    setEligiendo(oferta.id);
    try {
      const res = await fetch(`${API_URL}/api/viajes/${viaje.id}/elegir-conductor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oferta_id: oferta.id, usuario_id: usuarioId, metodo_pago: metodoPago }),
      });
      const data = await res.json();
      if (data.ok) {
        clearInterval(intervaloOfertas.current);
        clearInterval(intervaloTimer.current);

        if (metodoPago && metodoPago !== 'efectivo' && metodoPago !== 'pago_movil') {
          // Pago digital — mostrar pantalla de comprobante por el precio final
          setCargandoPagoNegociacion(true);
          try {
            const [resDatos, resPago] = await Promise.all([
              fetch(`${API_URL}/api/pagos/datos-pago/${metodoPago}`),
              fetch(`${API_URL}/api/pagos/nuevo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  viaje_id: viaje.id,
                  monto: oferta.precio_oferta,
                  metodo: metodoPago,
                }),
              }),
            ]);
            const dataDatos = await resDatos.json();
            const dataPago = await resPago.json();
            setDatosZasNegociacion(dataDatos.ok ? dataDatos.datos : null);
            setPagoIdNegociacion(dataPago.ok ? dataPago.pago.id : null);
            setPagoPendienteNegociacion({
              viaje: data.viaje,
              conductor: data.conductor,
              ofertaPrecio: oferta.precio_oferta,
            });
          } catch {
            Alert.alert('Error', 'No se pudo iniciar el pago. Intenta de nuevo.');
          }
          setCargandoPagoNegociacion(false);
        } else {
          // Efectivo — flujo normal, directo al mapa
          onConductorElegido(data.viaje, data.conductor);
        }
      } else {
        Alert.alert('Error', data.error || 'No se pudo elegir el conductor');
      }
    } catch {
      Alert.alert('Error', 'No se pudo conectar');
    } finally {
      setEligiendo(null);
    }
  };

  const confirmarPagoYContinuar = async () => {
    if (!pagoPendienteNegociacion) return;
    try {
      await fetch(`${API_URL}/api/viajes/${pagoPendienteNegociacion.viaje.id}/confirmar-pago-negociacion`, {
        method: 'PATCH',
      });
    } catch {}
    onConductorElegido(pagoPendienteNegociacion.viaje, pagoPendienteNegociacion.conductor);
  };

  const estrellas = (cal: number) => {
    const n = Math.round(cal || 5);
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  };

  if (pagoPendienteNegociacion) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1a1a2e' }}>
        <SubirComprobante
          pagoId={pagoIdNegociacion || 'previo'}
          metodo={metodoPago}
          monto={pagoPendienteNegociacion.ofertaPrecio}
          datosZas={datosZasNegociacion}
          tasas={{ usd_cop: tasas?.usd_cop ?? 3600, usd_bs: tasas?.cop_bs ?? 4.3 }}
          onComprobanteEnviado={confirmarPagoYContinuar}
        />
      </View>
    );
  }

  if (cargandoPagoNegociacion) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#FFD700" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* HEADER CON TEMPORIZADOR */}
      <View style={styles.header}>
        <View style={styles.timerContainer}>
          <Text style={styles.timerLabel}>Buscando conductor</Text>
          <Text style={styles.timerValor}>{formatearTiempo(segundos)}</Text>
        </View>
        <View style={styles.rutas}>
          <View style={styles.rutaFila}>
            <View style={[styles.rutaDot, { backgroundColor: '#00c853' }]} />
            <Text style={styles.rutaTexto} numberOfLines={1}>{viaje.origen_texto || viaje.origen}</Text>
          </View>
          <View style={[styles.rutaLinea]} />
          <View style={styles.rutaFila}>
            <View style={[styles.rutaDot, { backgroundColor: '#ff1744' }]} />
            <Text style={styles.rutaTexto} numberOfLines={1}>{viaje.destino_texto || viaje.destino}</Text>
          </View>
        </View>
        <View style={styles.precioFila}>
          <Text style={styles.precioLabel}>Tu oferta:</Text>
          <Text style={styles.precioValor}>
            {Number(viaje.precio_usuario || viaje.precio)?.toLocaleString('es-CO')} COP
          </Text>
        </View>
      </View>

      {/* CUERPO */}
      <ScrollView contentContainerStyle={styles.body}>
        {esNegociable ? (
          <>
            {/* INTERURBANO — lista de ofertas */}
            <Text style={styles.seccionTitulo}>
              {ofertas.length === 0
                ? 'Esperando ofertas de conductores...'
                : `${ofertas.length} conductor${ofertas.length > 1 ? 'es' : ''} ofertaron`}
            </Text>

            {ofertas.length === 0 ? (
              <View style={styles.esperandoContainer}>
                <ActivityIndicator color="#FFD700" size="large" />
                <Text style={styles.esperandoTexto}>
                  Los conductores cercanos están revisando tu solicitud.{'\n'}
                  Puedes esperar o cancelar y ajustar tu precio.
                </Text>
              </View>
            ) : (
              ofertas.map(oferta => (
                <View key={oferta.id} style={styles.ofertaCard}>
                  <View style={styles.ofertaHeader}>
                    {oferta.conductor_foto
                      ? <Image source={{ uri: oferta.conductor_foto }} style={styles.conductorFoto} />
                      : <View style={[styles.conductorFoto, styles.conductorFotoPlaceholder]}>
                          <Text style={styles.conductorLetra}>
                            {oferta.conductor_nombre?.[0]?.toUpperCase() || '?'}
                          </Text>
                        </View>
                    }
                    <View style={styles.conductorInfo}>
                      <Text style={styles.conductorNombre}>{oferta.conductor_nombre}</Text>
                      <Text style={styles.conductorEstrellas}>
                        {estrellas(oferta.conductor_calificacion)}
                        <Text style={styles.conductorCalNum}> {(oferta.conductor_calificacion || 5).toFixed(1)}</Text>
                      </Text>
                      <Text style={styles.conductorMoto}>
                        {oferta.conductor_modelo} · {oferta.conductor_placa}
                      </Text>
                    </View>
                    <View style={styles.ofertaPrecioContainer}>
                      <Text style={styles.ofertaPrecio}>
                        {Number(oferta.precio_oferta).toLocaleString('es-CO')}
                      </Text>
                      <Text style={styles.ofertaPrecioLabel}>COP</Text>
                      {oferta.precio_oferta <= Number(viaje.precio_usuario || viaje.precio) && (
                        <View style={styles.badgeOk}>
                          <Text style={styles.badgeOkTexto}>Tu precio</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.botonElegir}
                    onPress={() => elegirConductor(oferta)}
                    disabled={eligiendo === oferta.id}
                  >
                    {eligiendo === oferta.id
                      ? <ActivityIndicator color="#1a1a2e" />
                      : <Text style={styles.botonElegirTexto}>Elegir este conductor</Text>
                    }
                  </TouchableOpacity>
                </View>
              ))
            )}

            {ofertas.length > 0 && (
              <Text style={styles.tipTexto}>
                Los precios están ordenados de menor a mayor.{'\n'}
                Elige al conductor que más te convenga.
              </Text>
            )}
          </>
        ) : (
          <>
            {/* URBANO — solo spinner y mensaje */}
            <View style={styles.esperandoContainer}>
              <ActivityIndicator color="#FFD700" size="large" />
              <Text style={styles.esperandoTexto}>
                Enviando solicitud a conductores cercanos.{'\n'}
                El primero disponible tomará tu viaje.
              </Text>
            </View>
            {segundos > 60 && (
              <View style={styles.alertaTiempo}>
                <Text style={styles.alertaTiempoTexto}>
                  Llevamos más de 1 minuto buscando.{'\n'}
                  Si no aparece un conductor pronto, puede que no haya disponibles en este momento.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* BOTÓN CANCELAR */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.botonCancelar} onPress={onCancelar}>
          <Text style={styles.botonCancelarTexto}>Cancelar viaje</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },

  // Header
  header: { backgroundColor: '#16213e', padding: 20, paddingTop: 50, borderBottomWidth: 1, borderBottomColor: '#0f3460' },
  timerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  timerLabel: { color: '#aaa', fontSize: 14, fontWeight: '600' },
  timerValor: { color: '#FFD700', fontSize: 28, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  rutas: { marginBottom: 12 },
  rutaFila: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  rutaDot: { width: 10, height: 10, borderRadius: 5 },
  rutaLinea: { width: 2, height: 8, backgroundColor: '#333', marginLeft: 4 },
  rutaTexto: { color: '#fff', fontSize: 13, flex: 1 },
  precioFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f3460', borderRadius: 10, padding: 12, marginTop: 4 },
  precioLabel: { color: '#aaa', fontSize: 13 },
  precioValor: { color: '#FFD700', fontSize: 18, fontWeight: 'bold' },

  // Body
  body: { padding: 16, paddingBottom: 100 },
  seccionTitulo: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },

  // Esperando
  esperandoContainer: { alignItems: 'center', paddingVertical: 40, gap: 20 },
  esperandoTexto: { color: '#888', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  alertaTiempo: { backgroundColor: '#3a2a00', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#FFD700', marginTop: 16 },
  alertaTiempoTexto: { color: '#FFD700', fontSize: 13, textAlign: 'center', lineHeight: 20 },

  // Oferta card
  ofertaCard: { backgroundColor: '#16213e', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#0f3460' },
  ofertaHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  conductorFoto: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: '#FFD700' },
  conductorFotoPlaceholder: { backgroundColor: '#FFD700', justifyContent: 'center', alignItems: 'center' },
  conductorLetra: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 22 },
  conductorInfo: { flex: 1, marginLeft: 12 },
  conductorNombre: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 2 },
  conductorEstrellas: { color: '#FFD700', fontSize: 13, marginBottom: 2 },
  conductorCalNum: { color: '#aaa', fontSize: 12 },
  conductorMoto: { color: '#888', fontSize: 12 },
  ofertaPrecioContainer: { alignItems: 'flex-end' },
  ofertaPrecio: { color: '#FFD700', fontSize: 20, fontWeight: 'bold' },
  ofertaPrecioLabel: { color: '#aaa', fontSize: 11 },
  badgeOk: { backgroundColor: '#00c853', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4 },
  badgeOkTexto: { color: '#fff', fontSize: 10, fontWeight: '700' },
  botonElegir: { backgroundColor: '#FFD700', borderRadius: 10, padding: 12, alignItems: 'center' },
  botonElegirTexto: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 15 },
  tipTexto: { color: '#555', fontSize: 12, textAlign: 'center', marginTop: 8, lineHeight: 18 },

  // Footer
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: Platform.OS === 'ios' ? 16 : 48, backgroundColor: '#1a1a2e', borderTopWidth: 1, borderTopColor: '#0f3460' },
  botonCancelar: { backgroundColor: '#3a1a1a', borderRadius: 12, padding: 14, alignItems: 'center' },
  botonCancelarTexto: { color: '#ff6b6b', fontWeight: 'bold', fontSize: 15 },
});
