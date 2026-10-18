import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { AppState, StyleSheet, Text, TextInput, View } from 'react-native';
import { useStore } from '@/data/store';
import { confirmar } from '@/lib/confirmar';
import { comprobarPin } from '@/lib/pin';
import { colors, radius, space } from '@/theme';
import { Icon } from './Icon';
import { Button } from './ui';

const INTENTOS = 5; // fallos seguidos antes de esperar
const ESPERA_S = 30;

/** Versión web: si hay PIN, tapa la app al abrirla y al volver a ella hasta escribirlo. */
export function BloqueoPin() {
  const store = useStore();
  const pin = store.ajustes.pin;
  const [bloqueada, setBloqueada] = useState(!!pin);
  const [texto, setTexto] = useState('');
  const [fallos, setFallos] = useState(0);
  const [espera, setEspera] = useState(0);
  const campo = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    if (!pin) return;
    const sub = AppState.addEventListener('change', (e) => {
      if (e === 'background') {
        setBloqueada(true);
        setTexto('');
      }
    });
    return () => sub.remove();
  }, [pin]);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  if (!pin || !bloqueada) return null;

  const escribir = (t: string) => {
    const limpio = t.replace(/\D/g, '').slice(0, pin.largo);
    setTexto(limpio);
    if (limpio.length < pin.largo) return;
    if (comprobarPin(pin, limpio)) {
      setBloqueada(false);
      setFallos(0);
      setTexto('');
      return;
    }
    const n = fallos + 1;
    setFallos(n);
    setTexto('');
    if (n % INTENTOS === 0) setEspera(ESPERA_S);
  };

  const olvidado = () =>
    confirmar(
      'He olvidado el PIN',
      'La única forma de entrar es borrar los datos de este móvil y recuperar después tu copia de seguridad (Perfil › Copia de seguridad). ¿Borrar los datos?',
      () => {
        store.empezarDeCero();
        store.guardarAjustes({ pin: undefined });
        setBloqueada(false);
      },
      'Borrar datos',
    );

  return (
    <View style={st.tapa}>
      <Icon name="lock" size={48} color={colors.accent} />
      <Text style={st.titulo}>Tirador Deportivo</Text>
      <Text style={st.texto}>{espera > 0 ? `Demasiados intentos. Espera ${espera} s.` : 'Escribe tu PIN'}</Text>
      <View style={st.puntos}>
        {Array.from({ length: pin.largo }, (_, i) => (
          <View key={i} style={[st.punto, i < texto.length && st.lleno]} />
        ))}
      </View>
      <TextInput
        ref={campo}
        value={texto}
        onChangeText={escribir}
        editable={espera <= 0}
        autoFocus
        keyboardType="number-pad"
        secureTextEntry
        maxLength={pin.largo}
        accessibilityLabel="PIN"
        style={st.campo}
      />
      {fallos > 0 && espera <= 0 && <Text style={{ color: colors.red }}>PIN incorrecto</Text>}
      <View style={{ alignSelf: 'stretch', gap: space.sm, marginTop: space.lg }}>
        <Button title="Escribir el PIN" variant="secondary" onPress={() => campo.current?.focus()} />
        <Button title="He olvidado el PIN" variant="secondary" onPress={olvidado} />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  tapa: {
    ...StyleSheet.absoluteFill, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center',
    gap: space.md, padding: space.xl, zIndex: 100,
  },
  titulo: { color: colors.text, fontSize: 22, fontWeight: '700' },
  texto: { color: colors.textMuted, fontSize: 15 },
  puntos: { flexDirection: 'row', gap: space.md, marginVertical: space.sm },
  punto: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.textMuted },
  lleno: { backgroundColor: colors.accent, borderColor: colors.accent },
  campo: {
    width: 180, textAlign: 'center', fontSize: 24, letterSpacing: 8, color: colors.text,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 10, backgroundColor: colors.card,
  },
});
