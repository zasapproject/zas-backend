import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, Image, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const API_URL = 'https://zasapps.com';

export default function SubirComprobante({ pagoId, metodo, monto, datosZas, onComprobanteEnviado, tasas }: {
  pagoId: string;
  metodo: string;
  monto: number;
  datosZas: any;
  onComprobanteEnviado: () => void;
  tasas?: { usd_cop: number; usd_bs: number };
}) {
  const tasasDefault = tasas || { usd_cop: 4000, usd_bs: 487.12 };
  const [referencia, setReferencia] = useState('');
  const [fotoComprobante, setFotoComprobante] = useState('');
  const [enviando, setEnviando] = useState(false);

  const seleccionarFoto = async () => {
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
      { text: 'Cancelar', style: 'cancel' }
    ]);
  };

  const subirComprobante = async () => {
    if (!fotoComprobante) { Alert.alert('Error', 'Debes tomar o seleccionar la foto del comprobante'); return; }
    setEnviando(true);
    try {
      // Primero subir foto a storage
      const resStorage = await fetch(`${API_URL}/api/storage/subir-foto`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64: fotoComprobante, nombre: `comprobante_${pagoId}`, carpeta: 'comprobantes' })
      });
      const dataStorage = await resStorage.json();
      if (!dataStorage.ok) { Alert.alert('Error', 'No se pudo subir la foto'); setEnviando(false); return; }

      // Luego enviar al backend
      const res = await fetch(`${API_URL}/api/pagos/subir-comprobante/${pagoId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comprobante_url: dataStorage.url, referencia: referencia || null })
      });
      const data = await res.json();
      if (data.ok) {
        Alert.alert('✅ Comprobante enviado', 'ZAS lo revisará en breve y confirmará tu pago.', [
          { text: 'OK', onPress: onComprobanteEnviado }
        ]);
      } else {
        Alert.alert('Error', data.error || 'No se pudo enviar el comprobante');
      }
    } catch { Alert.alert('Error', 'No se pudo subir el comprobante. Verifica tu conexión e intenta de nuevo.'); }
    finally { setEnviando(false); }
  };

  const renderDatosZas = () => {
    if (!datosZas) return null;
    return Object.entries(datosZas).map(([key, value]: any) => (
      <View key={key} style={styles.datoFila}>
        <Text style={styles.datoLabel}>{key.replace(/_/g, ' ').toUpperCase()}</Text>
        <Text style={styles.datoValor}>{value}</Text>
      </View>
    ));
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 24 }}>
      <Text style={styles.titulo}>Confirmar pago</Text>
      <Text style={styles.subtitulo}>Transfiere y sube el comprobante</Text>

      <View style={styles.montoBox}>
        <Text style={styles.montoLabel}>Monto a pagar</Text>
        <Text style={styles.monto}>
          {Number(monto).toLocaleString('es-CO', { maximumFractionDigits: 0 })} COP
        </Text>
        <View style={{ flexDirection: 'row', gap: 20, marginTop: 6 }}>
          <Text style={styles.montoSecundario}>
            Bs {(Number(monto) / tasasDefault.usd_cop * tasasDefault.usd_bs).toLocaleString('es-VE', { maximumFractionDigits: 2 })}
          </Text>
          <Text style={styles.montoSecundario}>
            $ {(Number(monto) / tasasDefault.usd_cop).toFixed(2)}
          </Text>
        </View>
        <Text style={styles.metodoLabel}>Método: {metodo.replace(/_/g, ' ').toUpperCase()}</Text>
      </View>

      {datosZas && (
        <View style={styles.datosBox}>
          <Text style={styles.datosTitle}>Datos de ZAS para transferir</Text>
          {renderDatosZas()}
        </View>
      )}

      <Text style={styles.label}>Número de referencia (opcional)</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej: 123456789"
        placeholderTextColor="#888"
        value={referencia}
        onChangeText={setReferencia}
        keyboardType="numeric"
      />

      <Text style={styles.label}>Foto del comprobante</Text>
      <TouchableOpacity style={[styles.fotoBoton, fotoComprobante ? { borderColor: '#00c853' } : { borderColor: '#FFD700' }]} onPress={seleccionarFoto}>
        {fotoComprobante
          ? <Image source={{ uri: fotoComprobante }} style={styles.fotoPreview} />
          : <Text style={styles.fotoBotonTexto}>📷 Tomar o seleccionar foto</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={[styles.boton, !fotoComprobante && { opacity: 0.5 }]} onPress={subirComprobante} disabled={enviando || !fotoComprobante}>
        {enviando ? <ActivityIndicator color="#1a1a2e" /> : <Text style={styles.botonTexto}>Enviar comprobante</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  titulo: { fontSize: 24, color: '#FFD700', fontWeight: 'bold', marginBottom: 4 },
  subtitulo: { color: '#888', fontSize: 14, marginBottom: 24 },
  montoBox: { backgroundColor: '#16213e', borderRadius: 16, padding: 20, marginBottom: 20, alignItems: 'center', borderWidth: 1, borderColor: '#FFD700' },
  montoLabel: { color: '#888', fontSize: 12, textTransform: 'uppercase', marginBottom: 8 },
  monto: { color: '#FFD700', fontSize: 32, fontWeight: 'bold' },
  metodoLabel: { color: '#aaa', fontSize: 13, marginTop: 8 },
  montoSecundario: { color: '#aaa', fontSize: 13, fontWeight: '600' },
  datosBox: { backgroundColor: '#16213e', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#0f3460' },
  datosTitle: { color: '#FFD700', fontSize: 14, fontWeight: 'bold', marginBottom: 12 },
  datoFila: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  datoLabel: { color: '#888', fontSize: 12 },
  datoValor: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' },
  label: { color: '#aaa', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input: { backgroundColor: '#16213e', borderRadius: 10, padding: 14, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#0f3460', marginBottom: 16 },
  fotoBoton: { backgroundColor: '#16213e', borderRadius: 12, borderWidth: 1, padding: 20, alignItems: 'center', marginBottom: 20 },
  fotoBotonTexto: { color: '#aaa', fontSize: 15 },
  fotoPreview: { width: '100%', height: 200, borderRadius: 8 },
  boton: { backgroundColor: '#FFD700', borderRadius: 14, padding: 18, alignItems: 'center' },
  botonTexto: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 16 },
});