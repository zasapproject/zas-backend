import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  initialRouteName: 'login',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    const handleAppState = async (nextState: string) => {
      if (nextState === 'inactive' || nextState === 'background') {
        try {
          const sesionRaw = await AsyncStorage.getItem('usuario_sesion');
          const conductorRaw = await AsyncStorage.getItem('conductor_sesion');
          if (sesionRaw) {
            const usuario = JSON.parse(sesionRaw);
            if (usuario?.id) {
              await fetch(`https://zasapps.com/api/usuarios/logout/${usuario.id}`, { method: 'POST' });
            }
          }
          if (conductorRaw) {
            const conductor = JSON.parse(conductorRaw);
            if (conductor?.id) {
              await fetch(`https://zasapps.com/api/conductores/logout/${conductor.id}`, { method: 'POST' });
            }
          }
        } catch {}
      }
    };

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen name="home" options={{ headerShown: false }} />
        <Stack.Screen name="conductor" options={{ headerShown: false }} />
        <Stack.Screen name="mapa" options={{ headerShown: false }} />
        <Stack.Screen name="calificacion" options={{ headerShown: false }} />
        <Stack.Screen name="suscripcion" options={{ headerShown: false }} />
        <Stack.Screen name="perfil_conductor" options={{ headerShown: false }} />
        <Stack.Screen name="mapa_viaje" options={{ headerShown: false }} />
        <Stack.Screen name="documentos_conductor" options={{ headerShown: false }} />
        <Stack.Screen name="documentos_usuario" options={{ headerShown: false }} />
        <Stack.Screen name="historial" options={{ headerShown: false }} />
        <Stack.Screen name="editar_perfil" options={{ headerShown: false }} />
        <Stack.Screen name="terminos" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}