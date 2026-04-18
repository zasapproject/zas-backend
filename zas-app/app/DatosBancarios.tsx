import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';

const API_URL = 'https://zasapps.com';

export default function DatosBancarios({ conductorId, onGuardado }: {
  conductorId: string;
  onGuardado: () => void;
}) {
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [banco, setBanco] = useState('');
  const [numeroCuenta, setNumeroCuenta] = useState('');
  const [telefonoPagoMovil, setTelefonoPagoMovil] = useState('');
  const [cedula, setCedula] = useState('');
  const [zelleEmail, setZelleEmail] = useState('');
  const [zelleTelefono, setZelleTelefono] = useState('');
  const [walletUsdt, setWalletUsdt] = useState('');
  const [redUsdt, setRedUsdt] = useState('TRC20');

  useEffect(() => { cargarDatos(); }, []);

  const cargarDatos = async () => {
    try {
      const res = await fetch(`${API_URL}/api/datos-bancarios/${conductorId}`);
      const data = await res.json();
      if (data.ok && data.datos) {
        const d = data.datos;
        setBanco(d.banco || '');
        setNumeroCuenta(d.numero_cuenta || '');
        setTelefonoPagoMovil(d.telefono_pago_movil || '');
        setCedula(d.cedula || '');
        setZelleEmail(d.zelle_email || '');
        setZelleTelefono(d.zelle_telefono || '');
        setWalletUsdt(d.wallet_usdt || '');
        setRedUsdt(d.red_usdt || 'TRC20');
      }
    } catch {}
    setCargando(false);
  };

  const guardar = async () => {
    const tienePagoMovil = telefonoPagoMovil || numeroCuenta;
    const tieneZelle = zelleEmail || zelleTelefono;
    const tieneUsdt = walletUsdt;

    if (!tienePagoMovil && !tieneZelle && !tieneUsdt) {
      Alert.alert('Error', 'Debes registrar al menos un método: Pago Móvil, Zelle o USDT');
      return;
    }

    setGuardando(true);
    try {
      const res = await fetch(`${API_URL}/api/datos-bancarios/guardar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conductor_id: conductorId,
          banco: banco || null,
          numero_cuenta: numeroCuenta || null,
          telefono_pago_movil: telefonoPagoMovil || null,
          cedula: cedula || null,
          zelle_email: zelleEmail || null,
          zelle_telefono: zelleTelefono || null,
          wallet_usdt: walletUsdt || null,
          red_usdt: redUsdt,
        })
      });
      const data = await res.json();
      if (data.ok) {
        Alert.alert('✅ Datos guardados', 'Tus datos bancarios fueron guardados correctamente.', [
          { text: 'OK', onPress: onGuardado }
        ]);
      } else {
        Alert.alert('Error', data.error || 'No se pudo guardar');
      }
    } catch { Alert.alert('Error', 'No se pudo conectar'); }
    finally { setGuardando(false); }
  };

  if (cargando) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator color="#FFD700" size="large" />
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 24 }}>
        <Text style={styles.titulo}>🏦 Datos Bancarios</Text>
        <Text style={styles.subtitulo}>Registra al menos un método para recibir pagos</Text>

        {/* PAGO MÓVIL */}
        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>📱 Pago Móvil / Transferencia</Text>
          <Text style={styles.label}>Banco</Text>
          <TextInput style={styles.input} placeholder="Ej: Banco de Venezuela" placeholderTextColor="#888" value={banco} onChangeText={setBanco} />
          <Text style={styles.label}>Número de cuenta</Text>
          <TextInput style={styles.input} placeholder="XXXX-XXXX-XXXX-XXXX" placeholderTextColor="#888" value={numeroCuenta} onChangeText={setNumeroCuenta} keyboardType="numeric" />
          <Text style={styles.label}>Teléfono Pago Móvil</Text>
          <TextInput style={styles.input} placeholder="04121234567" placeholderTextColor="#888" value={telefonoPagoMovil} onChangeText={setTelefonoPagoMovil} keyboardType="phone-pad" maxLength={11} />
          <Text style={styles.label}>Cédula</Text>
          <TextInput style={styles.input} placeholder="V-12345678" placeholderTextColor="#888" value={cedula} onChangeText={setCedula} />
        </View>

        {/* ZELLE */}
        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>💳 Zelle</Text>
          <Text style={styles.label}>Email Zelle</Text>
          <TextInput style={styles.input} placeholder="tu@email.com" placeholderTextColor="#888" value={zelleEmail} onChangeText={setZelleEmail} keyboardType="email-address" autoCapitalize="none" />
          <Text style={styles.label}>Teléfono Zelle</Text>
          <TextInput style={styles.input} placeholder="+1 234 567 8900" placeholderTextColor="#888" value={zelleTelefono} onChangeText={setZelleTelefono} keyboardType="phone-pad" />
        </View>

        {/* USDT */}
        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>₿ USDT</Text>
          <Text style={styles.label}>Wallet USDT</Text>
          <TextInput style={styles.input} placeholder="TXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" placeholderTextColor="#888" value={walletUsdt} onChangeText={setWalletUsdt} autoCapitalize="none" />
          <Text style={styles.label}>Red</Text>
          <View style={styles.redesRow}>
            {['TRC20', 'ERC20', 'BEP20'].map(red => (
              <TouchableOpacity
                key={red}
                style={[styles.redBoton, redUsdt === red && styles.redBotonActivo]}
                onPress={() => setRedUsdt(red)}
              >
                <Text style={[styles.redTexto, redUsdt === red && styles.redTextoActivo]}>{red}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.boton} onPress={guardar} disabled={guardando}>
          {guardando ? <ActivityIndicator color="#1a1a2e" /> : <Text style={styles.botonTexto}>💾 Guardar datos</Text>}
        </TouchableOpacity>

        <Text style={styles.hint}>Al menos un método es obligatorio para solicitar retiros</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  loadingContainer: { flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' },
  titulo: { fontSize: 24, color: '#FFD700', fontWeight: 'bold', marginBottom: 4 },
  subtitulo: { color: '#888', fontSize: 13, marginBottom: 24 },
  seccion: { backgroundColor: '#16213e', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#0f3460' },
  seccionTitulo: { color: '#FFD700', fontSize: 15, fontWeight: 'bold', marginBottom: 16 },
  label: { color: '#aaa', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { backgroundColor: '#0f3460', borderRadius: 10, padding: 14, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#0f3460', marginBottom: 14 },
  redesRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  redBoton: { flex: 1, backgroundColor: '#0f3460', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#0f3460' },
  redBotonActivo: { borderColor: '#FFD700' },
  redTexto: { color: '#888', fontSize: 13, fontWeight: '600' },
  redTextoActivo: { color: '#FFD700' },
  boton: { backgroundColor: '#FFD700', borderRadius: 14, padding: 18, alignItems: 'center', marginTop: 8, marginBottom: 16 },
  botonTexto: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 16 },
  hint: { color: '#555', fontSize: 12, textAlign: 'center', marginBottom: 40 },
});