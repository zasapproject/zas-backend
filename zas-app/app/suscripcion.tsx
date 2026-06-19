import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
  ScrollView, TextInput, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const API_URL = 'https://zas-backend-production-fb4e.up.railway.app';

const DATOS_ZAS: Record<string, Record<string, string>> = {
  bancolombia: {
    Tipo:    'Cuenta de Ahorros',
    Número:  '08810657384',
    Titular: 'Jhonatan Rincon',
    CC:      '1232391490',
  },
  nequi: {
    Número:  '3113003100',
    Titular: 'Jhonatan Rincon',
  },
  pago_movil: {
    Banco:   'Banco Venezuela',
    Teléfono:'0414-7224623',
    Cédula:  'V-17677795',
    Titular: 'Rosmaire Vivas',
  },
  zelle: {
    Email:   'jrchinchilla82@gmail.com',
    Titular: 'Jhonatan Rincon',
  },
  usdt: {
    Red:     'TRC20',
    Wallet:  'TCQou8bEo2jwsvtaoRLFkA4FPWQrZXVsTt',
  },
};

const METODOS = [
  { key: 'efectivo',    label: '💵 Efectivo',      sub: 'Pago en oficinas ZAS' },
  { key: 'bancolombia', label: '🏦 Bancolombia',    sub: 'Transferencia bancaria' },
  { key: 'nequi',       label: '📱 Nequi',          sub: 'Transferencia Nequi' },
  { key: 'pago_movil',  label: '📲 Pago Móvil',     sub: 'Banco Venezuela' },
  { key: 'zelle',       label: '💸 Zelle',           sub: 'Transferencia Zelle' },
  { key: 'usdt',        label: '🪙 USDT',            sub: 'Red TRC20' },
];

// Tasas fijas
const TASAS = { usd_cop: 4000, usd_bs: 87.12 };
const MONTO_SUSCRIPCION_COP = 15000;

type Pantalla = 'inicio' | 'metodos' | 'comprobante';

