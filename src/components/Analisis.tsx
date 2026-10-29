import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg';
import { useLicenciaApp } from '@/components/Activacion';
import { Card, SectionTitle, s } from '@/components/ui';
import type { Arma, Sesion } from '@/data/types';
import { desvio, fatiga, porMunicion, type FilaMunicion } from '@/lib/analisis';
import { correccion, textoCorreccion } from '@/lib/grupo';
import { formatoMedia } from '@/lib/sesiones';
import { colors, space } from '@/theme';

/** Análisis de los entrenamientos elegidos en Evolución: desvío, aguante y munición. */
export function Analisis({ sesiones, armas }: { sesiones: Sesion[]; armas: Arma[] }) {
  return (
    <>
      <SectionTitle>Análisis de tu tiro</SectionTitle>
      <Desvio sesiones={sesiones} arma={armas.find((a) => a.id === sesiones[0]?.armaId)} />
      <Aguante sesiones={sesiones} />
      <Municion sesiones={sesiones} armas={armas} />
    </>
  );
}

function Desvio({ sesiones, arma }: { sesiones: Sesion[]; arma?: Arma }) {
  const d = desvio(sesiones);
  const { esPro } = useLicenciaApp(); // la corrección de miras es de la versión Pro
  const lado = 150;
  const k = lado / 2 / 1.6; // el negro (radio 1) ocupa algo más de la mitad
  const P = (v: number) => lado / 2 + Math.max(-1.55, Math.min(1.55, v)) * k;
  return (
    <Card style={{ gap: space.sm }}>
      <Text style={st.titulo}>Hacia dónde van tus grupos</Text>
      {!d ? (
        <Text style={s.muted}>
          Hacen falta al menos 3 entrenamientos con los impactos marcados en la diana (con el dedo, la cámara o la foto; el
          teclado de números no guarda dónde entró el disparo).
        </Text>
      ) : (
        <View style={st.desvio}>
          <Svg width={lado} height={lado}>
            <Circle cx={lado / 2} cy={lado / 2} r={k} fill={colors.dianaFondo} />
            <Circle cx={lado / 2} cy={lado / 2} r={k / 2} fill="none" stroke={colors.border} />
            <Line x1={lado / 2} x2={lado / 2} y1={4} y2={lado - 4} stroke={colors.border} />
            <Line y1={lado / 2} y2={lado / 2} x1={4} x2={lado - 4} stroke={colors.border} />
            {d.centros.map((c, i) => <Circle key={i} cx={P(c.x)} cy={P(c.y)} r={3} fill={colors.textMuted} />)}
            <Circle cx={P(d.x)} cy={P(d.y)} r={6} fill={colors.accent} stroke="#fff" strokeWidth={1.5} />
            <SvgText x={lado / 2} y={12} fontSize={9} fill={colors.textMuted} textAnchor="middle">arriba</SvgText>
          </Svg>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={s.text}>
              {d.texto ? `Tus grupos tienden a quedar ${d.texto}.` : 'No hay un desvío claro: tus grupos quedan repartidos alrededor del centro.'}
            </Text>
            <Text style={[s.muted, { fontSize: 13 }]}>
              {d.texto
                ? `Pasa en ${Math.round(d.constante * d.sesiones)} de ${d.sesiones} entrenamientos. Si sigue así, puede ser un ajuste de miras o algo de técnica: coméntalo con tu entrenador.`
                : `Basado en ${d.sesiones} entrenamientos y ${d.disparos} disparos.`}
            </Text>
            <Text style={[s.muted, { fontSize: 11 }]}>Gris: centro de cada entrenamiento. Azul: la media.</Text>
          </View>
        </View>
      )}
      {esPro && d?.mm && (() => {
        const c = correccion(d.mm.x, d.mm.y, d.mm.distancia, arma?.clic);
        return (
          <View style={{ gap: 4, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.sm }}>
            <Text style={[s.text, { fontWeight: '700' }]}>Corrección de miras a {d.mm.distancia} m</Text>
            {Math.abs(d.mm.x) >= 2 && <Text style={s.text}>↔ {textoCorreccion(c.horizontal, 'h', arma?.clic)}</Text>}
            {Math.abs(d.mm.y) >= 2 && <Text style={s.text}>↕ {textoCorreccion(c.vertical, 'v', arma?.clic)}</Text>}
            <Text style={[s.muted, { fontSize: 12 }]}>
              Se repite en {d.mm.sesiones} entrenamientos a esta distancia. Mueve el alza o la torreta hacia donde quieres llevar
              los disparos. Si tu grupo además es abierto, primero trabaja la técnica y luego las miras.
            </Text>
          </View>
        );
      })()}
    </Card>
  );
}

