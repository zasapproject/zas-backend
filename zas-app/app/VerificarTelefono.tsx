import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = 'https://zas-backend-production-fb4e.up.railway.app';

export default function VerificarTelefono() {
  const { telefono, tipo, id, nombre, email, password, fotoUrl, fotoCedula, placa, modelo, fotoLicencia, fotoRegistro, fotoRcv, fotoAntecedentes } = useLocalSearchParams<{ telefono: string; tipo: string; id: string; nombre: string; email: string; password: string; fotoUrl: string; fotoCedula: string; placa: string; modelo: string; fotoLicencia: string; fotoRegistro: string; fotoRcv: string; fotoAntecedentes: string }>();
  const router = useRouter();
  const registroEnProcesoRef = useRef(false);

  useEffect(() => { registroSimulado(); }, []);

  const registroSimulado = async () => {
    setTimeout(async () => {
      await completarRegistro();
    }, 2500);
  };

  const completarRegistro = async () => {
    if (registroEnProcesoRef.current) return;
    registroEnProcesoRef.current = true;
    try {
      let usuarioId = id;

      if (!id && tipo === 'usuario') {
        const resRegistro = await fetch(`${BACKEND_URL}/api/usuarios/registro`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre, telefono, email: email || null, password, foto_url: fotoUrl, foto_cedula: fotoCedula }),
        });
        const dataRegistro = await resRegistro.json();
        if (!dataRegistro.ok) throw new Error(dataRegistro.error || 'Error al registrar usuario');
        usuarioId = dataRegistro.usuario.id;
        await AsyncStorage.setItem('usuario_sesion', JSON.stringify({ ...dataRegistro.usuario, telefono_verificado: false }));
        await AsyncStorage.setItem('session_token', dataRegistro.usuario.session_token || '');
      }

      if (!id && tipo === 'conductor') {
        const resRegistro = await fetch(`${BACKEND_URL}/api/conductores/registro`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre, telefono, email: email || null, password, foto_url: fotoUrl, placa_moto: placa, modelo_moto: modelo, foto_cedula: fotoCedula, foto_licencia: fotoLicencia, foto_registro_moto: fotoRegistro, foto_rcv: fotoRcv, foto_antecedentes: fotoAntecedentes }),
        });
        const dataRegistro = await resRegistro.json();
        if (!dataRegistro.ok) throw new Error(dataRegistro.error || 'Error al registrar conductor');
        usuarioId = dataRegistro.conductor.id;
        // No se guarda sesion - el conductor debe iniciar sesion el mismo despues de ser aprobado
      }

      await AsyncStorage.setItem('telefono_verificado', 'false');
      const mensaje = tipo === 'conductor'
        ? `Bienvenido a ZAS ${nombre}. Tu cuenta está pendiente de aprobación. Te avisaremos pronto.`
        : `Bienvenido a ZAS ${nombre}`;
      Alert.alert('Registro exitoso', mensaje, [{
        text: 'Continuar',
        onPress: () => {
          if (tipo === 'conductor') {
            router.replace('/conductor');
          } else {
            router.replace('/home');
          }
        },
      }]);
    } catch (error: any) {
      console.log('🔴 Error en registro:', error.message);
      Alert.alert('Error', `No pudimos completar el registro: ${error.message || 'desconocido'}`);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.content}>
        <Text style={styles.emoji}>📱</Text>
        <Text style={styles.titulo}>Verificando tu número</Text>
        <Text style={styles.subtitulo}>
          Confirmando datos para{'\n'}
          <Text style={styles.telefono}>{telefono}</Text>
        </Text>
        <View style={styles.enviandoContainer}>
          <ActivityIndicator size="small" color="#FFD700" />
          <Text style={styles.enviandoTexto}>Verificando...</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emoji: { fontSize: 64, marginBottom: 24 },
  titulo: { fontSize: 26, fontWeight: 'bold', color: '#FFD700', textAlign: 'center', marginBottom: 12 },
  subtitulo: { fontSize: 15, color: '#CCC', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  telefono: { color: '#FFF', fontWeight: 'bold' },
  enviandoContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 },
  enviandoTexto: { color: '#FFD700', fontSize: 14 },
});