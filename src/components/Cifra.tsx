import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, space } from '@/theme';

/** Recuadro con un número destacado y su etiqueta. */
export function Cifra({ titulo, valor, detalle, color = colors.text }: {
  titulo: string;
  valor: string;
  detalle?: string;
  color?: string;
}) {
  return (
    <View style={st.cifra}>
      <Text style={st.titulo} numberOfLines={1}>{titulo}</Text>
      <Text style={[st.valor, { color }]} numberOfLines={1}>{valor}</Text>
      {detalle ? <Text style={st.detalle} numberOfLines={1}>{detalle}</Text> : null}
    </View>
  );
}

/** Anillo de progreso con contenido en el centro. */
export function Anillo({ valor, maximo, tamano = 150, grosor = 12, color = colors.accent, children }: {
  valor: number;
  maximo: number;
  tamano?: number;
  grosor?: number;
  color?: string;
  children?: ReactNode;
}) {
  const r = (tamano - grosor) / 2;
  const c = 2 * Math.PI * r;
  const p = maximo > 0 ? Math.min(1, Math.max(0, valor / maximo)) : 0;
  return (
    <View style={{ width: tamano, height: tamano, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={tamano} height={tamano} style={StyleSheet.absoluteFill}>
        <Circle cx={tamano / 2} cy={tamano / 2} r={r} stroke={colors.cardAlt} strokeWidth={grosor} fill="none" />
        <Circle
          cx={tamano / 2}
          cy={tamano / 2}
          r={r}
          stroke={color}
          strokeWidth={grosor}
          fill="none"
          strokeDasharray={`${c * p} ${c}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${tamano / 2} ${tamano / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

const st = StyleSheet.create({
  cifra: {
    flex: 1, backgroundColor: 'rgba(5,13,22,0.55)', borderRadius: 17, borderWidth: 1, borderColor: colors.borderSoft,
    paddingVertical: space.md, paddingHorizontal: space.md, gap: 2,
  },
  titulo: { color: colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  valor: { fontSize: 23, fontWeight: '900', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  detalle: { color: colors.textMuted, fontSize: 12 },
});
