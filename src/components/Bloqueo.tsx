import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { useStore } from '@/data/store';
import { autenticar } from '@/lib/seguridad';
import { colors, space } from '@/theme';
import { BloqueoPin } from './BloqueoPin';
import { Logo } from './Logo';
import { Button } from './ui';

/** Si el bloqueo está activado, tapa la app al abrirla y al volver de segundo plano hasta pasar Face ID. */
export function Bloqueo({ children }: { children: ReactNode }) {
  const activado = useStore().ajustes.bloqueo;
  const [bloqueada, setBloqueada] = useState(activado);
  const [pidiendo, setPidiendo] = useState(false);
  const estuvoFuera = useRef(false);

  const desbloquear = useCallback(() => {
    setPidiendo(true);
    autenticar()
      .then((ok) => ok && setBloqueada(false))
      .catch(() => {})
      .finally(() => setPidiendo(false));
  }, []);

  useEffect(() => {
    if (!activado) return;
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'background') {
        estuvoFuera.current = true;
        setBloqueada(true);
      }
      // El propio aviso de Face ID pasa la app a inactiva y vuelve: solo se pide tras salir de verdad.
      if (estado === 'active' && estuvoFuera.current) {
        estuvoFuera.current = false;
        desbloquear();
      }
    });
    return () => sub.remove();
  }, [activado, desbloquear]);

  // Al arrancar bloqueada se pide Face ID directamente.
  const alArrancar = useRef(activado);
  useEffect(() => {
    if (!alArrancar.current) return;
    autenticar().then((ok) => ok && setBloqueada(false)).catch(() => {});
  }, []);

  return (
    <>
      {children}
      {Platform.OS === 'web' && <BloqueoPin />}
      {activado && bloqueada && (
        <View style={st.tapa}>
          <Logo size={72} />
          <Text style={st.titulo}>Tirador 360</Text>
          <Text style={st.texto}>Tus documentos están protegidos.</Text>
          {!pidiendo && (
            <View style={{ alignSelf: 'stretch' }}>
              <Button title="Desbloquear con Face ID" onPress={desbloquear} />
            </View>
          )}
        </View>
      )}
    </>
  );
}

const st = StyleSheet.create({
  tapa: {
    ...StyleSheet.absoluteFill, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center',
    gap: space.md, padding: space.xl,
  },
  titulo: { color: colors.text, fontSize: 22, fontWeight: '700' },
  texto: { color: colors.textMuted, fontSize: 15, marginBottom: space.md },
});