function Aguante({ sesiones }: { sesiones: Sesion[] }) {
  const f = fatiga(sesiones);
  const { width } = useWindowDimensions();
  if (!f) {
    return (
      <Card style={{ gap: space.sm }}>
        <Text style={st.titulo}>Cómo aguantas</Text>
        <Text style={s.muted}>Hacen falta al menos 2 entrenamientos de 4 series o más.</Text>
      </Card>
    );
  }
  const dif = f.ultimas - f.primeras;
  const filas = f.porDisparo.filter((x) => x.disparos >= 3);
  const ancho = Math.min(width - 4 * space.lg, 400);
  const minimo = Math.max(0, Math.floor(Math.min(...filas.map((x) => x.media)) - 0.5));
  const maximo = Math.min(10, Math.ceil(Math.max(...filas.map((x) => x.media)) + 0.2));
  const h = 110;
  const barra = filas.length ? ancho / filas.length : 0;
  return (
    <Card style={{ gap: space.sm }}>
      <Text style={st.titulo}>Cómo aguantas</Text>
      <Text style={s.text}>
        {Math.abs(dif) < 0.1
          ? 'Mantienes el nivel de principio a fin.'
          : dif < 0
            ? `En la segunda mitad bajas ${formatoMedia(-dif)} puntos por disparo.`
            : `En la segunda mitad subes ${formatoMedia(dif)} puntos por disparo: te cuesta entrar en calor.`}
      </Text>
      <Text style={[s.muted, { fontSize: 13 }]}>
        Media por disparo: {formatoMedia(f.primeras)} en la primera mitad de las series y {formatoMedia(f.ultimas)} en la
        segunda. Bajas al final en {f.bajan} de {f.sesiones} entrenamientos.
      </Text>
      {filas.length > 1 && (
        <>
          <Text style={[s.muted, { fontSize: 12, marginTop: space.sm }]}>Media según el disparo de la serie</Text>
          <Svg width={ancho} height={h + 16}>
            {filas.map((x, i) => {
              const alto = ((x.media - minimo) / (maximo - minimo || 1)) * (h - 14);
              return (
                <G key={x.n}>
                  <Line x1={i * barra + barra / 2} x2={i * barra + barra / 2} y1={h} y2={h - Math.max(2, alto)} stroke={colors.accent} strokeWidth={Math.max(6, barra - 8)} strokeLinecap="round" />
                  <SvgText x={i * barra + barra / 2} y={h - Math.max(2, alto) - 6} fontSize={9} fill={colors.text} textAnchor="middle">{formatoMedia(x.media)}</SvgText>
                  <SvgText x={i * barra + barra / 2} y={h + 13} fontSize={10} fill={colors.textMuted} textAnchor="middle">{x.n}º</SvgText>
                </G>
              );
            })}
          </Svg>
        </>
      )}
    </Card>
  );
}

function Municion({ sesiones, armas }: { sesiones: Sesion[]; armas: Arma[] }) {
  const filas = porMunicion(sesiones, armas);
  // Mejor agrupación dentro de cada arma y distancia (si hay al menos dos municiones que comparar).
  const grupo = (f: FilaMunicion) => `${f.armaId}|${f.distancia}`;
  const mejor = new Set<FilaMunicion>();
  for (const k of new Set(filas.map(grupo))) {
    const g = filas.filter((f) => grupo(f) === k && f.agrupacion !== null);
    if (g.length < 2) continue;
    const orden = [...g].sort((a, b) => a.agrupacion! - b.agrupacion!);
    if (orden[1].agrupacion! - orden[0].agrupacion! >= 1) mejor.add(orden[0]);
  }
  return (
    <Card style={{ gap: space.sm }}>
      <Text style={st.titulo}>Con qué munición tiras mejor</Text>
      {filas.length === 0 ? (
        <Text style={s.muted}>
          Hacen falta al menos 2 entrenamientos con la misma munición, arma y distancia. Escribe la munición al empezar cada
          entrenamiento.
        </Text>
      ) : (
        filas.map((f, i) => (
          <View key={`${grupo(f)}|${f.municion}`} style={[st.fila, i > 0 && st.borde]}>
            <View style={{ flex: 1 }}>
              <Text style={s.text}>{f.municion}</Text>
              <Text style={[s.muted, { fontSize: 12 }]}>{f.arma} · {f.distancia} m · {f.sesiones} entrenamientos, {f.disparos} disparos</Text>
              {mejor.has(f) && <Text style={{ color: colors.green, fontSize: 12, fontWeight: '700' }}>La que mejor agrupa con esta arma</Text>}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={st.num}>{formatoMedia(f.media)}</Text>
              <Text style={[s.muted, { fontSize: 12 }]}>{f.agrupacion !== null ? `${Math.round(f.agrupacion)} mm` : 'sin posición'}</Text>
            </View>
          </View>
        ))
      )}
      {filas.length > 0 && (
        <Text style={[s.muted, { fontSize: 12 }]}>Media por disparo y radio medio de agrupación. Con pocos entrenamientos, tómalo como orientación.</Text>
      )}
    </Card>
  );
}

const st = StyleSheet.create({
  titulo: { color: colors.text, fontSize: 16, fontWeight: '800' },
  desvio: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  borde: { borderTopWidth: 1, borderTopColor: colors.border },
  num: { color: colors.green, fontSize: 18, fontWeight: '800' },
});
