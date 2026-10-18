import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { Anillo, Cifra } from '@/components/Cifra';
import { CamaraDiana } from '@/components/CamaraDiana';
import { Diana } from '@/components/Diana';
import { FotoDiana } from '@/components/FotoDiana';
import { GraficaDisparos } from '@/components/GraficaDisparos';
import { Icon } from '@/components/Icon';
import { Button, Card, Screen, SectionTitle, s } from '@/components/ui';
import { useStore } from '@/data/store';
import type { Sesion } from '@/data/types';
import { confirmar } from '@/lib/confirmar';
import { geometria } from '@/lib/diana';
import { formatear } from '@/lib/fechas';
import { volver } from '@/lib/volver';
import { agrupacion, conPosicion, extremos, formatoMedia, media, sumaSerie, todosLosDisparos, totalSesion } from '@/lib/sesiones';
import { colors, radius, space } from '@/theme';

export default function SesionPantalla() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const sesion = store.sesion(id);
  if (!sesion) {
    return <Screen title="Sesión" back="/entrenar"><Text style={s.muted}>No se encuentra esta sesión.</Text></Screen>;
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
  const ultimaSerie = !!sesion.seriesPrevistas && nSerie >= sesion.seriesPrevistas;
  const ultimo = serie.disparos[serie.disparos.length - 1];
  const anteriores = sesion.series.slice(0, -1).flatMap((x) => x.disparos);
  const teclado = sesion.registro === 'teclado';
  const camara = sesion.registro === 'camara';
  const foto = sesion.registro === 'foto';
  const { diana: modelo, calibre } = geometria(sesion);
  const valores = serie.disparos.map((d) => d.valor);
  const { width: ancho, height: alto } = useWindowDimensions();
  const horizontal = ancho > alto && alto < 600;

  const terminar = () => {
    store.terminarSesion(sesion.id);
  };
  const siguiente = () => {
    if (serie.disparos.length === 0) return;
    if (ultimaSerie) terminar();
    else store.nuevaSerie(sesion.id);
  };

  const titulo = `Serie ${nSerie}${sesion.seriesPrevistas ? `/${sesion.seriesPrevistas}` : ''} · Disparo ${Math.min(serie.disparos.length + 1, sesion.disparosPorSerie)}/${sesion.disparosPorSerie}`;
  const kicker = `${sesion.modalidad} · ${sesion.distancia} m${arma ? ` · ${arma.marca} ${arma.modelo}` : ''}`;

  const cifras = (
    <View style={st.datos}>
      <Dato titulo="Último" valor={ultimo ? String(ultimo.valor) : '–'} grande />
      <Dato titulo="Serie" valor={`${sumaSerie(serie)}`} />
      <Dato titulo="Media" valor={serie.disparos.length ? formatoMedia(media(serie.disparos)) : '–'} />
    </View>
  );

  const grafica = (valores.length > 0 || teclado) && (
    <Card style={{ alignItems: 'center', gap: space.xs }}>
      <Text style={[s.muted, { alignSelf: 'flex-start' }]}>Puntuación por disparo · media en verde</Text>
      <GraficaDisparos valores={valores} previstos={sesion.disparosPorSerie} alto={horizontal ? 110 : 150} />
    </Card>
  );

  const tecladoNumeros = (
    <>
      <View style={st.teclado}>
        {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map((v) => (
          <Pressable
            key={v}
            disabled={completa}
            onPress={() => store.anadirValor(sesion.id, v)}
            accessibilityLabel={`Apuntar ${v}`}
            style={({ pressed }) => [st.tecla, v === 10 && st.teclaDiez, v === 0 && st.teclaCero, completa && { opacity: 0.4 }, pressed && { transform: [{ scale: 0.94 }] }]}
          >
            <Text style={[st.teclaTexto, v === 10 && { color: '#fff' }]}>{v === 0 ? 'Fuera' : v}</Text>
          </Pressable>
        ))}
      </View>
      <View style={st.linea}>
        {Array.from({ length: sesion.disparosPorSerie }, (_, i) => {
          const v = valores[i];
          return (
            <View key={i} style={[st.hueco, v !== undefined && st.huecoLleno, i === valores.length - 1 && st.huecoUltimo]}>
              <Text style={st.huecoValor}>{v ?? ''}</Text>
              <Text style={st.huecoNum}>{i + 1}</Text>
            </View>
          );
        })}
      </View>
    </>
  );

  const camaraVista = camara && (
    <CamaraDiana
      activo={!completa}
      horizontal={horizontal}
      modelo={modelo}
      calibre={calibre}
      onImpacto={(x, y) => store.anadirDisparo(sesion.id, x, y)}
    />
  );

  const fotoVista = foto && (
    <FotoDiana
      modelo={modelo}
      calibre={calibre}
      faltan={Math.max(0, sesion.disparosPorSerie - serie.disparos.length)}
      onApuntar={(puntos) => store.anadirDisparos(sesion.id, puntos)}
    />
  );

  const diana = (lado: number) => (
    <>
      <View style={{ alignItems: 'center' }}>
        <Diana
          tamano={lado}
          modelo={modelo}
          calibre={calibre}
          disparos={serie.disparos}
          anteriores={anteriores}
          onToque={completa ? undefined : (x, y) => store.anadirDisparo(sesion.id, x, y)}
        />
      </View>
      <Text style={[s.muted, { textAlign: 'center' }]}>
        {completa
          ? 'Serie completa'
          : camara
            ? 'Si la cámara se salta un disparo, tócalo en la diana; si apunta uno de más, pulsa Deshacer.'
            : foto
              ? 'Los disparos de la foto salen aquí. Si falta alguno, tócalo en la diana; si sobra, pulsa Deshacer.'
              : 'Toca la diana donde ha entrado el disparo'}
      </Text>
    </>
  );

  const botones = (
    <>
      <View style={st.botones}>
        <View style={{ flex: 1 }}>
          <Button title="Deshacer" variant="secondary" onPress={() => store.deshacerDisparo(sesion.id)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title={ultimaSerie ? 'Terminar' : completa ? 'Siguiente serie' : 'Finalizar serie'}
            onPress={siguiente}
          />
        </View>
      </View>
      {!ultimaSerie && <Button title="Terminar entrenamiento" variant="secondary" onPress={terminar} />}
    </>
  );

  // Con el móvil en horizontal (por ejemplo, puesto en el catalejo): la diana o la cámara a la
  // izquierda y los datos a la derecha, todo a la vista sin desplazarse.
  if (horizontal) {
    const ladoDiana = Math.max(160, alto - 110);
    return (
      <Screen title={titulo} kicker={kicker} back="/entrenar" compacto>
        <View style={st.cabina}>
          <View style={{ flex: 1.5, gap: space.sm }}>
            {teclado ? tecladoNumeros : camara ? camaraVista : foto ? fotoVista : diana(ladoDiana)}
          </View>
          <View style={{ flex: 1, gap: space.sm }}>
            {cifras}
            {grafica}
            {botones}
            <BotonBorrar sesion={sesion} />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen title={titulo} kicker={kicker} back="/entrenar">
      {cifras}
      {teclado ? (
        <>
          {grafica}
          {tecladoNumeros}
        </>
      ) : (
        <>
          {camaraVista}
          {fotoVista}
          {diana(tamano)}
          {grafica}
        </>
      )}
      {botones}
      {!teclado && !camara && (
        <Card style={st.camara} onPress={() => store.cambiarRegistro(sesion.id, 'camara')}>
          <Icon name="target" color={colors.accent} />
          <Text style={[s.muted, { flex: 1 }]}>
            ¿Tienes el móvil en el catalejo? Toca aquí y la cámara apuntará cada impacto sola.
          </Text>
        </Card>
      )}
      {!teclado && !foto && (
        <Card style={st.camara} onPress={() => store.cambiarRegistro(sesion.id, 'foto')}>
          <Icon name="doc" color={colors.accent} />
          <Text style={[s.muted, { flex: 1 }]}>
            ¿Tienes la diana en la mano? Toca aquí, hazle una foto y la app cuenta los puntos.
          </Text>
        </Card>
      )}
      <BotonBorrar sesion={sesion} />
    </Screen>
  );
}

/** Borra el entrenamiento (pide confirmación) y vuelve a la lista. */
function BotonBorrar({ sesion }: { sesion: Sesion }) {
  const store = useStore();
  const disparos = todosLosDisparos(sesion).length;
  return (
    <Pressable
      onPress={() =>
        confirmar(
          'Borrar entrenamiento',
          disparos
            ? `Se borrarán sus ${disparos} disparos${sesion.terminada ? ' y se restarán del contador del arma' : ''}. No se puede deshacer.`
            : 'No se puede deshacer.',
          () => {
            router.replace('/entrenar');
            store.borrarSesion(sesion.id);
          },
          'Borrar',
        )
      }
      style={st.borrar}
      accessibilityLabel="Borrar entrenamiento"
    >
      <Icon name="trash" color={colors.red} size={18} />
      <Text style={st.borrarTexto}>Borrar entrenamiento</Text>
    </Pressable>
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
  const conSitio = conPosicion(disparos).length > 0;
  const ex = extremos(sesion);
  // Comparación con la sesión anterior con la misma arma.
  const previa = store.datos.sesiones.find((x) => x.terminada && x.id !== sesion.id && x.armaId === sesion.armaId && x.fecha < sesion.fecha);
  const lectura = resumenSesion(media(disparos), previa ? media(todosLosDisparos(previa)) : undefined, ex.diferencia, sesion.disparosPorSerie);

  return (
    <Screen title="Resultado" back="/entrenar">
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
        {conSitio
          ? <Cifra titulo="Agrupación" valor={`${Math.round(g.radio)} mm`} detalle="radio medio" />
          : <Cifra titulo="Series" valor={String(sumas.length)} detalle={`${sesion.disparosPorSerie} disparos c/u`} />}
      </View>

      <Card style={st.lectura}>
        <Text style={st.lecturaTitulo}>{lectura.titulo}</Text>
        <Text style={s.muted}>{lectura.texto}</Text>
      </Card>

      {sumas.length > 1 && (
        <View style={st.datos}>
          <Cifra titulo="Mejor serie" valor={String(ex.sumas[ex.mejor])} detalle={`serie ${ex.mejor + 1}`} color={colors.green} />
          <Cifra titulo="Peor serie" valor={String(ex.sumas[ex.peor])} detalle={`serie ${ex.peor + 1}`} color={colors.orange} />
          <Cifra titulo="Diferencia" valor={String(ex.diferencia)} detalle="puntos" />
        </View>
      )}

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

      {conSitio && (
        <>
          <SectionTitle>Todos los impactos</SectionTitle>
          <View style={{ alignItems: 'center' }}>
            <Diana tamano={tamano} modelo={geometria(sesion).diana} calibre={geometria(sesion).calibre} disparos={[]} anteriores={disparos} grupo={g} />
          </View>
          <Card style={st.centro}>
            <Icon name="target" color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={s.text}>Centro de impactos</Text>
              <Text style={s.muted}>{consejo(g.cx, g.cy)}</Text>
            </View>
          </Card>
        </>
      )}

      <Button title="Volver a Entrenar" onPress={() => volver('/entrenar')} />
      <BotonBorrar sesion={sesion} />
    </Screen>
  );
}

/** Una frase que resume la sesión: comparación con la anterior y regularidad entre series. */
function resumenSesion(mediaHoy: number, mediaAntes: number | undefined, diferencia: number, porSerie: number) {
  const regular = diferencia <= porSerie * 0.3; // menos de 3 puntos entre series de 10
  const regularidad = regular
    ? 'Has sido muy regular entre series.'
    : `Entre tu mejor y tu peor serie hay ${diferencia} puntos: trabaja la regularidad.`;
  if (mediaAntes === undefined) return { titulo: 'Primera sesión con esta arma', texto: regularidad };
  const cambio = mediaHoy - mediaAntes;
  if (Math.abs(cambio) < 0.05) return { titulo: 'Igual que la última vez', texto: `Misma media que la sesión anterior. ${regularidad}` };
  return cambio > 0
    ? { titulo: `Mejoras ${formatoMedia(cambio)} puntos de media`, texto: `Respecto a la sesión anterior con esta arma. ${regularidad}` }
    : { titulo: `${formatoMedia(-cambio)} puntos por debajo de la última vez`, texto: `Respecto a la sesión anterior con esta arma. ${regularidad}` };
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
  borrar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingVertical: space.md },
  borrarTexto: { color: colors.red, fontWeight: '600' },
  camara: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  cabina: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  teclado: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tecla: {
    flexBasis: '17%', flexGrow: 1, aspectRatio: 1.15, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  teclaDiez: { backgroundColor: colors.accent, borderColor: colors.accent },
  teclaCero: { flexBasis: '100%', aspectRatio: undefined, height: 52 },
  teclaTexto: { color: colors.text, fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
  linea: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  hueco: {
    flexBasis: '8%', flexGrow: 1, alignItems: 'center', paddingVertical: 6, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  huecoLleno: { borderStyle: 'solid', backgroundColor: colors.card },
  huecoUltimo: { borderColor: colors.green },
  huecoValor: { color: colors.text, fontSize: 17, fontWeight: '800', minHeight: 22, fontVariant: ['tabular-nums'] },
  huecoNum: { color: colors.textMuted, fontSize: 10 },
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
  lectura: { gap: 4, borderLeftWidth: 4, borderLeftColor: colors.accent },
  lecturaTitulo: { color: colors.text, fontSize: 16, fontWeight: '800' },
});
