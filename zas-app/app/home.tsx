import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';

const API_URL = 'https://zas-backend-production-fb4e.up.railway.app';

export default function HomeScreen() {
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [cargando, setCargando] = useState(false);
  const [viaje, setViaje] = useState(null);

  const calcularPrecio = () => {
    return 4000;
  };

  const solicitarViaje = async () => {
    if (!origen || !destino) {
      Alert.alert('Error', 'Ingresa origen y destino');
      return;
    }
    setCargando(true);
    try {
      const res = await fetch(`${API_URL}/api/viajes/nuevo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_id: '1ce45e4f-a59f-4c15-815e-f699da05c219',
          origen,
          destino,
          precio: calcularPrecio(),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setViaje(data.viaje);
        Alert.alert('¡Viaje solicitado!', 'Buscando conductor cercano... 🏍️');
      } else {
        Alert.alert('Error', data.error || 'No se pudo solicitar el viaje');
      }
    } catch {
      Alert.alert('Error', 'No se pudo conectar al servidor');
    } finally {
      setCargando(false);
    }
  };

  const cancelarViaje = () => {
    setViaje(null);
    setOrigen('');
    setDestino('');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>⚡ ZAS</Text>
        <Text style={styles.saludo}>¿A dónde vamos hoy?</Text>
      </View>

      {!viaje ? (
        <View style={styles.formulario}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputIcon}>🟢</Text>
            <TextInput
              style={styles.input}
              placeholder="¿Desde dónde?"
              placeholderTextColor="#888"
              value={origen}
              onChangeText={setOrigen}
            />
          </View>

          <View style={styles.linea} />

          <View style={styles.inputContainer}>
            <Text style={styles.inputIcon}>🔴</Text>
            <TextInput
              style={styles.input}
              placeholder="¿A dónde vas?"
              placeholderTextColor="#888"
              value={destino}
              onChangeText={setDestino}
            />
          </View>

          <View style={styles.precioContainer}>
            <Text style={styles.precioLabel}>Precio estimado</Text>
            <Text style={styles.precio}>$4.000 COP</Text>
<Text style={styles.precioSecundario}>Bs 14.8 · USD 0.97</Text>
          </View>

          <TouchableOpacity
            style={styles.boton}
            onPress={solicitarViaje}
            disabled={cargando}
          >
            {cargando ? (
              <ActivityIndicator color="#1a1a2e" />
            ) : (
              <Text style={styles.botonTexto}>🏍️ Solicitar ZAS</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.viajeActivo}>
          <Text style={styles.viajeActivoTitulo}>🏍️ Buscando conductor...</Text>
          <View style={styles.viajeInfo}>
            <Text style={styles.viajeLabel}>Desde</Text>
            <Text style={styles.viajeValor}>{viaje.origen}</Text>
            <Text style={styles.viajeLabel}>Hasta</Text>
            <Text style={styles.viajeValor}>{viaje.destino}</Text>
            <Text style={styles.viajeLabel}>Precio</Text>
            <Text style={styles.viajeValor}>${viaje.precio.toLocaleString()}</Text>
            <Text style={styles.viajeLabel}>Estado</Text>
            <Text style={styles.viajeEstado}>{viaje.estado.toUpperCase()}</Text>
          </View>
          <TouchableOpacity style={styles.botonCancelar} onPress={cancelarViaje}>
            <Text style={styles.botonCancelarTexto}>Cancelar viaje</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: { padding: 24, paddingTop: 60 },
  logo: { fontSize: 28, fontWeight: 'bold', color: '#FFD700' },
  saludo: { fontSize: 22, color: '#fff', marginTop: 8, fontWeight: '600' },
  formulario: { backgroundColor: '#16213e', margin: 16, borderRadius: 16, padding: 20 },
  inputContainer: { flexDirection: 'row', alignItems: 'center' },
  inputIcon: { fontSize: 16, marginRight: 12 },
  input: { flex: 1, color: '#fff', fontSize: 16, paddingVertical: 12 },
  linea: { height: 1, backgroundColor: '#0f3460', marginLeft: 28, marginVertical: 4 },
  precioContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 16, padding: 16, backgroundColor: '#0f3460', borderRadius: 10 },
  precioLabel: { color: '#aaa', fontSize: 14 },
  precio: { color: '#FFD700', fontSize: 22, fontWeight: 'bold' },
  boton: { backgroundColor: '#FFD700', borderRadius: 10, padding: 16, alignItems: 'center' },
  botonTexto: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 16 },
  viajeActivo: { backgroundColor: '#16213e', margin: 16, borderRadius: 16, padding: 20 },
  viajeActivoTitulo: { fontSize: 20, color: '#FFD700', fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  viajeInfo: { backgroundColor: '#0f3460', borderRadius: 10, padding: 16 },
  viajeLabel: { color: '#aaa', fontSize: 12, marginTop: 12 },
  viajeValor: { color: '#fff', fontSize: 16, fontWeight: '600' },
  viajeEstado: { color: '#FFD700', fontSize: 16, fontWeight: 'bold' },
  botonCancelar: { marginTop: 20, borderWidth: 1, borderColor: '#ff4444', borderRadius: 10, padding: 14, alignItems: 'center' },
  botonCancelarTexto: { color: '#ff4444', fontWeight: 'bold' },
  precioSecundario: { color: '#aaa', fontSize: 12, marginTop: 2 },
});