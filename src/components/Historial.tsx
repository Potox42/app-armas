import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Chips } from '@/components/Chips';
import { MiniDiana } from '@/components/Diana';
import { Icon } from '@/components/Icon';
import { Button, Card, Segmented, SectionTitle, s } from '@/components/ui';
import type { Arma, Mano, Modalidad, Sesion } from '@/data/types';
import { compartirArchivo } from '@/lib/archivo';
import { geometria } from '@/lib/diana';
import { formatear } from '@/lib/fechas';
import {
  aCsv, comparar, fallosRepetidos, horaDe, nombreDia, nombreMes, opcionesFiltro, porDia, porMes, records, type Filtro, type Periodo,
} from '@/lib/historial';
import { dianasDe, formatoMedia, media, todosLosDisparos, totalSesion } from '@/lib/sesiones';
import { colors, space } from '@/theme';

/** Filtros por distancia, modalidad, munición y entreno/competición. Solo salen los que tienen más de una opción. */
export function Filtros({ sesiones, filtro, onChange }: { sesiones: Sesion[]; filtro: Filtro; onChange: (f: Filtro) => void }) {
  const o = opcionesFiltro(sesiones);
  const [abierto, setAbierto] = useState(false);
  const activos = Object.values(filtro).filter((v) => v !== undefined).length;
  const hay = o.distancias.length > 1 || o.modalidades.length > 1 || o.municiones.length > 1 || o.competiciones;
  if (!hay) return null;
  const fila = <T extends string>(titulo: string, valor: T | undefined, opciones: { value: T; label: string }[], poner: (v: T | undefined) => void) => (
    <View style={{ gap: 6 }}>
      <Text style={st.etiqueta}>{titulo}</Text>
      <Chips opciones={[{ value: '' as T, label: 'Todas' }, ...opciones]} valor={valor ?? ('' as T)} onChange={(v) => poner(v || undefined)} />
    </View>
  );
  return (
    <Card style={{ gap: space.md }}>
      <Pressable onPress={() => setAbierto(!abierto)} style={st.cabecera} hitSlop={8}>
        <Icon name="filter" size={18} color={colors.accent} />
        <Text style={[s.text, { flex: 1, fontWeight: '700' }]}>Filtrar{activos ? ` (${activos})` : ''}</Text>
        {activos > 0 && <Text style={st.enlace} onPress={() => onChange({})}>Quitar</Text>}
        <View style={{ transform: [{ rotate: abierto ? '90deg' : '0deg' }] }}><Icon name="chevron" color={colors.textMuted} /></View>
      </Pressable>
      {abierto && (
        <>
          {o.distancias.length > 1 && fila('Distancia', filtro.distancia === undefined ? undefined : String(filtro.distancia),
            o.distancias.map((d) => ({ value: String(d), label: `${d} m` })), (v) => onChange({ ...filtro, distancia: v ? Number(v) : undefined }))}
          {o.modalidades.length > 1 && fila<Modalidad>('Modalidad', filtro.modalidad,
            o.modalidades.map((m) => ({ value: m, label: m })), (v) => onChange({ ...filtro, modalidad: v }))}
          {o.municiones.length > 1 && fila('Munición', filtro.municion,
            o.municiones.map((m) => ({ value: m.clave, label: m.nombre })), (v) => onChange({ ...filtro, municion: v }))}
          {o.competiciones && fila<'entreno' | 'competicion'>('Tipo', filtro.tipo,
            [{ value: 'entreno', label: 'Entrenos' }, { value: 'competicion', label: 'Competiciones' }], (v) => onChange({ ...filtro, tipo: v }))}
        </>
      )}
    </Card>
  );
}

