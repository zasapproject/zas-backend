// screens/VerificarTelefono.tsx
// ═══════════════════════════════════════════════════════
// ZAS MOTOTAXI — Pantalla de Verificación de Teléfono
// RESPONSABLE: Sofia
//
// DEPENDENCIAS — instalar antes:
//   npx expo install expo-firebase-recaptcha
//   npm install firebase
//
// FLUJO:
//   1. Se muestra después del registro (usuario o conductor)
//   2. Firebase envía SMS automáticamente al número registrado
//   3. Usuario ingresa el código de 6 dígitos
//   4. App llama al backend para marcar como verificado
//   5. Redirige al home
// ═══════════════════════════════════════════════════════

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { PhoneAuthProvider, signInWithCredential, getAuth } from 'firebase/auth';
import { initializeApp, getApps } from 'firebase/app';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─────────────────────────────────────────────
// Configuración Firebase — mismos datos del proyecto
// ─────────────────────────────────────────────
const firebaseConfig = {
  apiKey: 'AIzaSyBypfJWtZn_XRZBIl_bc18nncTMor2988Q', // Key Android existente
  authDomain: 'zas-app-9876e.firebaseapp.com',
  projectId: 'zas-app-9876e',
  storageBucket: 'zas-app-9876e.appspot.com',
  messagingSenderId: '834771425940',
  appId: '1:834771425940:android:1e13Oe51e43c9cd607b281',
};

// Inicializar Firebase solo si no está inicializado
const firebaseApp = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0];

const auth = getAuth(firebaseApp);

// ─────────────────────────────────────────────
// URL del backend
// ─────────────────────────────────────────────
const BACKEND_URL = 'https://zas-backend-production-fb4e.up.railway.app';

// ─────────────────────────────────────────════
// Props que recibe esta pantalla
// telefono: el número registrado (ej: +584147224623)
// tipo: 'usuario' | 'conductor'
// id: el UUID del usuario/conductor en Supabase
// ─────────────────────────────────────────────
interface Props {
  telefono: string;
  tipo: 'usuario' | 'conductor';
  id: string;
}

