import crashlytics from '@react-native-firebase/crashlytics';

export function logError(error: Error, context?: string) {
  if (__DEV__) {
    console.log('Error (no enviado, modo dev):', context, error);
    return;
  }
  if (context) {
    crashlytics().log(context);
  }
  crashlytics().recordError(error);
}

export function setUserId(id: string) {
  if (!__DEV__) {
    crashlytics().setUserId(id);
  }
}

export function logEvent(message: string) {
  if (!__DEV__) {
    crashlytics().log(message);
  }
}