import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { Anillo, Cifra } from '@/components/Cifra';
import { Diana } from '@/components/Diana';
import { Icon } from '@/components/Icon';
import { Button, Card, Screen, SectionTitle, s } from '@/components/ui';
import { useStore } from '@/data/store';
import type { Sesion } from '@/data/types';
import { formatear } from '@/lib/fechas';
import { agrupacion, formatoMedia, media, sumaSerie, todosLosDisparos, totalSesion } from '@/lib/sesiones';
import { colors, radius, space } from '@/theme';

export default function SesionPantalla() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const sesion = store.sesion(id);
  if (!sesion) {
    return <Screen title="Sesión" back><Text style={s.muted}>No se encuentra esta sesión.</Text></Screen>;
  }
  return sesion.terminada ? <Resumen sesion={sesion} /> : <Asistente sesion={sesion} />;
}

function useTamanoDiana() {
  const { width } = useWindowDimensions();
  return Math.min(width - 2 * space.lg, 440);
}

function Asistente({ sesion }: { sesion: Sesion }) {
  const store = useStore();
  const tamano = useTamanoDiana();
  const arma = store.arma(sesion.armaId);
  const nSerie = sesion.series.length;
  const serie = sesion.series[nSerie - 1];
  const completa = serie.disparos.length >= sesion.disparosPorSerie;
  const ultimo = serie.disparos[serie.disparos.length - 1];
  const anteriores = sesion.series.slice(0, -1).flatMap((x) => x.disparos);

  const terminar = () => {
    store.terminarSesion(sesion.id);
  };

  return (
    <Screen title={`Serie ${nSerie} · Disparo ${Math.min(serie.disparos.length + 1, sesion.disparosPorSerie)}/${sesion.disparosPorSerie}`} back>
      <Text style={[s.muted, { textAlign: 'center', marginTop: -space.sm }]}>
        {sesion.distancia} m · {arma ? `${arma.marca} ${arma.modelo}` : ''} · {sesion.modalidad}
      </Text>

      <View style={{ alignItems: 'center' }}>
        <Diana
          tamano={tamano}
          disparos={serie.disparos}
          anteriores={anteriores}
          onToque={completa ? undefined : (x, y) => store.anadirDisparo(sesion.id, x, y)}
        />
      </View>
      <Text style={[s.muted, { textAlign: 'center' }]}>
        {completa ? 'Serie completa' : 'Toca la diana donde ha entrado el disparo'}
      </Text>

      <View style={st.datos}>
        <Dato titulo="Último disparo" valor={ultimo ? String(ultimo.valor) : '–'} grande />
        <Dato titulo="Serie" valor={`${sumaSerie(serie)} / ${serie.disparos.length * 10}`} />
        <Dato titulo="Media serie" valor={serie.disparos.length ? formatoMedia(media(serie.disparos)) : '–'} />
      </View>

      <View style={st.botones}>
        <View style={{ flex: 1 }}>
          <Button title="Deshacer" variant="secondary" onPress={() => store.deshacerDisparo(sesion.id)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title={completa ? 'Siguiente serie' : 'Finalizar serie'}
            onPress={() => serie.disparos.length > 0 && store.nuevaSerie(sesion.id)}
          />
        </View>
      </View>
      <Button title="Terminar entrenamiento" variant="secondary" onPress={terminar} />

      <Card style={st.camara}>
        <Icon name="target" color={colors.textMuted} />
        <Text style={[s.muted, { flex: 1 }]}>
          Detección automática con la cámara en el catalejo: en desarrollo. De momento marca los impactos a mano.
        </Text>
      </Card>
    </Screen>
  );
}

function Resumen({ sesion }: { sesion: Sesion }) {
  const store = useStore();
  const tamano = useTamanoDiana();
  const arma = store.arma(sesion.armaId);
  const disparos = todosLosDisparos(sesion);
  const sumas = sesion.series.map(sumaSerie);
  const total = totalSesion(sesion);
  const maximo = disparos.length * 10;
  const g = agrupacion(disparos);
  // Cuántos disparos de cada valor, del 10 hacia abajo.
  const reparto = [10, 9, 8, 7, 6].map((v) => ({ v, n: disparos.filter((d) => d.valor === v).length }));
  const resto = disparos.filter((d) => d.valor < 6).length;
  const masAlto = Math.max(1, ...reparto.map((r) => r.n), resto);

  return (
    <Screen title="Resultado" back>
      <View style={st.hero}>
        <Anillo valor={total} maximo={maximo} tamano={170} grosor={14} color={colors.green}>
          <Text style={st.total}>{total}</Text>
          <Text style={s.muted}>de {maximo}</Text>
        </Anillo>
        <Text style={st.heroArma}>{arma ? `${arma.marca} ${arma.modelo}` : 'Arma'}</Text>
        <Text style={[s.muted, { textAlign: 'center' }]}>
          {formatear(sesion.fecha.slice(0, 10))} · {sesion.fecha.slice(11, 16)} · {sesion.modalidad} · {sesion.distancia} m
          {sesion.municion ? `\n${sesion.municion}` : ''}
        </Text>
      </View>

      <View style={st.datos}>
        <Cifra titulo="Media" valor={formatoMedia(media(disparos))} color={colors.green} />
        <Cifra titulo="Dieces" valor={String(reparto[0].n)} detalle={`de ${disparos.length}`} />
        <Cifra titulo="Agrupación" valor={`${Math.round(g.radio)} mm`} detalle="radio medio" />
      </View>

      <SectionTitle>Series</SectionTitle>
      <View style={st.series}>
        {sumas.map((v, i) => {
          const max = sesion.series[i].disparos.length * 10;
          const p = max ? v / max : 0;
          return (
            <View key={i} style={st.serie}>
              <Text style={st.serieNum}>S{i + 1}</Text>
              <Text style={[st.serieValor, { color: p >= 0.9 ? colors.green : p >= 0.8 ? colors.text : colors.orange }]}>{v}</Text>
            </View>
          );
        })}
      </View>
      {sumas.length > 1 && <Card><GraficaSeries sumas={sumas} maximo={sesion.disparosPorSerie * 10} /></Card>}

      <SectionTitle>Reparto de impactos</SectionTitle>
      <Card style={{ gap: space.sm }}>
        {[...reparto.map((r) => ({ etiqueta: String(r.v), n: r.n })), { etiqueta: '<6', n: resto }].map((r) => (
          <View key={r.etiqueta} style={st.barraFila}>
            <Text style={st.barraEtiqueta}>{r.etiqueta}</Text>
            <View style={st.barraFondo}>
              <View style={[st.barra, { width: `${(r.n / masAlto) * 100}%` }]} />
            </View>
            <Text style={st.barraN}>{r.n}</Text>
          </View>
        ))}
      </Card>

      <SectionTitle>Todos los impactos</SectionTitle>
      <View style={{ alignItems: 'center' }}>
        <Diana tamano={tamano} disparos={[]} anteriores={disparos} grupo={g} />
      </View>
      <Card style={st.centro}>
        <Icon name="target" color={colors.accent} />
        <View style={{ flex: 1 }}>
          <Text style={s.text}>Centro de impactos</Text>
          <Text style={s.muted}>{consejo(g.cx, g.cy)}</Text>
        </View>
      </Card>

      <Button title="Volver a Entrenar" onPress={() => router.back()} />
    </Screen>
  );
}

/** Dónde queda el centro del grupo respecto al centro de la diana. */
function consejo(cx: number, cy: number): string {
  if (Math.hypot(cx, cy) < 8) return 'Grupo centrado: no hace falta corregir miras.';
  return `El grupo queda ${horizontal(cx)} y ${vertical(cy)} del centro.`;
}

const horizontal = (x: number) => (Math.abs(x) < 1 ? 'centrado en horizontal' : `${Math.round(Math.abs(x))} mm a la ${x > 0 ? 'derecha' : 'izquierda'}`);
const vertical = (y: number) => (Math.abs(y) < 1 ? 'centrado en vertical' : `${Math.round(Math.abs(y))} mm ${y > 0 ? 'abajo' : 'arriba'}`);

function Dato({ titulo, valor, grande, ancho = 1 }: { titulo: string; valor: string; grande?: boolean; ancho?: number }) {
  return (
    <Card style={{ flex: ancho, paddingVertical: space.md, paddingHorizontal: space.md }}>
      <Text style={[s.muted, { fontSize: 12 }]}>{titulo}</Text>
      <Text style={{ color: grande ? colors.green : colors.text, fontSize: grande ? 24 : 17, fontWeight: '700' }}>
        {valor}
      </Text>
    </Card>
  );
}

function GraficaSeries({ sumas, maximo }: { sumas: number[]; maximo: number }) {
  const { width } = useWindowDimensions();
  const w = Math.min(width - 4 * space.lg, 400);
  const h = 140;
  const pad = { l: 30, r: 12, t: 22, b: 22 };
  const minimo = Math.max(0, Math.floor((Math.min(...sumas) - 5) / 10) * 10);
  const x = (i: number) => pad.l + 16 + (i * (w - pad.l - pad.r - 32)) / Math.max(1, sumas.length - 1);
  const y = (v: number) => pad.t + ((maximo - v) * (h - pad.t - pad.b)) / (maximo - minimo);
  const marcas = [minimo, Math.round((minimo + maximo) / 2), maximo];
  return (
    <Svg width={w} height={h}>
      {marcas.map((m) => (
        <SvgText key={m} x={pad.l - 6} y={y(m) + 4} fontSize={10} fill={colors.textMuted} textAnchor="end">{m}</SvgText>
      ))}
      {marcas.map((m) => (
        <Line key={`l${m}`} x1={pad.l} x2={w - pad.r} y1={y(m)} y2={y(m)} stroke={colors.border} strokeWidth={1} />
      ))}
      <Polyline points={sumas.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={colors.accent} strokeWidth={2} />
      {sumas.map((v, i) => (
        <Circle key={i} cx={x(i)} cy={y(v)} r={4} fill={colors.accent} />
      ))}
      {sumas.map((v, i) => (
        <SvgText key={`t${i}`} x={x(i)} y={y(v) - 8} fontSize={11} fontWeight="600" fill={colors.text} textAnchor="middle">{v}</SvgText>
      ))}
      {sumas.map((_, i) => (
        <SvgText key={`s${i}`} x={x(i)} y={h - 6} fontSize={10} fill={colors.textMuted} textAnchor="middle">{i + 1}</SvgText>
      ))}
    </Svg>
  );
}

const st = StyleSheet.create({
  datos: { flexDirection: 'row', gap: space.sm },
  botones: { flexDirection: 'row', gap: space.sm },
  camara: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  titulo: { color: colors.text, fontSize: 16, fontWeight: '700' },
  hero: { alignItems: 'center', gap: 4, paddingVertical: space.md },
  total: { color: colors.text, fontSize: 44, fontWeight: '800', fontVariant: ['tabular-nums'] },
  heroArma: { color: colors.text, fontSize: 20, fontWeight: '700', marginTop: space.md },
  series: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  serie: {
    flexBasis: 48, flexGrow: 1, alignItems: 'center', paddingVertical: space.sm, borderRadius: radius.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  serieNum: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  serieValor: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  barraFila: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  barraEtiqueta: { width: 28, color: colors.text, fontWeight: '700', textAlign: 'right' },
  barraFondo: { flex: 1, height: 12, borderRadius: 6, backgroundColor: colors.cardAlt, overflow: 'hidden' },
  barra: { height: '100%', borderRadius: 6, backgroundColor: colors.accent },
  barraN: { width: 28, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  centro: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
