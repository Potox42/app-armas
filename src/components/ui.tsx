import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { bordesNativos, margenArriba } from '@/lib/margenes';
import type { Href } from 'expo-router';
import Svg, { Path, Rect } from 'react-native-svg';
import type { Nivel } from '@/lib/avisos';
import { volver } from '@/lib/volver';
import type { TipoArma } from '@/data/types';
import { colors, radius, space } from '@/theme';
import { Icon } from './Icon';
import { SILUETAS } from './siluetas';

export function Screen({ title, back, right, children }: {
  title?: string;
  back?: boolean | Href; // true o la pantalla a la que volver si no hay anterior
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SafeAreaView style={[s.screen, margenArriba()]} edges={bordesNativos(['top'])}>
      {title !== undefined && (
        <View style={s.header}>
          <View style={s.headerSide}>
            {back && (
              <Pressable onPress={() => volver(back === true ? '/' : back)} hitSlop={12} accessibilityLabel="Volver">
                <Icon name="back" color={colors.text} />
              </Pressable>
            )}
          </View>
          <Text style={s.headerTitle}>{title}</Text>
          <View style={[s.headerSide, { alignItems: 'flex-end' }]}>{right}</View>
        </View>
      )}
      <ScrollView contentContainerStyle={s.content}>{children}</ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [s.card, style, pressed && { opacity: 0.7 }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[s.card, style]}>{children}</View>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={s.sectionRow}>
      <Text style={s.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

const NIVEL = {
  rojo: { bg: colors.redSoft, fg: colors.red },
  naranja: { bg: colors.orangeSoft, fg: colors.orange },
  verde: { bg: colors.greenSoft, fg: colors.green },
};

export function nivelColor(n: Nivel) {
  return NIVEL[n].fg;
}

export function Badge({ nivel, children }: { nivel: Nivel; children: ReactNode }) {
  return (
    <View style={[s.badge, { backgroundColor: NIVEL[nivel].bg }]}>
      <Text style={[s.badgeText, { color: NIVEL[nivel].fg }]}>{children}</Text>
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={s.segmented}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={[s.segment, active && s.segmentActive]}>
            <Text style={[s.segmentText, active && { color: '#fff' }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(1, value / max);
  const color = pct >= 1 ? colors.red : pct >= 0.8 ? colors.orange : colors.green;
  return (
    <View style={s.progress}>
      <View style={[s.progressFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

export function Button({ title, onPress, variant = 'primary' }: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.button, variant === 'secondary' && s.buttonSecondary, pressed && { opacity: 0.75 }]}
    >
      <Text style={s.buttonText}>{title}</Text>
    </Pressable>
  );
}

export function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

/** Silueta del arma mientras no haya foto real. */
export function GunArt({ tipo, width = 120 }: { tipo: TipoArma; width?: number }) {
  return (
    <Svg width={width} height={width * 0.5} viewBox="0 0 240 120">
      {SILUETAS[tipo].map((t, i) => (
        <Path
          key={i}
          d={t.d}
          fill={t.relleno ?? 'none'}
          stroke={t.linea ?? 'none'}
          strokeWidth={t.grosor ?? 0}
          strokeLinecap="round"
        />
      ))}
    </Svg>
  );
}

/** Hueco para la foto de un documento (anverso/reverso). */
export function DocPlaceholder({ label }: { label: string }) {
  return (
    <View style={s.doc}>
      <Icon name="doc" color={colors.textMuted} size={28} />
      <Text style={s.docText}>{label}</Text>
      <Text style={s.docHint}>Toca para añadir foto</Text>
    </View>
  );
}

function patronQr(n: number, seed: number): [number, number][] {
  let x = seed;
  const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  const finder = (i: number, j: number) =>
    (i < 7 && j < 7) || (i < 7 && j >= n - 7) || (i >= n - 7 && j < 7);
  const celdas: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (!finder(i, j) && rnd() > 0.5) celdas.push([i, j]);
    }
  }
  return celdas;
}

/** QR de ejemplo (dibujo, no escaneable) hasta que se guarde el real. */
export function FakeQr({ size = 160, seed = 7 }: { size?: number; seed?: number }) {
  const n = 21;
  const cells = patronQr(n, seed).map(([i, j]) => (
    <Rect key={`${i}-${j}`} x={j} y={i} width={1} height={1} fill="#000" />
  ));
  const box = (cx: number, cy: number) => (
    <>
      <Rect x={cx} y={cy} width={7} height={7} fill="#000" />
      <Rect x={cx + 1} y={cy + 1} width={5} height={5} fill="#fff" />
      <Rect x={cx + 2} y={cy + 2} width={3} height={3} fill="#000" />
    </>
  );
  return (
    <Svg width={size} height={size} viewBox={`-1 -1 ${n + 2} ${n + 2}`}>
      <Rect x={-1} y={-1} width={n + 2} height={n + 2} fill="#fff" />
      {box(0, 0)}
      {box(n - 7, 0)}
      {box(0, n - 7)}
      {cells}
    </Svg>
  );
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.md },
  headerSide: { width: 40 },
  headerTitle: { flex: 1, textAlign: 'center', color: colors.text, fontSize: 18, fontWeight: '700' },
  content: { padding: space.lg, gap: space.md, paddingBottom: 40 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg, borderWidth: 1, borderColor: colors.border },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.sm },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  segmented: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.md, padding: 4, gap: 4 },
  segment: { flex: 1, paddingVertical: 8, borderRadius: radius.sm, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.accent },
  segmentText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  progress: { height: 8, backgroundColor: colors.cardAlt, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
  button: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  buttonSecondary: { backgroundColor: colors.cardAlt },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  rowLabel: { color: colors.textMuted, fontSize: 14 },
  rowValue: { color: colors.text, fontSize: 14, fontWeight: '600' },
  doc: {
    flex: 1, aspectRatio: 1.58, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed',
    borderColor: colors.border, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  docText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  docHint: { color: colors.textMuted, fontSize: 11 },
  muted: { color: colors.textMuted, fontSize: 13 },
  text: { color: colors.text, fontSize: 15 },
  h2: { color: colors.text, fontSize: 20, fontWeight: '700' },
});