/** Los fallos que más se repiten y si van a menos: el plan para el próximo entreno. */
export function FallosRepetidos({ sesiones, armas, mano }: { sesiones: Sesion[]; armas: Arma[]; mano?: Mano }) {
  const { entrenos, conSitio, fallos } = fallosRepetidos(sesiones, armas, mano);
  if (entrenos < 3) return null;
  const top = fallos.slice(0, 5);
  const principal = fallos[0];
  return (
    <>
      <SectionTitle>Tus fallos más repetidos</SectionTitle>
      <Card style={{ gap: space.sm }}>
        <Text style={[s.muted, { fontSize: 13 }]}>
          En tus últimos {entrenos} entrenamientos{conSitio < entrenos ? ` (${conSitio} con los impactos marcados en la diana)` : ''}.
        </Text>
        {top.length === 0 ? (
          <Text style={s.text}>No se repite ningún fallo. Sigue con la misma rutina.</Text>
        ) : top.map((f) => {
          const tendencia = f.recientes === undefined || f.anteriores === undefined || f.recientes === f.anteriores ? null
            : f.recientes < f.anteriores ? { texto: 'va a menos', color: colors.green } : { texto: 'va a más', color: colors.red };
          return (
            <View key={f.tipo} style={{ gap: 4 }}>
              <View style={st.cabecera}>
                <Text style={[s.text, { flex: 1 }]}>{f.nombre}</Text>
                <Text style={st.veces}>{f.veces} de {entrenos}</Text>
              </View>
              <View style={st.barraFondo}><View style={[st.barra, { width: `${(f.veces / entrenos) * 100}%` }]} /></View>
              {tendencia && <Text style={{ color: tendencia.color, fontSize: 12, fontWeight: '700' }}>{tendencia.texto}</Text>}
            </View>
          );
        })}
      </Card>
      {principal && principal.veces >= 2 && (
        <Card style={[st.plan, { gap: 4 }]}>
          <Text style={st.planTitulo}>Para tu próximo entreno</Text>
          <Text style={[s.text, { fontWeight: '700' }]}>{principal.nombre}</Text>
          <Text style={s.muted}>{principal.hacer}</Text>
        </Card>
      )}
    </>
  );
}

/** Récords del arma por distancia. Al tocarlos se abre el entrenamiento. */
export function Records({ sesiones }: { sesiones: Sesion[] }) {
  const lista = records(sesiones).filter((r) => r.media || r.serie || r.grupo);
  if (!lista.length) return null;
  const fila = (titulo: string, valor: string, sesion: Sesion, detalle?: string) => (
    <Pressable key={titulo} onPress={() => router.push(`/sesion/${sesion.id}`)} style={st.record}>
      <Text style={[s.muted, { flex: 1 }]}>{titulo}</Text>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={st.recordValor}>{valor}{detalle ? <Text style={[s.muted, { fontSize: 12 }]}> {detalle}</Text> : null}</Text>
        <Text style={[s.muted, { fontSize: 11 }]}>{formatear(sesion.fecha.slice(0, 10))}</Text>
      </View>
    </Pressable>
  );
  return (
    <>
      <SectionTitle>Tus récords</SectionTitle>
      {lista.map((r) => (
        <Card key={r.distancia} style={{ gap: 2 }}>
          {lista.length > 1 && <Text style={[s.text, { fontWeight: '800' }]}>A {r.distancia} m</Text>}
          {r.media && fila('Mejor media', formatoMedia(r.media.valor), r.media.sesion, r.media.detalle)}
          {r.serie && fila('Mejor serie', String(r.serie.valor), r.serie.sesion, r.serie.detalle)}
          {r.grupo && fila('Grupo más cerrado', `${Math.round(r.grupo.valor)} mm`, r.grupo.sesion)}
        </Card>
      ))}
    </>
  );
}

