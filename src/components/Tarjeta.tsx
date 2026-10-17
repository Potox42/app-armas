import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { radius, space } from '@/theme';

export const TONOS = {
  azul: ['#1E7BFF', '#0B3C8C'],
  verde: ['#1FA463', '#0B5133'],
  naranja: ['#E08A12', '#7A3E06'],
  morado: ['#6D4AFF', '#2E1A80'],
  rojo: ['#D9363E', '#6B1015'],
} as const;

export type Tono = keyof typeof TONOS;

/** Tarjeta con aspecto de carnet de cartera (proporción de tarjeta bancaria). */
export function Tarjeta({ tono, etiqueta, titulo, sello, children, pie, onPress }: {
  tono: Tono;
  etiqueta: string; // texto pequeño arriba, p. ej. «Licencia de armas»
  titulo: string; // p. ej. «Tipo F»
  sello?: string; // letra o sigla grande a la derecha
  children?: ReactNode; // datos
  pie?: ReactNode; // estado (badge)
  onPress?: () => void;
}) {
  const [a, b] = TONOS[tono];
  const id = `g-${tono}`;
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [st.tarjeta, pressed && { opacity: 0.85 }]}>
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 63">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={a} />
            <Stop offset="1" stopColor={b} />
          </LinearGradient>
        </Defs>
        <Rect width="100" height="63" fill={`url(#${id})`} />
        <Circle cx="92" cy="6" r="30" fill="#fff" opacity={0.07} />
        <Circle cx="100" cy="63" r="22" fill="#000" opacity={0.08} />
      </Svg>
      <View style={st.cabecera}>
        <View style={{ flex: 1 }}>
          <Text style={st.etiqueta} numberOfLines={1}>{etiqueta}</Text>
          <Text style={st.titulo} numberOfLines={1}>{titulo}</Text>
        </View>
        {sello ? <Text style={st.sello}>{sello}</Text> : null}
      </View>
      <View style={{ gap: 2 }}>{children}</View>
      {pie ? <View style={st.pie}>{pie}</View> : null}
    </Pressable>
  );
}

/** Dato dentro de una tarjeta: etiqueta pequeña y valor. */
export function DatoTarjeta({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={st.dato}>
      <Text style={st.datoEtiqueta}>{etiqueta}</Text>
      <Text style={st.datoValor}>{valor}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  tarjeta: {
    aspectRatio: 1.586, borderRadius: radius.lg, overflow: 'hidden', padding: space.lg,
    justifyContent: 'space-between',
  },
  cabecera: { flexDirection: 'row', alignItems: 'flex-start' },
  etiqueta: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  titulo: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 2 },
  sello: { color: 'rgba(255,255,255,0.9)', fontSize: 44, fontWeight: '900', lineHeight: 46 },
  dato: { flexDirection: 'row', justifyContent: 'space-between' },
  datoEtiqueta: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  datoValor: { color: '#fff', fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  pie: { flexDirection: 'row', justifyContent: 'flex-start' },
});

/** Estado sobre la tarjeta: punto de color (verde, naranja, rojo) y texto. */
export function EstadoTarjeta({ color, texto }: { color: string; texto: string }) {
  return (
    <View style={est.pastilla}>
      <View style={[est.punto, { backgroundColor: color }]} />
      <Text style={est.texto}>{texto}</Text>
    </View>
  );
}

const est = StyleSheet.create({
  pastilla: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.28)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  punto: { width: 8, height: 8, borderRadius: 4 },
  texto: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