export default function SuscripcionScreen() {
  const [estado, setEstado]         = useState<any>(null);
  const [cargando, setCargando]     = useState(true);
  const [conductorId, setConductorId] = useState('');
  const [pantalla, setPantalla]     = useState<Pantalla>('inicio');
  const [metodoPago, setMetodoPago] = useState('');
  const [pagoId, setPagoId]         = useState('');

  // comprobante
  const [referencia, setReferencia]           = useState('');
  const [fotoComprobante, setFotoComprobante] = useState('');
  const [enviando, setEnviando]               = useState(false);

  const cargarEstado = async () => {
    setCargando(true);
    try {
      const sesion = await AsyncStorage.getItem('conductor_sesion');
      if (!sesion) { setCargando(false); return; }
      const conductor = JSON.parse(sesion);
      setConductorId(conductor.id);
      const res  = await fetch(`${API_URL}/api/suscripciones/estado/${conductor.id}`);
      const data = await res.json();
      setEstado(data);
    } catch {
      Alert.alert('Error', 'No se pudo verificar la suscripción');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargarEstado(); }, []);

  // ─── seleccionar método ───────────────────────────────────────────────────
  const seleccionarMetodo = async (key: string) => {
    if (key === 'efectivo') {
      // registrar solicitud sin comprobante
      try {
        await fetch(`${API_URL}/api/suscripciones/registrar-solicitud`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conductor_id: conductorId, metodo_pago: 'efectivo', monto: MONTO_SUSCRIPCION_COP }),
        });
      } catch {}
      Alert.alert(
        '📋 Solicitud registrada',
        `Acércate a las oficinas ZAS con tu pago de $${MONTO_SUSCRIPCION_COP.toLocaleString('es-CO')} COP. El administrador activará tu suscripción.`,
        [{ text: 'OK', onPress: () => setPantalla('inicio') }],
      );
      return;
    }

    // digital: registrar solicitud pendiente y pasar a pantalla de comprobante
    try {
      const res  = await fetch(`${API_URL}/api/suscripciones/registrar-solicitud`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conductor_id: conductorId, metodo_pago: key, monto: MONTO_SUSCRIPCION_COP }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error();
      setPagoId(data.pago_id);
      setMetodoPago(key);
      setReferencia('');
      setFotoComprobante('');
      setPantalla('comprobante');
    } catch {
      Alert.alert('Error', 'No se pudo registrar la solicitud. Intenta de nuevo.');
    }
  };

  // ─── foto ─────────────────────────────────────────────────────────────────
  const seleccionarFoto = () => {
    Alert.alert('Comprobante', '¿Cómo quieres agregar la foto?', [
      { text: 'Cámara', onPress: async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') return;
        const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.5, base64: true });
        if (!result.canceled) setFotoComprobante('data:image/jpeg;base64,' + result.assets[0].base64);
      }},
      { text: 'Galería', onPress: async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return;
        const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.5, base64: true });
        if (!result.canceled) setFotoComprobante('data:image/jpeg;base64,' + result.assets[0].base64);
      }},
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  // ─── enviar comprobante ───────────────────────────────────────────────────
  const subirComprobante = async () => {
    if (!fotoComprobante) { Alert.alert('Error', 'Debes tomar o seleccionar la foto del comprobante'); return; }
    setEnviando(true);
    try {
      // 1. subir foto a storage
      const resStorage = await fetch(`${API_URL}/api/storage/subir-foto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64: fotoComprobante, nombre: `suscripcion_${pagoId}`, carpeta: 'comprobantes' }),
      });
      const dataStorage = await resStorage.json();
      if (!dataStorage.ok) { Alert.alert('Error', 'No se pudo subir la foto'); return; }

      // 2. enviar comprobante
      const res  = await fetch(`${API_URL}/api/suscripciones/subir-comprobante/${pagoId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comprobante_url: dataStorage.url, referencia: referencia || null }),
      });
      const data = await res.json();
      if (data.ok) {
        Alert.alert(
          '✅ Comprobante enviado',
          'ZAS lo revisará en breve y activará tu suscripción.',
          [{ text: 'OK', onPress: () => { setPantalla('inicio'); cargarEstado(); } }],
        );
      } else {
        Alert.alert('Error', data.error || 'No se pudo enviar el comprobante');
      }
    } catch {
      Alert.alert('Error', 'No se pudo subir el comprobante. Verifica tu conexión e intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  // ─── renderizar ───────────────────────────────────────────────────────────
  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator color="#FFD700" size="large" />
        <Text style={styles.cargandoTexto}>Verificando suscripción...</Text>
      </View>
    );
  }

  // PANTALLA: selección de método de pago
  if (pantalla === 'metodos') {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.logo}>⚡ ZAS</Text>
          <Text style={styles.titulo}>Selecciona cómo pagar</Text>
          <Text style={styles.subtitulo}>${MONTO_SUSCRIPCION_COP.toLocaleString('es-CO')} COP · 7 días</Text>
        </View>
        {METODOS.map(m => (
          <TouchableOpacity key={m.key} style={styles.metodoCard} onPress={() => seleccionarMetodo(m.key)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.metodoLabel}>{m.label}</Text>
              <Text style={styles.metodoSub}>{m.sub}</Text>
            </View>
            <Text style={styles.metodoFlecha}>›</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={() => setPantalla('inicio')} style={styles.cancelarBtn}>
          <Text style={styles.cancelarTexto}>Cancelar</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // PANTALLA: subir comprobante
  if (pantalla === 'comprobante') {
    const datos = DATOS_ZAS[metodoPago] || {};
    const montoUsd = (MONTO_SUSCRIPCION_COP / TASAS.usd_cop).toFixed(2);
    const montoBs  = (MONTO_SUSCRIPCION_COP / TASAS.usd_cop * TASAS.usd_bs).toLocaleString('es-VE', { maximumFractionDigits: 2 });

    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.container} contentContainerStyle={{ padding: 24 }}>
          <Text style={styles.titulo}>Confirmar pago</Text>
          <Text style={styles.subtitulo}>Transfiere y sube el comprobante</Text>

          {/* monto */}
          <View style={styles.montoBox}>
            <Text style={styles.montoLabel}>Monto a pagar</Text>
            <Text style={styles.monto}>{MONTO_SUSCRIPCION_COP.toLocaleString('es-CO')} COP</Text>
            <View style={{ flexDirection: 'row', gap: 20, marginTop: 6 }}>
              <Text style={styles.montoSecundario}>Bs {montoBs}</Text>
              <Text style={styles.montoSecundario}>$ {montoUsd}</Text>
            </View>
            <Text style={styles.metodoLabelSmall}>
              Método: {METODOS.find(m => m.key === metodoPago)?.label || metodoPago}
            </Text>
          </View>

          {/* datos ZAS */}
          <View style={styles.datosBox}>
            <Text style={styles.datosTitle}>Datos de ZAS para transferir</Text>
            {Object.entries(datos).map(([k, v]) => (
              <View key={k} style={styles.datoFila}>
                <Text style={styles.datoKey}>{k}</Text>
                <Text style={styles.datoVal}>{v}</Text>
              </View>
            ))}
          </View>

          {/* referencia */}
          <Text style={styles.inputLabel}>Número de referencia (opcional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: 123456789"
            placeholderTextColor="#888"
            value={referencia}
            onChangeText={setReferencia}
            keyboardType="numeric"
          />

          {/* foto */}
          <Text style={styles.inputLabel}>Foto del comprobante</Text>
          <TouchableOpacity
            style={[styles.fotoBoton, fotoComprobante ? { borderColor: '#00c853' } : { borderColor: '#FFD700' }]}
            onPress={seleccionarFoto}
          >
            {fotoComprobante
              ? <Image source={{ uri: fotoComprobante }} style={styles.fotoPreview} />
              : <Text style={styles.fotoBotonTexto}>📷 Tomar o seleccionar foto</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.boton, (!fotoComprobante || enviando) && { opacity: 0.5 }]}
            onPress={subirComprobante}
            disabled={enviando || !fotoComprobante}
          >
            {enviando
              ? <ActivityIndicator color="#1a1a2e" />
              : <Text style={styles.botonTexto}>Enviar comprobante</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setPantalla('metodos')} style={styles.cancelarBtn}>
            <Text style={styles.cancelarTexto}>← Cambiar método de pago</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // PANTALLA PRINCIPAL
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>⚡ ZAS</Text>
        <Text style={styles.titulo}>Suscripción Conductor</Text>
        <Text style={styles.subtitulo}>Accede a todos los viajes disponibles</Text>
      </View>

      <View style={[styles.estadoCard, estado?.activo ? styles.cardActivo : styles.cardInactivo]}>
        <Text style={styles.estadoIcon}>{estado?.activo ? '✅' : '⛔'}</Text>
        <Text style={styles.estadoTexto}>{estado?.activo ? 'Suscripción Activa' : 'Sin Suscripción'}</Text>
        {estado?.activo && (
          <>
            <Text style={styles.diasTexto}>{estado.dias_restantes} días restantes</Text>
            <Text style={styles.fechaTexto}>
              Vence: {new Date(estado.suscripcion_hasta).toLocaleDateString('es-CO')}
            </Text>
          </>
        )}
        {!estado?.activo && (
          <Text style={styles.inactivoSubtexto}>Activa tu suscripción para recibir viajes</Text>
        )}
      </View>

      <View style={styles.precioCard}>
        <Text style={styles.precioTitulo}>Plan Semanal</Text>
        <Text style={styles.precio}>{MONTO_SUSCRIPCION_COP.toLocaleString('es-CO')} COP</Text>
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 2 }}>
          <Text style={styles.precioUsd}>Bs {(MONTO_SUSCRIPCION_COP / TASAS.usd_cop * TASAS.usd_bs).toLocaleString('es-VE', { maximumFractionDigits: 2 })}</Text>
          <Text style={styles.precioUsd}>$ {(MONTO_SUSCRIPCION_COP / TASAS.usd_cop).toFixed(2)}</Text>
        </View>
        <View style={styles.beneficios}>
          <Text style={styles.beneficio}>✔ Acceso ilimitado a viajes</Text>
          <Text style={styles.beneficio}>✔ 7 días de cobertura</Text>
          <Text style={styles.beneficio}>✔ Soporte prioritario</Text>
          <Text style={styles.beneficio}>✔ Sin comisión por viaje</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.boton} onPress={() => setPantalla('metodos')}>
        <Text style={styles.botonTexto}>
          {estado?.activo ? '🔄 Renovar Suscripción' : '⚡ Activar Ahora'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.nota}>
        * Pago en efectivo en oficinas ZAS o transferencia digital con comprobante
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#1a1a2e' },
  centrado:           { flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' },
  cargandoTexto:      { color: '#888', marginTop: 16, fontSize: 14 },
  header:             { padding: 24, paddingTop: 60 },
  logo:               { fontSize: 28, fontWeight: 'bold', color: '#FFD700' },
  titulo:             { fontSize: 22, color: '#fff', marginTop: 8, fontWeight: '600' },
  subtitulo:          { fontSize: 13, color: '#888', marginTop: 4 },
  estadoCard:         { margin: 16, borderRadius: 16, padding: 24, alignItems: 'center' },
  cardActivo:         { backgroundColor: '#0d3b2e', borderWidth: 1, borderColor: '#00c853' },
  cardInactivo:       { backgroundColor: '#3b0d0d', borderWidth: 1, borderColor: '#d32f2f' },
  estadoIcon:         { fontSize: 48, marginBottom: 8 },
  estadoTexto:        { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  diasTexto:          { color: '#FFD700', fontSize: 32, fontWeight: 'bold', marginTop: 8 },
  fechaTexto:         { color: '#aaa', fontSize: 13, marginTop: 4 },
  inactivoSubtexto:   { color: '#aaa', fontSize: 13, marginTop: 8, textAlign: 'center' },
  precioCard:         { backgroundColor: '#16213e', margin: 16, borderRadius: 16, padding: 24 },
  precioTitulo:       { color: '#aaa', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 },
  precio:             { color: '#FFD700', fontSize: 36, fontWeight: 'bold', marginTop: 8 },
  precioUsd:          { color: '#888', fontSize: 14, marginTop: 2 },
  beneficios:         { marginTop: 16 },
  beneficio:          { color: '#fff', fontSize: 15, marginBottom: 8 },
  boton:              { backgroundColor: '#FFD700', margin: 16, borderRadius: 12, padding: 18, alignItems: 'center' },
  botonTexto:         { color: '#1a1a2e', fontWeight: 'bold', fontSize: 16 },
  nota:               { color: '#555', fontSize: 12, textAlign: 'center', marginBottom: 40, paddingHorizontal: 32 },
  // métodos
  metodoCard:         { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16213e', marginHorizontal: 16, marginBottom: 10, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: '#0f3460' },
  metodoLabel:        { color: '#fff', fontSize: 16, fontWeight: '600' },
  metodoSub:          { color: '#888', fontSize: 13, marginTop: 2 },
  metodoFlecha:       { color: '#FFD700', fontSize: 24, marginLeft: 8 },
  cancelarBtn:        { alignItems: 'center', padding: 20 },
  cancelarTexto:      { color: '#888', fontSize: 14 },
  // comprobante
  montoBox:           { backgroundColor: '#16213e', borderRadius: 16, padding: 20, marginBottom: 20, alignItems: 'center', borderWidth: 1, borderColor: '#FFD700' },
  montoLabel:         { color: '#888', fontSize: 12, textTransform: 'uppercase', marginBottom: 8 },
  monto:              { color: '#FFD700', fontSize: 32, fontWeight: 'bold' },
  montoSecundario:    { color: '#aaa', fontSize: 13, fontWeight: '600' },
  metodoLabelSmall:   { color: '#aaa', fontSize: 13, marginTop: 8 },
  datosBox:           { backgroundColor: '#16213e', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#0f3460' },
  datosTitle:         { color: '#FFD700', fontSize: 14, fontWeight: 'bold', marginBottom: 12 },
  datoFila:           { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  datoKey:            { color: '#888', fontSize: 12 },
  datoVal:            { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' },
  inputLabel:         { color: '#aaa', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input:              { backgroundColor: '#16213e', borderRadius: 10, padding: 14, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#0f3460', marginBottom: 16 },
  fotoBoton:          { backgroundColor: '#16213e', borderRadius: 12, borderWidth: 1, padding: 20, alignItems: 'center', marginBottom: 20 },
  fotoBotonTexto:     { color: '#aaa', fontSize: 15 },
  fotoPreview:        { width: '100%', height: 200, borderRadius: 8 },
});
