import NetInfo from '@react-native-community/netinfo';

const TIMEOUT_MS = 8000;
const MAX_INTENTOS = 3;

export async function fetchSeguro(
  url: string,
  opciones?: RequestInit,
  intentos = MAX_INTENTOS
): Promise<any> {
  const estado = await NetInfo.fetch();
  if (!estado.isConnected) {
    throw new Error('SIN_RED');
  }

  for (let i = 0; i < intentos; i++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const res = await fetch(url, {
        ...opciones,
        signal: controller.signal,
      });

      clearTimeout(timer);
      return res;
    } catch (e: any) {
      const esUltimoIntento = i === intentos - 1;
      const esAbort = e.name === 'AbortError';

      if (esUltimoIntento) {
        throw esAbort ? new Error('TIMEOUT') : e;
      }

      // Espera progresiva: 1s, 3s entre intentos
      await new Promise(r => setTimeout(r, i === 0 ? 1000 : 3000));
    }
  }
}