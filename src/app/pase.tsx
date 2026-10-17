import { useEffect } from 'react';
import { AppState, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Brightness from 'expo-brightness';
import { useFoto } from '@/components/FotoCampo';
import { FakeQr } from '@/components/ui';
import { useStore } from '@/data/store';
import { formatear } from '@/lib/fechas';

/** Pase al recinto a pantalla completa, con el brillo al máximo para que lea el lector. */
export default function Pase() {
  const { datos } = useStore();
  const f = datos.federacion;
  const qr = useFoto(f.fotoQr);

  // Al salir de la app se cierra el pase, para que el bloqueo con Face ID lo tape al volver.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (e) => {
      if (e === 'background' && router.canGoBack()) router.back();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let previo: number | undefined;
    Brightness.getBrightnessAsync()
      .then((b) => {
        previo = b;
        return Brightness.setBrightnessAsync(1);
      })
      .catch(() => {});
    return () => {
      if (previo !== undefined) Brightness.setBrightnessAsync(previo).catch(() => {});
    };
  }, []);

  return (
    <Pressable style={st.fondo} onPress={() => router.back()}>
      <Text style={st.titulo}>{f.nombre}</Text>
      <View style={st.qr}>
        {qr ? <Image source={{ uri: qr }} style={{ width: 300, height: 300 }} resizeMode="contain" /> : <FakeQr size={280} />}
      </View>
      {f.numeroFederado ? <Text style={st.texto}>Federado nº {f.numeroFederado}</Text> : null}
      {f.caducidadPase ? <Text style={st.texto}>Válido hasta {formatear(f.caducidadPase)}</Text> : null}
      <Text style={st.cerrar}>Toca para cerrar</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  titulo: { fontSize: 18, fontWeight: '700', textAlign: 'center', color: '#000' },
  qr: { padding: 12, backgroundColor: '#fff' },
  texto: { fontSize: 16, color: '#000' },
  cerrar: { marginTop: 24, color: '#666' },
});