/** Este mes, trimestre o año frente al anterior. */
export function Comparar({ sesiones }: { sesiones: Sesion[] }) {
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const { actual, anterior, nombres } = comparar(sesiones, periodo);
  const dato = (titulo: string, a: number | null, b: number | null, texto: (n: number) => string, mejorSiSube: boolean) => {
    const bruto = a !== null && b !== null ? a - b : null;
    // Un cambio que no se ve al redondear cuenta como «igual».
    const dif = bruto !== null && texto(Math.abs(bruto)) === texto(0) ? 0 : bruto;
    const bueno = dif !== null && (mejorSiSube ? dif > 0 : dif < 0);
    return (
      <View style={st.compFila} key={titulo}>
        <Text style={[s.muted, { flex: 1.2 }]}>{titulo}</Text>
        <Text style={st.compValor}>{a !== null ? texto(a) : '—'}</Text>
        <Text style={[st.compValor, { color: colors.textMuted }]}>{b !== null ? texto(b) : '—'}</Text>
        <Text style={[st.compDif, { color: dif === null || Math.abs(dif) < 1e-9 ? colors.textMuted : bueno ? colors.green : colors.red }]}>
          {dif === null ? '' : dif === 0 ? '=' : `${dif > 0 ? '+' : '−'}${texto(Math.abs(dif))}`}
        </Text>
      </View>
    );
  };
  return (
    <>
      <SectionTitle>Comparar</SectionTitle>
      <Card style={{ gap: space.sm }}>
        <Segmented value={periodo} onChange={setPeriodo} options={[{ value: 'mes', label: 'Mes' }, { value: 'trimestre', label: 'Trimestre' }, { value: 'año', label: 'Año' }]} />
        <View style={st.compFila}>
          <Text style={{ flex: 1.2 }} />
          <Text style={[st.compCab]}>{nombres[0]}</Text>
          <Text style={[st.compCab]}>{nombres[1]}</Text>
          <Text style={[st.compDif, { color: colors.textMuted, fontSize: 11 }]}>Cambio</Text>
        </View>
        {dato('Entrenos', actual.entrenos, anterior.entrenos, (n) => String(Math.round(n)), true)}
        {dato('Disparos', actual.disparos, anterior.disparos, (n) => String(Math.round(n)), true)}
        {dato('Media', actual.media, anterior.media, formatoMedia, true)}
        {dato('Grupo (mm)', actual.grupo, anterior.grupo, (n) => String(Math.round(n)), false)}
        <Text style={[s.muted, { fontSize: 12 }]}>
          {actual.entrenos === 0
            ? `Aún no hay entrenamientos ${nombres[0].toLowerCase()}.`
            : 'Verde: mejor que el periodo anterior. Grupo: radio medio, cuanto menos mejor.'}
        </Text>
      </Card>
    </>
  );
}

/** Lista de entrenamientos agrupados por día y, si hay muchos, en carpetas por mes. La más reciente, abierta. */
export function ListaPorMes({ sesiones, abrirPrimero = true }: { sesiones: Sesion[]; abrirPrimero?: boolean }) {
  const meses = porMes(sesiones);
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set(abrirPrimero && meses[0] ? [meses[0].mes] : []));
  const cambiar = (mes: string) => setAbiertos((a) => {
    const n = new Set(a);
    if (n.has(mes)) n.delete(mes);
    else n.add(mes);
    return n;
  });
  // Pocos entrenamientos: sin carpetas, solo por días.
  if (sesiones.length <= 8) return <ListaPorDia sesiones={sesiones} />;
  return (
    <>
      {meses.map((m) => (
        <View key={m.mes} style={{ gap: space.sm }}>
          <Card onPress={() => cambiar(m.mes)} style={st.mes}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[s.text, { fontWeight: '700', textTransform: 'capitalize' }]}>{nombreMes(m.mes)}</Text>
              <Text style={s.muted}>
                {m.sesiones.length === 1 ? '1 entreno' : `${m.sesiones.length} entrenos`} · {m.disparos} disparos{m.grupo !== null ? ` · grupo ${Math.round(m.grupo)} mm` : ''}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={st.media}>{formatoMedia(m.media)}</Text>
              <Text style={s.muted}>media</Text>
            </View>
            <View style={{ transform: [{ rotate: abiertos.has(m.mes) ? '90deg' : '0deg' }] }}><Icon name="chevron" color={colors.textMuted} /></View>
          </Card>
          {abiertos.has(m.mes) && <ListaPorDia sesiones={m.sesiones} dentro />}
        </View>
      ))}
    </>
  );
}

