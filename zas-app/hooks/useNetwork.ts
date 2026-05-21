import { useState, useEffect } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export function useNetwork() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsOnline(!!state.isConnected && !!state.isInternetReachable);
    });

    // Verificar estado inicial
    NetInfo.fetch().then((state: NetInfoState) => {
      setIsOnline(!!state.isConnected && !!state.isInternetReachable);
    });

    return () => unsubscribe();
  }, []);

  return { isOnline };
}