export default function VerificarTelefono() {
  const { telefono, tipo, id, nombre } = useLocalSearchParams<{ telefono: string; tipo: string; id: string; nombre: string }>();
  const router = useRouter();
  const recaptchaVerifier = useRef(null);

  const [codigo, setCodigo] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [smsSent, setSmsSent] = useState(false);

  // ─────────────────────────────────────────────
  // Enviar SMS al montar la pantalla automáticamente
  // ─────────────────────────────────────────────
  useEffect(() => {
    enviarSMS();
  }, []);

  // ─────────────────────────────────────────────
  // Countdown para el botón Reenviar
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // ─────────────────────────────────────────────
  // Enviar SMS con Firebase Phone Auth
  // ─────────────────────────────────────────────
  const enviarSMS = async () => {
    if (!recaptchaVerifier.current) return;

    setEnviando(true);
    try {
      const provider = new PhoneAuthProvider(auth);
      // telefono debe estar en formato E.164: +584147224623
      const telefonoE164 = formatearTelefonoE164(telefono);
      const vid = await provider.verifyPhoneNumber(telefonoE164, recaptchaVerifier.current);
      setVerificationId(vid);
      setSmsSent(true);
      setCooldown(60); // 60 segundos antes de poder reenviar
    } catch (error: any) {
      Alert.alert(
        'Error al enviar SMS',
        'No pudimos enviar el código. Verifica que el número sea correcto o intenta de nuevo.',
        [{ text: 'OK' }]
      );
      console.error('Error enviando SMS:', error.message);
    } finally {
      setEnviando(false);
    }
  };

  // ─────────────────────────────────────────────
  // Formatear teléfono venezolano a E.164
  // Entrada: 04147224623 → Salida: +584147224623
  // ─────────────────────────────────────────────
  const formatearTelefonoE164 = (tel: string): string => {
    const limpio = tel.replace(/\D/g, '');
    if (limpio.startsWith('58')) return `+${limpio}`;
    if (limpio.startsWith('0')) return `+58${limpio.slice(1)}`;
    return `+58${limpio}`;
  };

  // ─────────────────────────────────────────────
  // Confirmar código ingresado por el usuario
  // ─────────────────────────────────────────────
  const confirmarCodigo = async () => {
    if (codigo.length !== 6) {
      Alert.alert('Código incompleto', 'El código tiene 6 dígitos.');
      return;
    }
    if (!verificationId) {
      Alert.alert('Error', 'Primero debes recibir el SMS.');
      return;
    }

    setVerificando(true);
    try {
      // Crear credencial con el código ingresado
      const credential = PhoneAuthProvider.credential(verificationId, codigo);

      // Iniciar sesión en Firebase con la credencial
      const userCredential = await signInWithCredential(auth, credential);

      // Obtener el ID Token para enviarlo al backend
      const idToken = await userCredential.user.getIdToken();

      // Llamar al backend ZAS para marcar verificado en Supabase
      const response = await fetch(`${BACKEND_URL}/api/verificacion/confirmar-firebase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebase_id_token: idToken,
          tipo,
          id,
        }),
      });

      const data = await response.json();

      if (!data.ok) {
        throw new Error(data.error || 'Error al confirmar verificación');
      }

      // Guardar localmente que el teléfono está verificado
      await AsyncStorage.setItem('telefono_verificado', 'true');

      Alert.alert(
        'Registro exitoso',
        'Bienvenido a ZAS ' + nombre,
        [
          {
            text: 'Continuar',
            onPress: () => {
              // Redirigir al home según el tipo de usuario
              if (tipo === 'conductor') {
                router.replace('/conductor/home');
              } else {
                router.replace('/home');
              }
            },
          },
        ]
      );
    } catch (error: any) {
      let mensaje = 'Código incorrecto o expirado. Intenta de nuevo.';
      if (error.code === 'auth/invalid-verification-code') {
        mensaje = 'El código ingresado es incorrecto.';
      } else if (error.code === 'auth/code-expired') {
        mensaje = 'El código expiró. Solicita uno nuevo.';
      }
      Alert.alert('Error de verificación', mensaje);
      console.error('Error confirmando código:', error.message);
    } finally {
      setVerificando(false);
    }
  };

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* ReCaptcha invisible — requerido por Firebase */}
      <FirebaseRecaptchaVerifierModal
        ref={recaptchaVerifier}
        firebaseConfig={firebaseConfig}
        attemptInvisibleVerification={true}
      />

      <View style={styles.content}>
        {/* Ícono */}
        <Text style={styles.emoji}>📱</Text>

        {/* Título */}
        <Text style={styles.titulo}>Verifica tu número</Text>

        {/* Subtítulo con número */}
        <Text style={styles.subtitulo}>
          Enviamos un código de 6 dígitos al número{'\n'}
          <Text style={styles.telefono}>{telefono}</Text>
        </Text>

        {/* Estado del envío */}
        {enviando && (
          <View style={styles.enviandoContainer}>
            <ActivityIndicator size="small" color="#FFD700" />
            <Text style={styles.enviandoTexto}>Enviando SMS...</Text>
          </View>
        )}

        {/* Campo de código */}
        {smsSent && (
          <>
            <TextInput
              style={styles.inputCodigo}
              value={codigo}
              onChangeText={(text) => setCodigo(text.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              placeholderTextColor="#888"
              keyboardType="numeric"
              maxLength={6}
              textAlign="center"
              autoFocus
            />

            {/* Botón confirmar */}
            <TouchableOpacity
              style={[styles.botonConfirmar, (verificando || codigo.length < 6) && styles.botonDeshabilitado]}
              onPress={confirmarCodigo}
              disabled={verificando || codigo.length < 6}
            >
              {verificando ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={styles.botonConfirmarTexto}>Verificar número</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* Botón reenviar con cooldown */}
        <TouchableOpacity
          style={[styles.botonReenviar, (cooldown > 0 || enviando) && styles.botonDeshabilitado]}
          onPress={enviarSMS}
          disabled={cooldown > 0 || enviando}
        >
          <Text style={styles.botonReenviarTexto}>
            {cooldown > 0 ? `Reenviar código en ${cooldown}s` : 'Reenviar código'}
          </Text>
        </TouchableOpacity>

        {/* Texto de ayuda */}
        <Text style={styles.ayuda}>
          ¿No recibiste el SMS? Revisa que el número sea correcto o espera unos segundos.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────
// Estilos — tema ZAS (negro/amarillo)
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 24,
  },
  titulo: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitulo: {
    fontSize: 15,
    color: '#CCC',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  telefono: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  enviandoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  enviandoTexto: {
    color: '#FFD700',
    fontSize: 14,
  },
  inputCodigo: {
    width: '100%',
    height: 64,
    borderWidth: 2,
    borderColor: '#FFD700',
    borderRadius: 12,
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    backgroundColor: '#111',
    letterSpacing: 12,
    marginBottom: 20,
  },
  botonConfirmar: {
    width: '100%',
    height: 52,
    backgroundColor: '#FFD700',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  botonConfirmarTexto: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#000',
  },
  botonReenviar: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  botonReenviarTexto: {
    fontSize: 14,
    color: '#FFD700',
    textDecorationLine: 'underline',
  },
  botonDeshabilitado: {
    opacity: 0.4,
  },
  ayuda: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 18,
  },
});
