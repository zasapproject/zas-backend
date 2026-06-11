import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = 'https://zas-backend-production-fb4e.up.railway.app';

export default function VerificarTelefono() {
  const { telefono, tipo, id, nombre, email, password, fotoUrl, fotoCedula } = useLocalSearchParams<{ telefono: string; tipo: string; id: string; nombre: string; email: string; password: string; fotoUrl: string; fotoCedula: string }>();
  const router = useRouter();
  const [codigo, setCodigo] = useState('');
  const [confirm, setConfirm] = useState<any>(null);
  const [enviando, setEnviando] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => { enviarSMS(); }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const formatearTelefono = (tel: string): string => {
    const limpio = tel.replace(/\D/g, '');
    if (limpio.startsWith('58')) return `+${limpio}`;
    if (limpio.startsWith('0')) return `+58${limpio.slice(1)}`;
    return `+58${limpio}`;
  };

  const enviarSMS = async () => {
    setEnviando(true);
    try {
      const confirmation = await auth().signInWithPhoneNumber(formatearTelefono(telefono));
      setConfirm(confirmation);
      setCooldown(60);
    } catch (error: any) {
      Alert.alert('Error', 'No pudimos enviar el código. Verifica el número e intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  const confirmarCodigo = async () => {
    if (codigo.length !== 6) { Alert.alert('Código incompleto', 'El código tiene 6 dígitos.'); return; }
    if (!confirm) { Alert.alert('Error', 'Primero debes recibir el SMS.'); return; }
    setVerificando(true);
    try {
      const userCredential = await confirm.confirm(codigo);
      const idToken = await userCredential.user.getIdToken();

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
        await AsyncStorage.setItem('usuario_sesion', JSON.stringify({ ...dataRegistro.usuario, telefono_verificado: true }));
        await AsyncStorage.setItem('session_token', dataRegistro.usuario.session_token || '');
      }

      const response = await fetch(`${BACKEND_URL}/api/verificacion/confirmar-firebase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firebase_id_token: idToken, tipo, id: usuarioId }),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || 'Error al confirmar');
      await AsyncStorage.setItem('telefono_verificado', 'true');
      const mensaje = tipo === 'conductor'
        ? `Bienvenido a ZAS ${nombre}. Tu cuenta está pendiente de aprobación. Te avisaremos pronto.`
        : `Bienvenido a ZAS ${nombre}`;
      Alert.alert('Registro exitoso', mensaje, [{
        text: 'Continuar',
        onPress: () => router.replace(tipo === 'conductor' ? '/conductor' : '/home'),
      }]);
    } catch (error: any) {
      Alert.alert('Error', (error.code || 'sin codigo') + ': ' + (error.message || 'sin mensaje'));
    } finally {
      setVerificando(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.content}>
        <Text style={styles.emoji}>📱</Text>
        <Text style={styles.titulo}>Verifica tu número</Text>
        <Text style={styles.subtitulo}>
          Enviamos un código de 6 dígitos al número{'\n'}
          <Text style={styles.telefono}>{telefono}</Text>
        </Text>
        {enviando && (
          <View style={styles.enviandoContainer}>
            <ActivityIndicator size="small" color="#FFD700" />
            <Text style={styles.enviandoTexto}>Enviando SMS...</Text>
          </View>
        )}
        {!enviando && confirm && (
          <>
            <TextInput
              style={styles.inputCodigo}
              value={codigo}
              onChangeText={(t) => setCodigo(t.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              placeholderTextColor="#888"
              keyboardType="numeric"
              maxLength={6}
              textAlign="center"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.boton, (verificando || codigo.length < 6) && styles.botonDisabled]}
              onPress={confirmarCodigo}
              disabled={verificando || codigo.length < 6}
            >
              {verificando
                ? <ActivityIndicator size="small" color="#000" />
                : <Text style={styles.botonTexto}>Verificar número</Text>
              }
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity
          style={[styles.botonReenviar, (cooldown > 0 || enviando) && styles.botonDisabled]}
          onPress={enviarSMS}
          disabled={cooldown > 0 || enviando}
        >
          <Text style={styles.botonReenviarTexto}>
            {cooldown > 0 ? `Reenviar código en ${cooldown}s` : 'Reenviar código'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.ayuda}>¿No recibiste el SMS? Revisa que el número sea correcto.</Text>
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
  inputCodigo: { width: '100%', height: 64, borderWidth: 2, borderColor: '#0f3460', borderRadius: 12, fontSize: 32, fontWeight: 'bold', color: '#FFF', backgroundColor: '#16213e', letterSpacing: 12, marginBottom: 20 },
  boton: { width: '100%', height: 52, backgroundColor: '#FFD700', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  botonTexto: { fontSize: 17, fontWeight: 'bold', color: '#000' },
  botonReenviar: { paddingVertical: 12, paddingHorizontal: 24 },
  botonReenviarTexto: { fontSize: 14, color: '#FFD700', textDecorationLine: 'underline' },
  botonDisabled: { opacity: 0.4 },
  ayuda: { fontSize: 12, color: '#666', textAlign: 'center', marginTop: 24, lineHeight: 18 },
});
