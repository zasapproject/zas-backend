import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

export default function TerminosScreen() {
  const [aceptando, setAceptando] = useState(false);

  const aceptarTerminos = async () => {
    setAceptando(true);
    await AsyncStorage.setItem('terminos_aceptados', 'true');
    router.replace('/home');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>⚡ ZAS</Text>
        <Text style={styles.titulo}>Términos y Condiciones</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 24 }}>
        <Text style={styles.seccionTitulo}>1. Aceptación de los términos</Text>
        <Text style={styles.texto}>Al usar la aplicación ZAS Mototaxi, aceptas estos términos y condiciones en su totalidad. Si no estás de acuerdo con alguna parte, no debes usar la aplicación.</Text>

        <Text style={styles.seccionTitulo}>2. Descripción del servicio</Text>
        <Text style={styles.texto}>ZAS Mototaxi es una plataforma que conecta usuarios con conductores de mototaxi independientes. ZAS actúa como intermediario y no es responsable de los servicios prestados por los conductores.</Text>

        <Text style={styles.seccionTitulo}>3. Registro y cuenta</Text>
        <Text style={styles.texto}>Para usar ZAS debes registrarte con información verídica. Eres responsable de mantener la confidencialidad de tu contraseña y de todas las actividades que ocurran bajo tu cuenta.</Text>

        <Text style={styles.seccionTitulo}>4. Uso del servicio</Text>
        <Text style={styles.texto}>Te comprometes a usar ZAS únicamente para fines lícitos. Queda prohibido usar la plataforma para actividades ilegales, fraudulentas o que perjudiquen a otros usuarios o conductores.</Text>

        <Text style={styles.seccionTitulo}>5. Pagos</Text>
        <Text style={styles.texto}>Los precios son calculados automáticamente según la tarifa del municipio. Los pagos digitales requieren confirmación por parte de ZAS. El efectivo se paga directamente al conductor.</Text>

        <Text style={styles.seccionTitulo}>6. Cancelaciones</Text>
        <Text style={styles.texto}>Puedes cancelar un viaje antes de que el conductor llegue a tu ubicación. Cancelaciones frecuentes pueden resultar en restricciones de la cuenta.</Text>

        <Text style={styles.seccionTitulo}>7. Responsabilidad</Text>
        <Text style={styles.texto}>ZAS no se hace responsable por daños, pérdidas o lesiones ocurridas durante el servicio de transporte. Los conductores son trabajadores independientes y no empleados de ZAS.</Text>

        <Text style={styles.seccionTitulo}>8. Privacidad</Text>
        <Text style={styles.texto}>Tu información personal es tratada según nuestra Política de Privacidad disponible en zasapps.com/privacidad. Recopilamos datos de ubicación únicamente durante el uso activo de la app.</Text>

        <Text style={styles.seccionTitulo}>9. Modificaciones</Text>
        <Text style={styles.texto}>ZAS se reserva el derecho de modificar estos términos en cualquier momento. Los cambios serán notificados a través de la aplicación.</Text>

        <Text style={styles.seccionTitulo}>10. Contacto</Text>
        <Text style={styles.texto}>Para cualquier consulta sobre estos términos puedes contactarnos en soporte@zasapps.com</Text>

        <Text style={styles.fecha}>Última actualización: Abril 2026 · Venezuela</Text>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.boton} onPress={aceptarTerminos} disabled={aceptando}>
          {aceptando ? <ActivityIndicator color="#1a1a2e" /> : <Text style={styles.botonTexto}>✅ Acepto los términos y condiciones</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: { padding: 24, paddingTop: 50, borderBottomWidth: 1, borderBottomColor: '#0f3460' },
  logo: { fontSize: 24, fontWeight: 'bold', color: '#FFD700', marginBottom: 4 },
  titulo: { fontSize: 20, color: '#fff', fontWeight: '700' },
  scroll: { flex: 1 },
  seccionTitulo: { color: '#FFD700', fontSize: 15, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  texto: { color: '#aaa', fontSize: 14, lineHeight: 22 },
  fecha: { color: '#555', fontSize: 12, textAlign: 'center', marginTop: 32, marginBottom: 16 },
  footer: { padding: 20, paddingBottom: 36, borderTopWidth: 1, borderTopColor: '#0f3460' },
  boton: { backgroundColor: '#FFD700', borderRadius: 14, padding: 18, alignItems: 'center' },
  botonTexto: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 15 },
});