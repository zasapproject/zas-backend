import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registrarNotificaciones(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('❌ Permiso de notificaciones denegado');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Notificaciones ZAS',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FFD700',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      showBadge: true,
    });
  }

  try {
    const projectId = '8593a256-cca9-410b-ac4e-e3854ddfde42';
    console.log('🔑 ProjectId:', projectId);
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    console.log('✅ Token generado:', token);
    return token;
  } catch (error) {
    console.log('❌ Error generando token:', error);
    return null;
  }
}

export async function enviarNotificacion(titulo: string, mensaje: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: titulo,
      body: mensaje,
      sound: true,
    },
    trigger: null,
  });
}