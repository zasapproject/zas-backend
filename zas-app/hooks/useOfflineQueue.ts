import { useEffect, useRef, useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export interface UbicacionPendiente {
  latitud: number;
  longitud: number;
  timestamp: number;
}

export type FlushFn = (pendientes: UbicacionPendiente[]) => Promise<void>;

interface UseOfflineQueueReturn {
  isOnline: boolean;
  pendingCount: number;
  enqueue: (latitud: number, longitud: number) => void;
  connectionLabel: string;
  connectionColor: string;
}

const QUEUE_KEY = 'zas_gps_pendientes';
const MAX_QUEUE_SIZE = 50;

export function useOfflineQueue(flushFn: FlushFn): UseOfflineQueueReturn {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const flushRef = useRef<FlushFn>(flushFn);
  const isFlushing = useRef(false);

  useEffect(() => {
    flushRef.current = flushFn;
  }, [flushFn]);

  const readQueue = useCallback(async (): Promise<UbicacionPendiente[]> => {
    try {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, []);

  const writeQueue = useCallback(async (queue: UbicacionPendiente[]) => {
    try {
      const trimmed = queue.slice(-MAX_QUEUE_SIZE);
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed));
      setPendingCount(trimmed.length);
    } catch {}
  }, []);

  const flushQueue = useCallback(async () => {
    if (isFlushing.current) return;
    isFlushing.current = true;
    try {
      const queue = await readQueue();
      if (queue.length === 0) {
        isFlushing.current = false;
        return;
      }
      await flushRef.current(queue);
      await AsyncStorage.removeItem(QUEUE_KEY);
      setPendingCount(0);
    } catch {
    } finally {
      isFlushing.current = false;
    }
  }, [readQueue]);

  const enqueue = useCallback(async (latitud: number, longitud: number) => {
    const punto: UbicacionPendiente = { latitud, longitud, timestamp: Date.now() };
    const queue = await readQueue();
    await writeQueue([...queue, punto]);
    if (isOnline) {
      await flushQueue();
    }
  }, [isOnline, readQueue, writeQueue, flushQueue]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online =
        state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(online);
      if (online) flushQueue();
    });
    NetInfo.fetch().then((state) => {
      const online =
        state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(online);
    });
    return () => unsubscribe();
  }, [flushQueue]);

  const connectionLabel = isOnline
    ? pendingCount > 0 ? 'Sincronizando...' : 'En linea'
    : `Sin conexion (${pendingCount} en cola)`;

  const connectionColor = isOnline
    ? pendingCount > 0 ? '#F59E0B' : '#10B981'
    : '#EF4444';

  return { isOnline, pendingCount, enqueue, connectionLabel, connectionColor };
}
