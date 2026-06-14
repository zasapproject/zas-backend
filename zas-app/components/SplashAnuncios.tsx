import { useEffect, useRef, useState } from 'react';
import {
  View, Image, TouchableOpacity, Animated,
  Dimensions, StyleSheet, Text,
} from 'react-native';

const API_URL = 'https://zas-backend-production-fb4e.up.railway.app';
const { width: SW, height: SH } = Dimensions.get('window');

interface Anuncio {
  id: string;
  imagen_url: string;
  orden: number;
  duracion_segundos?: number;
}

interface Props {
  onFinish: () => void;
}

export default function SplashAnuncios({ onFinish }: Props) {
  const [anuncios, setAnuncios] = useState<Anuncio[]>([]);
  const [indice, setIndice] = useState(0);
  const [listo, setListo] = useState(false);
  const progreso = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/anuncios/splash`)
      .then(r => r.json())
      .then(data => {
        const lista: Anuncio[] = (data.anuncios || []).slice(0, 3);
        if (!lista.length) { onFinish(); return; }
        setAnuncios(lista);
        setListo(true);
      })
      .catch(() => onFinish());
  }, []);

  useEffect(() => {
    if (!listo || !anuncios.length) return;

    progreso.setValue(0);
    const duracion = (anuncios[indice]?.duracion_segundos ?? 5) * 1000;

    animRef.current = Animated.timing(progreso, {
      toValue: 1,
      duration: duracion,
      useNativeDriver: false,
    });

    animRef.current.start(({ finished }) => {
      if (finished) avanzar();
    });

    return () => { animRef.current?.stop(); };
  }, [indice, listo]);

  function avanzar() {
    animRef.current?.stop();
    if (indice + 1 >= anuncios.length) {
      onFinish();
    } else {
      setIndice(i => i + 1);
    }
  }

  if (!listo || !anuncios.length) return null;

  const anuncio = anuncios[indice];

  return (
    <View style={styles.overlay}>
      <TouchableOpacity
        activeOpacity={1}
        style={styles.card}
        onPress={avanzar}
      >
        <Image
          source={{ uri: anuncio.imagen_url }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />

        <TouchableOpacity
          style={styles.closeBtn}
          onPress={avanzar}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
        >
          <View style={styles.closeCircle}>
            <Text style={styles.closeText}>✕</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progreso.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  card: {
    width: SW - 32,
    height: SH * 0.9,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 10,
  },
  closeCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  progressTrack: {
    position: 'absolute',
    bottom: 14,
    left: 16,
    right: 16,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
});