/** Entrenamientos bajo el nombre de su día («Sábado 31 de octubre · 3 entrenos · media 9,1»). */
function ListaPorDia({ sesiones, dentro }: { sesiones: Sesion[]; dentro?: boolean }) {
  return (
    <>
      {porDia(sesiones).map((d) => (
        <View key={d.dia} style={[{ gap: space.sm }, dentro && st.dentro]}>
          <View style={st.dia}>
            <Text style={st.diaNombre} numberOfLines={1}>{nombreDia(d.dia)}</Text>
            <Text style={s.muted} numberOfLines={1}>
              {d.sesiones.length > 1 ? `${d.sesiones.length} entrenos · ` : ''}media {formatoMedia(d.media)}
            </Text>
          </View>
          {d.sesiones.map((x) => <FilaSesion key={x.id} sesion={x} />)}
        </View>
      ))}
    </>
  );
}

function FilaSesion({ sesion: x }: { sesion: Sesion }) {
  const d = todosLosDisparos(x);
  const nDianas = dianasDe(x).length;
  const hora = horaDe(x.fecha);
  return (
    <Card onPress={() => router.push(`/sesion/${x.id}`)} style={st.fila}>
      <View style={st.mini}><MiniDiana disparos={d} tamano={52} modelo={geometria(x).diana} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={st.nombre} numberOfLines={1}>{hora ? `${hora} · ` : ''}{x.distancia} m{x.competicion ? ' · 🏆' : ''}</Text>
        <Text style={s.muted} numberOfLines={1}>{nDianas > 1 ? `${nDianas} dianas · ` : ''}{d.length} disparos</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={st.total}>{totalSesion(x)}</Text>
        <Text style={s.muted}>media {formatoMedia(media(d))}</Text>
      </View>
    </Card>
  );
}

/** Descarga los entrenamientos (los que se ven con los filtros) en un archivo que abre Excel. */
export function ExportarCsv({ sesiones, armas, nombre }: { sesiones: Sesion[]; armas: Arma[]; nombre: string }) {
  const [hecho, setHecho] = useState(false);
  if (!sesiones.length) return null;
  return (
    <View style={{ gap: space.sm }}>
      <Button
        title={`Exportar ${sesiones.length === 1 ? '1 entreno' : `${sesiones.length} entrenos`} a Excel`}
        variant="secondary"
        onPress={() => {
          const hoy = new Date().toISOString().slice(0, 10);
          compartirArchivo(`entrenos-${nombre}-${hoy}.csv`.replace(/[^\w.-]+/g, '-'), aCsv(sesiones, armas))
            .then(() => setHecho(true)).catch(() => {});
        }}
      />
      <Text style={[s.muted, { fontSize: 12, textAlign: 'center' }]}>
        {hecho ? 'Archivo creado: ábrelo con Excel o Numbers.' : 'Un archivo .csv con una fila por entrenamiento (fecha, puntos, media, grupo…).'}
      </Text>
    </View>
  );
}

const st = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  etiqueta: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  enlace: { color: colors.accent, fontWeight: '700' },
  veces: { color: colors.text, fontWeight: '800', fontVariant: ['tabular-nums'] },
  barraFondo: { height: 8, borderRadius: 4, backgroundColor: colors.cardAlt, overflow: 'hidden' },
  barra: { height: '100%', borderRadius: 4, backgroundColor: colors.orange },
  plan: { borderLeftWidth: 4, borderLeftColor: colors.accent },
  planTitulo: { color: colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  record: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  recordValor: { color: colors.green, fontSize: 18, fontWeight: '800' },
  compFila: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  compCab: { flex: 1, color: colors.textMuted, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  compValor: { flex: 1, color: colors.text, fontWeight: '700', textAlign: 'right', fontVariant: ['tabular-nums'] },
  compDif: { flex: 0.9, fontWeight: '700', textAlign: 'right', fontVariant: ['tabular-nums'] },
  mes: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  dentro: { marginLeft: space.lg },
  dia: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.sm, marginTop: space.sm, paddingHorizontal: 2 },
  diaNombre: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '800' },
  mini: { borderRadius: 26, overflow: 'hidden' },
  nombre: { color: colors.text, fontSize: 16, fontWeight: '700' },
  media: { color: colors.green, fontSize: 18, fontWeight: '800' },
  total: { color: colors.green, fontSize: 22, fontWeight: '700' },
});
