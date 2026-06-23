import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import SubirComprobante from './SubirComprobante';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ReintentoPagoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const pagoId = params.pagoId as string;
  const metodo = params.metodo as string;
  const monto = parseFloat(params.monto as string) || 0;
  const intento = parseInt(params.intento as string) || 1;
  const intentosRestantes = parseInt(params.intentosRestantes as string) || 0;
  const datosZas = params.datosZas ? JSON.parse(params.datosZas as string) : null;

  const handleComprobanteEnviado = async () => {
    router.replace('/historial');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#1a1a2e' }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTexto}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.titulo}>Reintento de pago</Text>
        <View style={styles.intentoBadge}>
          <Text style={styles.intentoTexto}>Intento {intento} de 3</Text>
        </View>
      </View>

      {intentosRestantes <= 0 ? (
        <View style={styles.agotado}>
          <Text style={styles.agotadoIcon}>⚠️</Text>
          <Text style={styles.agotadoTitulo}>Intentos agotados</Text>
          <Text style={styles.agotadoTexto}>
            Has usado los 3 intentos permitidos.{'\n'}
            Contacta a soporte ZAS por WhatsApp.
          </Text>
          <TouchableOpacity style={styles.botonVolver} onPress={() => router.replace('/historial')}>
            <Text style={styles.botonVolverTexto}>Volver al historial</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <SubirComprobante
          pagoId={pagoId}
          metodo={metodo}
          monto={monto}
          datosZas={datosZas}
          onComprobanteEnviado={handleComprobanteEnviado}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#12121a',
    padding: 20,
    paddingTop: 48,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3f',
    gap: 6,
  },
  backBtn: { marginBottom: 4 },
  backTexto: { color: '#666680', fontSize: 13 },
  titulo: { color: '#2ED9C3', fontSize: 20, fontWeight: '800' },
  intentoBadge: {
    backgroundColor: 'rgba(255,145,0,0.1)',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255,145,0,0.3)',
  },
  intentoTexto: { color: '#ff9100', fontSize: 12, fontWeight: '700' },
  agotado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  agotadoIcon: { fontSize: 48 },
  agotadoTitulo: { color: '#ff1744', fontSize: 20, fontWeight: '800' },
  agotadoTexto: { color: '#666680', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  botonVolver: {
    backgroundColor: '#2ED9C3',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
    width: '100%',
  },
  botonVolverTexto: { color: '#08111f', fontWeight: '800', fontSize: 15 },
});
