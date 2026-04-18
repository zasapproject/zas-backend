import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView, RefreshControl } from 'react-native';

const API_URL = 'https://zasapps.com';

const METODOS = [
  { key: 'pago_movil', label: '📱 Pago Móvil' },
  { key: 'zelle', label: '💳 Zelle' },
  { key: 'transferencia', label: '🏦 Transferencia' },
  { key: 'usdt', label: '₿ USDT' },
];

export default function BilleteraConductor({ conductorId, onIrDatosBancarios }: {
  conductorId: string;
  onIrDatosBancarios: () => void;
}) {
  const [saldo, setSaldo] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [solicitando, setSolicitando] = useState(false);
  const [mostrarRetiro, setMostrarRetiro] = useState(false);
  const [montoRetiro, setMontoRetiro] = useState('');
  const [metodoRetiro, setMetodoRetiro] = useState('pago_movil');

  const cargarSaldo = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/saldo/${conductorId}`);
      const data = await res.json();
      if (data.ok) setSaldo(data.saldo);
    } catch {}
    setCargando(false);
    setRefreshing(false);
  }, [conductorId]);

  useEffect(() => { cargarSaldo(); }, [cargarSaldo]);

  const solicitarRetiro = async () => {
    const monto = parseFloat(montoRetiro);
    if (!monto || monto <= 0) { Alert.alert('Error', 'Ingresa un monto válido'); return; }
    if (monto > parseFloat(saldo?.saldo_disponible || 0)) {
      Alert.alert('Error', `Saldo insuficiente. Disponible: $${parseFloat(saldo?.saldo_disponible || 0).toLocaleString('es-CO')}`);
      return;
    }
    setSolicitando(true);
    try {
      const res = await fetch(`${API_URL}/api/saldo/retiro/solicitar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conductor_id: conductorId, monto, metodo_retiro: metodoRetiro })
      });
      const data = await res.json();
      if (data.ok) {
        Alert.alert('✅ Solicitud enviada', 'ZAS procesará tu retiro en las próximas 24-48 horas.');
        setMostrarRetiro(false);
        setMontoRetiro('');
        cargarSaldo();
      } else if (data.error?.includes('datos bancarios')) {
        Alert.alert('Sin datos bancarios', 'Debes registrar tus datos bancarios antes de solicitar un retiro.', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Registrar ahora', onPress: onIrDatosBancarios }
        ]);
      } else {
        Alert.alert('Error', data.error || 'No se pudo solicitar el retiro');
      }
    } catch { Alert.alert('Error', 'No se pudo conectar'); }
    finally { setSolicitando(false); }
  };

  if (cargando) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator color="#FFD700" size="large" />
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargarSaldo(); }} />}
    >
      <Text style={styles.titulo}>💰 Mi Billetera</Text>

      <View style={styles.saldoBox}>
        <Text style={styles.saldoLabel}>Saldo disponible</Text>
        <Text style={styles.saldoMonto}>
          ${parseFloat(saldo?.saldo_disponible || 0).toLocaleString('es-CO')}
        </Text>
        <Text style={styles.saldoMoneda}>COP</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>En proceso</Text>
          <Text style={styles.statValor}>
            ${parseFloat(saldo?.saldo_retenido || 0).toLocaleString('es-CO')}
          </Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Total ganado</Text>
          <Text style={styles.statValor}>
            ${parseFloat(saldo?.total_ganado || 0).toLocaleString('es-CO')}
          </Text>
        </View>
      </View>

      {!mostrarRetiro ? (
        <>
          <TouchableOpacity
            style={[styles.boton, parseFloat(saldo?.saldo_disponible || 0) <= 0 && { opacity: 0.5 }]}
            onPress={() => setMostrarRetiro(true)}
            disabled={parseFloat(saldo?.saldo_disponible || 0) <= 0}
          >
            <Text style={styles.botonTexto}>💸 Solicitar retiro</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.botonOutline} onPress={onIrDatosBancarios}>
            <Text style={styles.botonOutlineTexto}>🏦 Mis datos bancarios</Text>
          </TouchableOpacity>
          <Text style={styles.hint}>Desliza hacia abajo para actualizar tu saldo</Text>
        </>
      ) : (
        <View style={styles.retiroBox}>
          <Text style={styles.retiroTitulo}>Solicitar retiro</Text>

          <Text style={styles.label}>Monto a retirar (COP)</Text>
          <View style={styles.inputBox}>
            <Text style={styles.inputPrefix}>$</Text>
            <Text
              style={styles.input}
              onPress={() => Alert.prompt('Monto', 'Ingresa el monto a retirar', (text) => setMontoRetiro(text), 'plain-text', montoRetiro, 'numeric')}
            >
              {montoRetiro || 'Toca para ingresar'}
            </Text>
          </View>

          <Text style={styles.label}>Método de retiro</Text>
          <View style={styles.metodosGrid}>
            {METODOS.map(m => (
              <TouchableOpacity
                key={m.key}
                style={[styles.metodoBoton, metodoRetiro === m.key && styles.metodoBotonActivo]}
                onPress={() => setMetodoRetiro(m.key)}
              >
                <Text style={[styles.metodoTexto, metodoRetiro === m.key && styles.metodoTextoActivo]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.boton} onPress={solicitarRetiro} disabled={solicitando}>
            {solicitando ? <ActivityIndicator color="#1a1a2e" /> : <Text style={styles.botonTexto}>Confirmar retiro</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.botonCancelar} onPress={() => { setMostrarRetiro(false); setMontoRetiro(''); }}>
            <Text style={styles.botonCancelarTexto}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  loadingContainer: { flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' },
  titulo: { fontSize: 24, color: '#FFD700', fontWeight: 'bold', marginBottom: 24 },
  saldoBox: { backgroundColor: '#16213e', borderRadius: 20, padding: 28, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#FFD700' },
  saldoLabel: { color: '#888', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  saldoMonto: { color: '#FFD700', fontSize: 42, fontWeight: 'bold' },
  saldoMoneda: { color: '#888', fontSize: 14, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statBox: { flex: 1, backgroundColor: '#16213e', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#0f3460' },
  statLabel: { color: '#888', fontSize: 11, textTransform: 'uppercase', marginBottom: 6 },
  statValor: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  boton: { backgroundColor: '#FFD700', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 12 },
  botonTexto: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 16 },
  botonOutline: { backgroundColor: 'transparent', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#FFD700', marginBottom: 16 },
  botonOutlineTexto: { color: '#FFD700', fontWeight: 'bold', fontSize: 15 },
  hint: { color: '#555', fontSize: 12, textAlign: 'center' },
  retiroBox: { backgroundColor: '#16213e', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#0f3460' },
  retiroTitulo: { color: '#FFD700', fontSize: 18, fontWeight: 'bold', marginBottom: 20 },
  label: { color: '#aaa', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f3460', borderRadius: 10, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#FFD700' },
  inputPrefix: { color: '#FFD700', fontSize: 18, fontWeight: 'bold', marginRight: 8 },
  input: { color: '#fff', fontSize: 16, flex: 1 },
  metodosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  metodoBoton: { backgroundColor: '#0f3460', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#0f3460', minWidth: '45%', alignItems: 'center' },
  metodoBotonActivo: { borderColor: '#FFD700' },
  metodoTexto: { color: '#888', fontSize: 13, fontWeight: '600' },
  metodoTextoActivo: { color: '#FFD700' },
  botonCancelar: { backgroundColor: '#3a1a1a', borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 8 },
  botonCancelarTexto: { color: '#ff6b6b', fontWeight: 'bold', fontSize: 14 },
});