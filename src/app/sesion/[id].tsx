import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { Diana } from '@/components/Diana';
import { Icon } from '@/components/Icon';
import { Button, Card, Screen, SectionTitle, s } from '@/components/ui';
import { useStore } from '@/data/store';
import type { Sesion } from '@/data/types';
import { formatear } from '@/lib/fechas';
import { agrupacion, formatoMedia, media, sumaSerie, todosLosDisparos, totalSesion } from '@/lib/sesiones';
import { colors, space } from '@/theme';

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
  const mejor = disparos.reduce((m, d) => Math.max(m, d.valor), 0);
  const g = agrupacion(disparos);

  return (
    <Screen title="Entrenamiento" back>
      <View style={{ alignItems: 'center', gap: 4 }}>
        <View style={st.ok}><Icon name="check" size={28} /></View>
        <Text style={s.h2}>Entrenamiento completado</Text>
        <Text style={s.muted}>
          {formatear(sesion.fecha.slice(0, 10))} · {sesion.fecha.slice(11, 16)}
        </Text>
      </View>

      <Card style={{ gap: 4 }}>
        <Text style={st.titulo}>{arma ? `${arma.marca} ${arma.modelo}` : 'Arma'}</Text>
        <Text style={s.muted}>
          {sesion.modalidad} · {sesion.distancia} m · {sesion.series.length} series × {sesion.disparosPorSerie} disparos
          {sesion.municion ? ` · ${sesion.municion}` : ''}
        </Text>
      </Card>

      <View style={st.datos}>
        <Dato titulo="Puntuación total" valor={`${totalSesion(sesion)} / ${disparos.length * 10}`} grande ancho={1.7} />
        <Dato titulo="Media" valor={formatoMedia(media(disparos))} />
        <Dato titulo="Mejor disparo" valor={String(mejor)} />
      </View>

      {sumas.length > 1 && (
        <>
          <SectionTitle>Puntuación por serie</SectionTitle>
          <Card><GraficaSeries sumas={sumas} maximo={sesion.disparosPorSerie * 10} /></Card>
        </>
      )}

      <View style={st.datos}>
        <Dato titulo="Agrupación media" valor={`${Math.round(g.radio)} mm`} />
        <Dato titulo="Centro de impacto" valor={`${horizontal(g.cx)}\n${vertical(g.cy)}`} ancho={1.3} />
      </View>

      <SectionTitle>Todos los impactos</SectionTitle>
      <View style={{ alignItems: 'center' }}>
        <Diana tamano={tamano} disparos={[]} anteriores={disparos} />
      </View>

      <Button title="Volver a Entrenar" onPress={() => router.back()} />
    </Screen>
  );
}

const horizontal = (x: number) => (Math.abs(x) < 1 ? 'centrado' : `${Math.round(Math.abs(x))} mm ${x > 0 ? 'dcha.' : 'izq.'}`);
const vertical = (y: number) => (Math.abs(y) < 1 ? 'centrado' : `${Math.round(Math.abs(y))} mm ${y > 0 ? 'abajo' : 'arriba'}`);

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
  ok: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.green,
    alignItems: 'center', justifyContent: 'center',
  },
});
