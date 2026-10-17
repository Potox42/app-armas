import { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { colors, space } from '@/theme';

/** Puntuación de cada disparo de la serie en curso (0 a 10), con la media como línea discontinua. */
export function GraficaDisparos({ valores, previstos, alto = 150 }: { valores: number[]; previstos: number; alto?: number }) {
  const { width } = useWindowDimensions();
  // Se ajusta al hueco que tiene (en horizontal, la columna derecha es estrecha).
  const [hueco, setHueco] = useState<number | null>(null);
  const w = Math.min(hueco ?? width - 4 * space.lg, 420);
  const h = alto;
  const pad = { l: 26, r: 14, t: 18, b: 22 };
  const n = Math.max(previstos, valores.length, 2);
  const x = (i: number) => pad.l + 8 + (i * (w - pad.l - pad.r - 16)) / (n - 1);
  const y = (v: number) => pad.t + ((10 - v) * (h - pad.t - pad.b)) / 10;
  const media = valores.length ? valores.reduce((t, v) => t + v, 0) / valores.length : 0;
  return (
    <View style={{ alignSelf: 'stretch', alignItems: 'center' }} onLayout={(e) => setHueco(Math.floor(e.nativeEvent.layout.width))}>
      <Svg width={w} height={h}>
        {[0, 5, 8, 10].map((m) => (
          <Line key={m} x1={pad.l} x2={w - pad.r} y1={y(m)} y2={y(m)} stroke={colors.border} strokeWidth={1} />
        ))}
        {[0, 5, 8, 10].map((m) => (
          <SvgText key={`t${m}`} x={pad.l - 6} y={y(m) + 4} fontSize={10} fill={colors.textMuted} textAnchor="end">{m}</SvgText>
        ))}
        {valores.length > 1 && (
          <Line x1={pad.l} x2={w - pad.r} y1={y(media)} y2={y(media)} stroke={colors.green} strokeWidth={1.5} strokeDasharray="5 4" />
        )}
        {valores.length > 1 && (
          <Polyline points={valores.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={colors.accent} strokeWidth={2.5} />
        )}
        {valores.map((v, i) => (
          <Circle key={`c${i}`} cx={x(i)} cy={y(v)} r={i === valores.length - 1 ? 6 : 4} fill={i === valores.length - 1 ? colors.green : colors.accent} stroke={colors.bg} strokeWidth={1.5} />
        ))}
        {Array.from({ length: n }, (_, i) => (
          <SvgText key={`n${i}`} x={x(i)} y={h - 6} fontSize={10} fill={colors.textMuted} textAnchor="middle">{i + 1}</SvgText>
        ))}
      </Svg>
    </View>
  );
}
