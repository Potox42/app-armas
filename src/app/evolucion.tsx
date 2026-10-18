import { useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { Analisis } from '@/components/Analisis';
import { Card, Screen, Segmented, SectionTitle, s } from '@/components/ui';
import { useStore } from '@/data/store';
import type { Sesion } from '@/data/types';
import { diasHasta, formatear } from '@/lib/fechas';
import { agrupacion, formatoMedia, media, todosLosDisparos, totalSesion } from '@/lib/sesiones';
import { colors, space } from '@/theme';

type Periodo = '30' | '182' | '365' | 'todo';

interface Punto {
  sesion: Sesion;
  dia: number; // días desde hoy (negativo)
  media: number;
  agrupacion: number;
}

export default function Evolucion() {
  const { datos } = useStore();
  const [armaId, setArmaId] = useState<string>('todas');
  const [periodo, setPeriodo] = useState<Periodo>('182');

  const hoy = new Date().toISOString().slice(0, 10);
  const puntos: Punto[] = datos.sesiones
    .filter((x) => x.terminada && todosLosDisparos(x).length > 0)
    .filter((x) => armaId === 'todas' || x.armaId === armaId)
    .map((x) => {
      const disparos = todosLosDisparos(x);
      return {
        sesion: x,
        dia: diasHasta(x.fecha.slice(0, 10), hoy),
        media: media(disparos),
        agrupacion: agrupacion(disparos).radio,
      };
    })
    .filter((p) => periodo === 'todo' || -p.dia <= Number(periodo))
    .sort((a, b) => a.dia - b.dia);

  const armasUsadas = datos.armas.filter((a) => datos.sesiones.some((x) => x.armaId === a.id));
  const primero = puntos[0];
  const ultimo = puntos[puntos.length - 1];
  const tendencia = regresion(puntos.map((p) => [p.dia, p.media]));
  const tendenciaAgrup = regresion(puntos.map((p) => [p.dia, p.agrupacion]));
  const disparos = puntos.reduce((t, p) => t + todosLosDisparos(p.sesion).length, 0);

  return (
    <Screen title="Mi evolución" back="/entrenar">
      <Segmented
        value={armaId}
        onChange={setArmaId}
        options={[{ value: 'todas', label: 'Todas' }, ...armasUsadas.map((a) => ({ value: a.id, label: `${a.marca} ${a.modelo}` }))]}
      />
      <Segmented
        value={periodo}
        onChange={setPeriodo}
        options={[
          { value: '30', label: '30 días' },
          { value: '182', label: '6 meses' },
          { value: '365', label: '1 año' },
          { value: 'todo', label: 'Todo' },
        ]}
      />

      {puntos.length < 2 ? (
        <Card><Text style={s.muted}>Hacen falta al menos dos entrenamientos en este periodo para ver la evolución.</Text></Card>
      ) : (
        <>
          <View style={st.fila}>
            <Kpi
              titulo="Media por disparo"
              valor={`${formatoMedia(tendencia.en(primero.dia))} → ${formatoMedia(tendencia.en(ultimo.dia))}`}
              cambio={cambio(tendencia.en(primero.dia), tendencia.en(ultimo.dia))}
              mejorSiSube
            />
            <Kpi
              titulo="Agrupación media"
              valor={`${Math.round(tendenciaAgrup.en(primero.dia))} → ${Math.round(tendenciaAgrup.en(ultimo.dia))} mm`}
              cambio={cambio(tendenciaAgrup.en(primero.dia), tendenciaAgrup.en(ultimo.dia))}
            />
          </View>
          <Text style={[s.muted, { fontSize: 12 }]}>
            Valores de la línea de tendencia al principio y al final del periodo. {puntos.length} entrenamientos, {disparos} disparos.
          </Text>

          <SectionTitle>Media por disparo</SectionTitle>
          <Card>
            <Grafica puntos={puntos.map((p) => ({ x: p.dia, y: p.media }))} tendencia={tendencia} decimales={1} />
          </Card>

          <SectionTitle>Agrupación (mm, menos es mejor)</SectionTitle>
          <Card>
            <Grafica puntos={puntos.map((p) => ({ x: p.dia, y: p.agrupacion }))} tendencia={tendenciaAgrup} decimales={0} />
          </Card>
        </>
      )}

      <Analisis sesiones={puntos.map((p) => p.sesion)} armas={datos.armas} />

      <SectionTitle>Entrenamientos</SectionTitle>
      {[...puntos].reverse().map((p) => {
        const a = datos.armas.find((x) => x.id === p.sesion.armaId);
        const n = todosLosDisparos(p.sesion).length;
        return (
          <Card key={p.sesion.id} onPress={() => router.push(`/sesion/${p.sesion.id}`)} style={st.sesion}>
            <View style={{ flex: 1 }}>
              <Text style={s.text}>{formatear(p.sesion.fecha.slice(0, 10))}</Text>
              <Text style={s.muted}>{a ? `${a.marca} ${a.modelo}` : ''} · {p.sesion.distancia} m</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={st.total}>{totalSesion(p.sesion)} / {n * 10}</Text>
              <Text style={s.muted}>{Math.round(p.agrupacion)} mm</Text>
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}

function cambio(desde: number, hasta: number) {
  return desde === 0 ? 0 : ((hasta - desde) / desde) * 100;
}

/** Recta de mínimos cuadrados: suaviza el ruido de un día bueno o malo. */
function regresion(pts: [number, number][]) {
  const n = pts.length;
  const mx = pts.reduce((t, [x]) => t + x, 0) / (n || 1);
  const my = pts.reduce((t, [, y]) => t + y, 0) / (n || 1);
  const sxx = pts.reduce((t, [x]) => t + (x - mx) ** 2, 0);
  const sxy = pts.reduce((t, [x, y]) => t + (x - mx) * (y - my), 0);
  const pendiente = sxx ? sxy / sxx : 0;
  return { en: (x: number) => my + pendiente * (x - mx) };
}

function Kpi({ titulo, valor, cambio: pct, mejorSiSube }: {
  titulo: string; valor: string; cambio: number; mejorSiSube?: boolean;
}) {
  const bueno = mejorSiSube ? pct >= 0 : pct <= 0;
  return (
    <Card style={{ flex: 1, gap: 4 }}>
      <Text style={[s.muted, { fontSize: 12 }]}>{titulo}</Text>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{valor}</Text>
      <Text style={{ color: bueno ? colors.green : colors.red, fontWeight: '700' }}>
        {pct >= 0 ? '↑' : '↓'} {formatoMedia(Math.abs(pct))} %
      </Text>
    </Card>
  );
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function Grafica({ puntos, tendencia, decimales }: {
  puntos: { x: number; y: number }[];
  tendencia: { en: (x: number) => number };
  decimales: number;
}) {
  const { width } = useWindowDimensions();
  const w = Math.min(width - 4 * space.lg, 400);
  const h = 160;
  const pad = { l: 34, r: 10, t: 12, b: 24 };
  const xs = puntos.map((p) => p.x);
  const ys = puntos.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  // rango mínimo para que las marcas del eje no se repitan cuando hay poca variación
  const rango = Math.max(Math.max(...ys) - Math.min(...ys), decimales ? 0.4 : 6);
  const margen = rango * 0.15;
  const centro = (Math.max(...ys) + Math.min(...ys)) / 2;
  const y0 = centro - rango / 2 - margen, y1 = centro + rango / 2 + margen;
  const X = (x: number) => pad.l + ((x - x0) / (x1 - x0 || 1)) * (w - pad.l - pad.r);
  const Y = (y: number) => pad.t + ((y1 - y) / (y1 - y0)) * (h - pad.t - pad.b);
  const marcasY = [y0 + margen, (y0 + y1) / 2, y1 - margen];
  const hoy = new Date();
  const fecha = (dia: number) => {
    const d = new Date(hoy);
    d.setDate(d.getDate() + dia);
    return `${d.getDate()} ${MESES[d.getMonth()]}`;
  };

  return (
    <Svg width={w} height={h}>
      {marcasY.map((m) => (
        <Line key={`l${m}`} x1={pad.l} x2={w - pad.r} y1={Y(m)} y2={Y(m)} stroke={colors.border} strokeWidth={1} />
      ))}
      {marcasY.map((m) => (
        <SvgText key={`t${m}`} x={pad.l - 6} y={Y(m) + 4} fontSize={10} fill={colors.textMuted} textAnchor="end">
          {m.toFixed(decimales).replace('.', ',')}
        </SvgText>
      ))}
      <Polyline points={puntos.map((p) => `${X(p.x)},${Y(p.y)}`).join(' ')} fill="none" stroke={colors.accent} strokeWidth={2} />
      {puntos.map((p, i) => (
        <Circle key={i} cx={X(p.x)} cy={Y(p.y)} r={3.5} fill={colors.accent} />
      ))}
      {puntos.length > 2 && <Line
        x1={X(x0)} y1={Y(tendencia.en(x0))} x2={X(x1)} y2={Y(tendencia.en(x1))}
        stroke={colors.textMuted} strokeWidth={1.5} strokeDasharray="5 4"
      />}
      <SvgText x={pad.l} y={h - 6} fontSize={10} fill={colors.textMuted}>{fecha(x0)}</SvgText>
      <SvgText x={w - pad.r} y={h - 6} fontSize={10} fill={colors.textMuted} textAnchor="end">{fecha(x1)}</SvgText>
    </Svg>
  );
}

const st = StyleSheet.create({
  fila: { flexDirection: 'row', gap: space.sm },
  sesion: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  total: { color: colors.green, fontSize: 17, fontWeight: '700' },
});

