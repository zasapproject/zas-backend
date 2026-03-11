import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';

const API_URL = 'https://zas-backend-production-fb4e.up.railway.app';
const CONDUCTOR_ID = '9fe102bb-5720-48d4-8290-95ab66c1449b';

export default function SuscripcionScreen() {
  const [estado, setEstado] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);

  const cargarEstado = async () => {
    setCargando(true);
    try {
      const res = await fetch(`${API_URL}/api/suscripciones/estado/${CONDUCTOR_ID}`);
      const data = await res.json();
      setEstado(data);
    } catch {
      Alert.alert('Error', 'No se pudo verificar la suscripción');
    } finally {
      setCargando(false);
    }
  };

  const activarSuscripcion = async () => {
    setProcesando(true);
    try {
      const res = await fetch(`${API_URL}/api/suscripciones/activar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conductor_id: CONDUCTOR_ID,
          metodo_pago: 'efectivo',
          monto: 20000,
        }),
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('✅ ¡Suscripción activada!', data.mensaje);
        cargarEstado();
      } else {
        Alert.alert('Error', 'No se pudo activar la suscripción');
      }
    } catch {
      Alert.alert('Error', 'No se pudo conectar al servidor');
    } finally {
      setProcesando(false);
    }
  };

  const confirmarActivacion = () => {
    Alert.alert(
      '⚡ Activar Suscripción',
      'El costo es $20.000 COP por 7 días. ¿Confirmas el pago?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: activarSuscripcion },
      ]
    );
  };

  useEffect(() => {
    cargarEstado();
  }, []);

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator color="#FFD700" size="large" />
        <Text style={styles.cargandoTexto}>Verificando suscripción...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>⚡ ZAS</Text>
        <Text style={styles.titulo}>Suscripción Conductor</Text>
        <Text style={styles.subtitulo}>Accede a todos los viajes disponibles</Text>
      </View>

      <View style={[styles.estadoCard, estado?.activo ? styles.cardActivo : styles.cardInactivo]}>
        <Text style={styles.estadoIcon}>{estado?.activo ? '✅' : '⛔'}</Text>
        <Text style={styles.estadoTexto}>
          {estado?.activo ? 'Suscripción Activa' : 'Sin Suscripción'}
        </Text>
        {estado?.activo && (
          <>
            <Text style={styles.diasTexto}>{estado.dias_restantes} días restantes</Text>
            <Text style={styles.fechaTexto}>
              Vence: {new Date(estado.suscripcion_hasta).toLocaleDateString('es-CO')}
            </Text>
          </>
        )}
        {!estado?.activo && (
          <Text style={styles.inactivoSubtexto}>
            Activa tu suscripción para recibir viajes
          </Text>
        )}
      </View>

      <View style={styles.precioCard}>
        <Text style={styles.precioTitulo}>Plan Semanal</Text>
        <Text style={styles.precio}>$20.000 COP</Text>
        <Text style={styles.precioUsd}>≈ $5 USD</Text>
        <View style={styles.beneficios}>
          <Text style={styles.beneficio}>✔ Acceso ilimitado a viajes</Text>
          <Text style={styles.beneficio}>✔ 7 días de cobertura</Text>
          <Text style={styles.beneficio}>✔ Soporte prioritario</Text>
          <Text style={styles.beneficio}>✔ Sin comisión por viaje</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.boton, procesando && styles.botonDeshabilitado]}
        onPress={confirmarActivacion}
        disabled={procesando}
      >
        {procesando ? (
          <ActivityIndicator color="#1a1a2e" />
        ) : (
          <Text style={styles.botonTexto}>
            {estado?.activo ? '🔄 Renovar Suscripción' : '⚡ Activar Ahora'}
          </Text>
        )}
      </TouchableOpacity>

      <Text style={styles.nota}>
        * El pago se realiza en efectivo al administrador de ZAS
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  centrado: { flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' },
  cargandoTexto: { color: '#888', marginTop: 16, fontSize: 14 },
  header: { padding: 24, paddingTop: 60 },
  logo: { fontSize: 28, fontWeight: 'bold', color: '#FFD700' },
  titulo: { fontSize: 22, color: '#fff', marginTop: 8, fontWeight: '600' },
  subtitulo: { fontSize: 13, color: '#888', marginTop: 4 },
  estadoCard: { margin: 16, borderRadius: 16, padding: 24, alignItems: 'center' },
  cardActivo: { backgroundColor: '#0d3b2e', borderWidth: 1, borderColor: '#00c853' },
  cardInactivo: { backgroundColor: '#3b0d0d', borderWidth: 1, borderColor: '#d32f2f' },
  estadoIcon: { fontSize: 48, marginBottom: 8 },
  estadoTexto: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  diasTexto: { color: '#FFD700', fontSize: 32, fontWeight: 'bold', marginTop: 8 },
  fechaTexto: { color: '#aaa', fontSize: 13, marginTop: 4 },
  inactivoSubtexto: { color: '#aaa', fontSize: 13, marginTop: 8, textAlign: 'center' },
  precioCard: { backgroundColor: '#16213e', margin: 16, borderRadius: 16, padding: 24 },
  precioTitulo: { color: '#aaa', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 },
  precio: { color: '#FFD700', fontSize: 36, fontWeight: 'bold', marginTop: 8 },
  precioUsd: { color: '#888', fontSize: 14, marginTop: 2 },
  beneficios: { marginTop: 16 },
  beneficio: { color: '#fff', fontSize: 15, marginBottom: 8 },
  boton: { backgroundColor: '#FFD700', margin: 16, borderRadius: 12, padding: 18, alignItems: 'center' },
  botonDeshabilitado: { opacity: 0.6 },
  botonTexto: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 16 },
  nota: { color: '#555', fontSize: 12, textAlign: 'center', marginBottom: 40, paddingHorizontal: 32 },
});