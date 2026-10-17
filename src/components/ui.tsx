import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { bordesNativos, margenArriba, margenLados } from '@/lib/margenes';
import type { Href } from 'expo-router';
import Svg, { Path, Rect } from 'react-native-svg';
import type { Nivel } from '@/lib/avisos';
import { volver } from '@/lib/volver';
import type { TipoArma } from '@/data/types';
import { colors, radius, space } from '@/theme';
import { Degradado } from './Degradado';
import { Icon } from './Icon';
import { SILUETAS } from './siluetas';

export function Screen({ title, kicker = 'Tirador deportivo', back, right, compacto, children }: {
  title?: string;
  compacto?: boolean; // cabecera baja, para el móvil en horizontal
  kicker?: string; // rótulo pequeño encima del título
  back?: boolean | Href; // true o la pantalla a la que volver si no hay anterior
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SafeAreaView
      style={[s.screen, margenArriba(), compacto && margenLados()]}
      edges={bordesNativos(compacto ? ['top', 'left', 'right'] : ['top'])}
    >
      {/* Brillo azul en la parte alta de la pantalla */}
      <View style={s.fondo} pointerEvents="none">
        <Degradado desde={colors.bgTop} hasta={colors.bg} brillo="#2668B8" brilloEn={[0.5, 0]} diagonal={false} />
      </View>
      {title !== undefined && (
        <View style={[s.header, compacto && s.headerCompacto]}>
          {back && (
            <Pressable onPress={() => volver(back === true ? '/' : back)} hitSlop={12} accessibilityLabel="Volver" style={s.botonRedondo}>
              <Icon name="back" color={colors.text} size={22} />
            </Pressable>
          )}
          <View style={{ flex: 1 }}>
            {!compacto && <Text style={s.kicker}>{kicker.toUpperCase()}</Text>}
            <Text style={[s.headerTitle, compacto && s.headerTitleCompacto]} numberOfLines={compacto ? 1 : 2}>
              {compacto ? `${title} · ${kicker}` : title}
            </Text>
          </View>
          {right && <View style={s.botonRedondo}>{right}</View>}
        </View>
      )}
      <ScrollView contentContainerStyle={[s.content, compacto && s.contentCompacto]}>{children}</ScrollView>
    </SafeAreaView>
  );
}

/** Rótulo pequeño en mayúsculas y espaciado, como «ÚLTIMA SESIÓN». */
export function Kicker({ children, color = colors.kicker }: { children: string; color?: string }) {
  return <Text style={[s.kicker, { color }]}>{children.toUpperCase()}</Text>;
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const fondo = <Degradado desde={colors.cardTop} hasta={colors.cardBottom} brillo="#4E9DFF" />;
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [s.card, style, pressed && { opacity: 0.8, transform: [{ scale: 0.99 }] }]}>
        {fondo}
        {children}
      </Pressable>
    );
  }
  return (
    <View style={[s.card, style]}>
      {fondo}
      {children}
    </View>
  );
}

export function SectionTitle({ children, right, kicker }: { children: ReactNode; right?: ReactNode; kicker?: string }) {
  return (
    <View style={s.sectionRow}>
      <Text style={s.sectionTitle}>{children}</Text>
      {right ?? (kicker ? <Kicker>{kicker}</Kicker> : null)}
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
            {active && <Degradado desde={colors.accentLight} hasta={colors.accentDark} />}
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
  const principal = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.button, principal ? s.buttonPrimary : s.buttonSecondary, pressed && { transform: [{ scale: 0.985 }], opacity: 0.9 }]}
    >
      {principal
        ? <Degradado desde={colors.accentLight} hasta={colors.accentDark} />
        : <Degradado desde={colors.cardTop} hasta={colors.cardBottom} />}
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
  screen: { flex: 1, backgroundColor: colors.bg, zIndex: 0 },
  fondo: { position: 'absolute', left: 0, right: 0, top: 0, height: 420, zIndex: -1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm },
  headerCompacto: { paddingTop: space.xs, paddingBottom: space.xs },
  headerTitleCompacto: { fontSize: 18, lineHeight: 22, letterSpacing: -0.3, marginTop: 0 },
  contentCompacto: { paddingTop: space.xs, paddingBottom: space.lg },
  kicker: { color: colors.kicker, fontSize: 10, fontWeight: '900', letterSpacing: 2.4 },
  headerTitle: { color: colors.text, fontSize: 28, lineHeight: 32, fontWeight: '900', letterSpacing: -1, marginTop: 2 },
  botonRedondo: {
    width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border,
  },
  content: { padding: space.lg, paddingTop: space.sm, gap: space.md, paddingBottom: 48 },
  card: {
    backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg, borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden', zIndex: 0, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 10 },
  },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.sm },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '800', letterSpacing: -0.4 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  segmented: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.md, padding: 4, gap: 4, borderWidth: 1, borderColor: colors.borderSoft },
  segment: { flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: 'center', overflow: 'hidden', zIndex: 0 },
  segmentActive: { backgroundColor: colors.accent },
  segmentText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  progress: { height: 8, backgroundColor: colors.cardAlt, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
  button: { minHeight: 52, borderRadius: 18, paddingVertical: 14, paddingHorizontal: space.lg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', zIndex: 0 },
  buttonPrimary: {
    backgroundColor: colors.accent,
    shadowColor: colors.accentDark, shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
  },
  buttonSecondary: { backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  buttonText: { color: '#fff', fontWeight: '900', fontSize: 15, letterSpacing: 0.2, textAlign: 'center' },
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
