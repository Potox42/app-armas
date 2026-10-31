import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View, type ScrollViewInstance } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { Conclusion, MedidasGrupo } from '@/components/AnalisisDiana';
import { Anillo, Cifra } from '@/components/Cifra';
import { CamaraDiana } from '@/components/CamaraDiana';
import { Diana, MiniDiana } from '@/components/Diana';
import { FotoDiana } from '@/components/FotoDiana';
import { GraficaDisparos } from '@/components/GraficaDisparos';
import { Icon } from '@/components/Icon';
import { Chips } from '@/components/Chips';
import { Button, Card, Screen, SectionTitle, s } from '@/components/ui';
import { useStore } from '@/data/store';
import type { Sesion } from '@/data/types';
import { confirmar } from '@/lib/confirmar';
import { geometria } from '@/lib/diana';
import { centrosSeries, dosGrupos, medidas, sueltos } from '@/lib/grupo';
import { recordsBatidos } from '@/lib/historial';
import { formatear } from '@/lib/fechas';
import { volver } from '@/lib/volver';
import { decir, guardarVoz, leerVoz } from '@/lib/voz';
import { agrupacion, conPosicion, dianasDe, extremos, formatoMedia, media, numDiana, soloDiana, sumaSerie, todosLosDisparos, totalSesion } from '@/lib/sesiones';
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
  // Disparos por serie «libre» (0): sin límite, para tirar 20 o 30 en la misma diana.
  const libre = !sesion.disparosPorSerie;
  const completa = !libre && serie.disparos.length >= sesion.disparosPorSerie;
  const ultimo = serie.disparos[serie.disparos.length - 1];
  // Cada diana es una hoja nueva: solo se ven los disparos de las series anteriores de esta diana.
  const nDiana = numDiana(serie);
  const deEstaDiana = sesion.series.filter((x) => numDiana(x) === nDiana);
  // Con un número de dianas elegido, las series se cuentan dentro de cada diana y, al acabar las
  // de una diana, se pasa a la siguiente. Sin él, las series son de toda la sesión (como antes).
  const dianasPrevistas = sesion.dianasPrevistas;
  const ultimaDiana = !!dianasPrevistas && nDiana + 1 >= dianasPrevistas;
  const serieEnDiana = deEstaDiana.length;
  const finDeDiana = !!dianasPrevistas && !!sesion.seriesPrevistas && serieEnDiana >= sesion.seriesPrevistas;
  const ultimaSerie = dianasPrevistas
    ? finDeDiana && ultimaDiana
    : !!sesion.seriesPrevistas && nSerie >= sesion.seriesPrevistas;
  const pasaDiana = finDeDiana && !ultimaDiana;
  const anteriores = deEstaDiana.slice(0, -1).flatMap((x) => x.disparos);
  const disparosDiana = deEstaDiana.flatMap((x) => x.disparos);
  const dianaVacia = disparosDiana.length === 0;
  const variasDianas = nDiana > 0;
  const teclado = sesion.registro === 'teclado';
  const camara = sesion.registro === 'camara';
  const foto = sesion.registro === 'foto';
  const { diana: modelo, calibre } = geometria(sesion);
  const valores = serie.disparos.map((d) => d.valor);
  const { width: ancho, height: alto } = useWindowDimensions();
  const horizontal = ancho > alto && alto < 600;
  // Al marcar a mano (diana o números), arriba se ve la diana del campo por la cámara del catalejo.
  const [conVisor, setConVisor] = useState(true);
  const visor = conVisor && (teclado || sesion.registro === undefined || sesion.registro === 'diana');

  // Puntuación por voz (opcional): dice el valor de cada disparo nuevo y el total al completar la serie.
  const [voz, setVoz] = useState(leerVoz);
  const cuenta = useRef({ serie: nSerie, n: serie.disparos.length });
  useEffect(() => {
    const antes = cuenta.current;
    cuenta.current = { serie: nSerie, n: serie.disparos.length };
    if (!voz || antes.serie !== nSerie || serie.disparos.length <= antes.n || !ultimo) return;
    const valor = String(ultimo.valor).replace('.', ',');
    decir(completa ? `${valor}. Serie completa: ${String(sumaSerie(serie)).replace('.', ',')} puntos.` : valor);
    // Solo debe sonar cuando cambia el número de disparos, no con cada cambio de la serie.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serie.disparos.length, nSerie]);
  const cambiarVoz = () => {
    const nueva = !voz;
    setVoz(nueva);
    guardarVoz(nueva);
    // En el iPhone, la voz solo arranca tras un toque: se aprovecha este para avisar.
    decir(nueva ? 'Voz activada' : 'Voz desactivada');
  };
  const botonVoz = (
    <Pressable
      onPress={cambiarVoz}
      hitSlop={6}
      accessibilityRole="switch"
      accessibilityState={{ checked: voz }}
      accessibilityLabel="Decir la puntuación en voz alta"
      style={[st.voz, voz && st.vozActiva]}
    >
      <Text style={[st.vozTexto, voz && { color: colors.accent }]}>{voz ? '🔊  Voz activada' : '🔇  Voz apagada'}</Text>
    </Pressable>
  );

  const terminar = () => {
    store.terminarSesion(sesion.id);
  };
  const siguiente = () => {
    if (serie.disparos.length === 0) return;
    if (ultimaSerie) terminar();
    else if (pasaDiana) store.nuevaDiana(sesion.id);
    else store.nuevaSerie(sesion.id);
  };

  const titulo = `Serie ${dianasPrevistas ? serieEnDiana : nSerie}${sesion.seriesPrevistas ? `/${sesion.seriesPrevistas}` : ''} · Disparo ${
    libre ? serie.disparos.length + 1 : `${Math.min(serie.disparos.length + 1, sesion.disparosPorSerie)}/${sesion.disparosPorSerie}`}`;
  const kicker = `Diana ${nDiana + 1}${dianasPrevistas ? `/${dianasPrevistas}` : ''} · ${sesion.modalidad} · ${sesion.distancia} m${arma ? ` · ${arma.marca} ${arma.modelo}` : ''}`;

  // A pantalla completa, la cuenta de la serie va encima de la imagen.
  const marcador = `${titulo}${ultimo ? ` · Último ${ultimo.valor}` : ''} · Serie ${sumaSerie(serie)}`;

  const cifras = (
    <>
      <View style={st.datos}>
        <Dato titulo="Último" valor={ultimo ? String(ultimo.valor) : '–'} grande />
        <Dato titulo="Serie" valor={`${sumaSerie(serie)}`} />
        <Dato titulo="Media" valor={serie.disparos.length ? formatoMedia(media(serie.disparos)) : '–'} />
      </View>
      {botonVoz}
    </>
  );

  const resumenDiana = (variasDianas || !!dianasPrevistas || sesion.series.length > 1) && (
    <Text style={[s.muted, { textAlign: 'center' }]}>
      {dianaVacia
        ? `Diana ${nDiana + 1}${dianasPrevistas ? ` de ${dianasPrevistas}` : ''}: pon la hoja nueva y empieza a tirar.`
        : `Diana ${nDiana + 1}${dianasPrevistas ? ` de ${dianasPrevistas}` : ''}: ${disparosDiana.length} ${disparosDiana.length === 1 ? 'disparo' : 'disparos'} · ${disparosDiana.reduce((t, d) => t + d.valor, 0)} puntos · media ${formatoMedia(media(disparosDiana))}`}
    </Text>
  );

  const grafica = (valores.length > 0 || teclado) && (
    <Card style={{ alignItems: 'center', gap: space.xs }}>
      <Text style={[s.muted, { alignSelf: 'flex-start' }]}>Puntuación por disparo · media en verde</Text>
      <GraficaDisparos valores={valores} previstos={libre ? 10 : sesion.disparosPorSerie} alto={horizontal ? 110 : 150} />
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
        {/* En libre se ven los 10 últimos huecos. */}
        {Array.from({ length: libre ? 10 : sesion.disparosPorSerie }, (_, j) => {
          const i = libre ? Math.max(0, valores.length - 9) + j : j;
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
      key={`camara-${nDiana}`}
      activo={!completa}
      horizontal={horizontal}
      modelo={modelo}
      calibre={calibre}
      disparos={disparosDiana}
      marcador={marcador}
      serie={nSerie}
      onBorrar={(n) => store.borrarDisparo(sesion.id, n)}
      onImpacto={(x, y) => store.anadirDisparo(sesion.id, x, y)}
    />
  );

  const visorVista = (altoVisor: number) => (
    <>
      {/* El visor también busca la diana y los impactos: lo que ve (o lo que se toca en la imagen) pasa
          a la diana de la derecha. */}
      <CamaraDiana
        key={`visor-${nDiana}`}
        soloVer={teclado}
        activo={!completa}
        horizontal={horizontal}
        alto={altoVisor}
        modelo={modelo}
        calibre={calibre}
        disparos={disparosDiana}
        marcador={marcador}
        serie={nSerie}
        onBorrar={(n) => store.borrarDisparo(sesion.id, n)}
        onImpacto={(x, y) => store.anadirDisparo(sesion.id, x, y)}
      />
      <Pressable onPress={() => setConVisor(false)} hitSlop={8}>
        <Text style={st.enlace}>Ocultar el visor</Text>
      </Pressable>
    </>
  );
  const verVisor = !visor && !camara && !foto && (
    <Card style={st.camara} onPress={() => setConVisor(true)}>
      <Icon name="target" color={colors.accent} />
      <Text style={[s.muted, { flex: 1 }]}>Ver el visor del catalejo arriba mientras marcas.</Text>
    </Card>
  );

  const fotoVista = foto && (
    <FotoDiana
      key={`foto-${nDiana}`}
      modelo={modelo}
      calibre={calibre}
      faltan={libre ? 0 : Math.max(0, sesion.disparosPorSerie - serie.disparos.length)}
      anteriores={disparosDiana}
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
          anterioresEnRojo
          onToque={completa ? undefined : (x, y) => store.anadirDisparo(sesion.id, x, y)}
        />
      </View>
      <Text style={[s.muted, { textAlign: 'center' }]}>
        {completa
          ? 'Serie completa'
          : camara
            ? 'Si la cámara se salta un disparo, tócalo en la imagen; si un punto está mal, tócalo y se borra.'
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
            title={ultimaSerie ? 'Terminar' : pasaDiana ? `Siguiente diana (${nDiana + 2}ª)` : completa ? 'Siguiente serie' : 'Finalizar serie'}
            onPress={siguiente}
          />
        </View>
      </View>
      {!ultimaSerie && !dianaVacia && !ultimaDiana && !pasaDiana && (
        <Button title={`Cambiar de diana (empezar la ${nDiana + 2}ª)`} variant="secondary" onPress={() => store.nuevaDiana(sesion.id)} />
      )}
      {ultimaDiana && !ultimaSerie && (
        <Text style={[s.muted, { textAlign: 'center' }]}>Es la última diana: al acabar, pulsa «Terminar sesión».</Text>
      )}
      {!ultimaSerie && <Button title="Terminar sesión" variant="secondary" onPress={terminar} />}
    </>
  );

  // Con el móvil en horizontal (por ejemplo, puesto en el catalejo): la diana o la cámara a la
  // izquierda y los datos a la derecha, todo a la vista sin desplazarse.
  if (horizontal && visor) {
    const ladoDiana = Math.max(160, Math.min(alto - 110, ancho * 0.4 - space.lg));
    return (
      <Screen title={titulo} kicker={kicker} back="/entrenar" compacto>
        <View style={st.cabina}>
          <View style={{ flex: 1.3, gap: space.sm }}>{visorVista(Math.max(140, alto - 110))}</View>
          <View style={{ flex: 1, gap: space.sm }}>
            {teclado ? tecladoNumeros : diana(ladoDiana)}
            {cifras}
            {botones}
            <BotonBorrar sesion={sesion} />
          </View>
        </View>
      </Screen>
    );
  }

  if (horizontal) {
    const ladoDiana = Math.max(160, alto - 110);
    return (
      <Screen title={titulo} kicker={kicker} back="/entrenar" compacto>
        <View style={st.cabina}>
          {/* Con la cámara en el catalejo, la imagen ocupa casi todo: a la derecha solo las cifras y los botones. */}
          <View style={{ flex: camara && !teclado ? 2.2 : 1.5, gap: space.sm }}>
            {teclado ? tecladoNumeros : camara ? camaraVista : foto ? fotoVista : diana(ladoDiana)}
          </View>
          <View style={{ flex: 1, gap: space.sm }}>
            {cifras}
            {!(camara && !teclado) && resumenDiana}
            {!(camara && !teclado) && grafica}
            {botones}
            {verVisor}
            <BotonBorrar sesion={sesion} />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen title={titulo} kicker={kicker} back="/entrenar">
      {visor ? (
        // Pantalla dividida: el visor arriba y, justo debajo, dónde se marca.
        <>
          {visorVista(Math.round(alto * 0.3))}
          {teclado ? tecladoNumeros : diana(Math.min(tamano, Math.round(alto * 0.38)))}
          {cifras}
          {resumenDiana}
          {grafica}
        </>
      ) : null}
      {!visor && cifras}
      {!visor && resumenDiana}
      {visor ? null : teclado ? (
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
      {verVisor}
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
          'Borrar sesión',
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
      accessibilityLabel="Borrar sesión"
    >
      <Icon name="trash" color={colors.red} size={18} />
      <Text style={st.borrarTexto}>Borrar sesión</Text>
    </Pressable>
  );
}

function Resumen({ sesion: completa }: { sesion: Sesion }) {
  const store = useStore();
  const tamano = useTamanoDiana();
  const arma = store.arma(completa.armaId);
  const dianas = dianasDe(completa);
  // Con varias dianas se puede ver la sesión entera o una sola diana: los cálculos son los mismos.
  const [elegida, setElegida] = useState<number | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const verDiana = (n: number) => {
    setElegida(n);
    scroll.current?.scrollTo({ y: 0, animated: true });
  };
  const indice = elegida === null ? -1 : dianas.findIndex((x) => x.n === elegida);
  const sesion = indice < 0 ? completa : soloDiana(completa, elegida!);
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
  // Sesión entera: se compara con la sesión anterior con la misma arma. Una diana: con la diana anterior.
  const previa = store.datos.sesiones.find((x) => x.terminada && x.id !== completa.id && x.armaId === completa.armaId && x.fecha < completa.fecha);
  // En series libres (sin número fijo de disparos), los disparos que ha tenido de media cada serie.
  const porSerie = sesion.disparosPorSerie || Math.max(1, Math.round(disparos.length / Math.max(1, sumas.length)));
  const m = medidas(disparos);
  const conSeries = sesion.series.filter((x) => x.disparos.length);
  const centros = conSeries.length > 1 ? centrosSeries(conSeries).centros : [];
  const fuera = dosGrupos(disparos) ? [] : sueltos(conSeries).map((x) => x.disparo);
  const nuevos = indice < 0 ? recordsBatidos(completa, store.datos.sesiones) : [];
  const lectura = indice < 0
    ? resumenSesion(media(disparos), previa ? media(todosLosDisparos(previa)) : undefined, ex.diferencia, porSerie)
    : resumenDiana(indice, media(disparos), indice > 0 ? media(dianas[indice - 1].disparos) : undefined, ex.diferencia, porSerie);

  return (
    <Screen title="Resultado" back="/entrenar" scrollRef={scroll}>
      {dianas.length > 1 && (
        <Chips
          opciones={[{ value: 'todas', label: 'Toda la sesión' }, ...dianas.map((d, i) => ({ value: String(d.n), label: `Diana ${i + 1}` }))]}
          valor={elegida === null ? 'todas' : String(elegida)}
          onChange={(v) => setElegida(v === 'todas' ? null : Number(v))}
        />
      )}
      <View style={st.hero}>
        <Anillo valor={total} maximo={maximo} tamano={170} grosor={14} color={colors.green}>
          <Text style={st.total}>{total}</Text>
          <Text style={s.muted}>de {maximo}</Text>
        </Anillo>
        <Text style={st.heroArma}>{indice >= 0 ? `Diana ${indice + 1} de ${dianas.length}` : arma ? `${arma.marca} ${arma.modelo}` : 'Arma'}</Text>
        <Text style={[s.muted, { textAlign: 'center' }]}>
          {formatear(sesion.fecha.slice(0, 10))} · {sesion.fecha.slice(11, 16)} · {sesion.modalidad} · {sesion.distancia} m
          {dianas.length > 1 && indice < 0 ? ` · ${dianas.length} dianas` : ''}{completa.competicion ? ' · Competición' : ''}
          {sesion.municion ? `\n${sesion.municion}` : ''}
        </Text>
      </View>

      <View style={st.datos}>
        <Cifra titulo="Media" valor={formatoMedia(media(disparos))} color={colors.green} />
        <Cifra titulo="Dieces" valor={String(reparto[0].n)} detalle={`de ${disparos.length}`} />
        {conSitio
          ? <Cifra titulo="Agrupación" valor={`${Math.round(g.radio)} mm`} detalle="radio medio" />
          : <Cifra titulo="Series" valor={String(sumas.length)} detalle={sesion.disparosPorSerie ? `${sesion.disparosPorSerie} disparos c/u` : 'disparos libres'} />}
      </View>

      {nuevos.length > 0 && (
        <Card style={[st.lectura, { borderLeftColor: colors.green }]}>
          <Text style={st.lecturaTitulo}>🏆 {nuevos.length === 1 ? '¡Nuevo récord!' : `¡${nuevos.length} récords nuevos!`}</Text>
          {nuevos.map((r) => <Text key={r} style={s.muted}>{r}</Text>)}
        </Card>
      )}

      <Card style={st.lectura}>
        <Text style={st.lecturaTitulo}>{lectura.titulo}</Text>
        <Text style={s.muted}>{lectura.texto}</Text>
      </Card>

      <Conclusion sesion={sesion} arma={arma} mano={store.datos.mano} />

      {indice < 0 && arma && disparos.length > 0 && <GastoMunicion sesion={completa} n={disparos.length} />}

      {indice < 0 && dianas.length > 1 && <EvolucionDianas sesion={completa} onElegir={verDiana} />}

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
      {sumas.length > 1 && <Card><GraficaSeries valores={sumas} maximo={sesion.disparosPorSerie ? sesion.disparosPorSerie * 10 : Math.ceil(Math.max(...sumas) / 10) * 10} /></Card>}

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
          <SectionTitle>{indice < 0 ? 'Todos los impactos' : `Impactos de la diana ${indice + 1}`}</SectionTitle>
          <View style={{ alignItems: 'center' }}>
            <Diana
              tamano={tamano} modelo={geometria(sesion).diana} calibre={geometria(sesion).calibre} disparos={[]} anteriores={disparos} grupo={g}
              centros={centros.map((c) => ({ x: c.x, y: c.y, etiqueta: String(c.serie + 1) }))} sueltos={fuera}
            />
          </View>
          {m && <MedidasGrupo sesion={sesion} m={m} arma={arma} />}
        </>
      )}

      <Pressable onPress={() => store.marcarCompeticion(completa.id, !completa.competicion)} style={st.borrar} hitSlop={8}>
        <Text style={st.enlace}>{completa.competicion ? 'Es una competición · cambiar a entreno' : 'Marcar como competición'}</Text>
      </Pressable>
      <Button title="Volver a Entrenar" onPress={() => volver('/entrenar')} />
      <BotonBorrar sesion={completa} />
    </Screen>
  );
}

/** Cómo han ido las dianas del día una tras otra: media, agrupación y una frase con la tendencia. */
function EvolucionDianas({ sesion, onElegir }: { sesion: Sesion; onElegir: (n: number) => void }) {
  const dianas = dianasDe(sesion).map((d) => {
    const conSitio = conPosicion(d.disparos).length > 0;
    return { ...d, media: media(d.disparos), puntos: d.disparos.reduce((t, x) => t + x.valor, 0), radio: conSitio ? agrupacion(d.disparos).radio : undefined };
  });
  const medias = dianas.map((d) => d.media);
  const mejor = medias.indexOf(Math.max(...medias));
  const cambio = medias[medias.length - 1] - medias[0];
  const radios = dianas.map((d) => d.radio);
  const primerR = radios[0], ultimoR = radios[radios.length - 1];
  const tendencia = Math.abs(cambio) < 0.1
    ? 'Has mantenido la misma media de la primera a la última diana.'
    : cambio > 0
      ? `De la primera a la última diana subes ${formatoMedia(cambio)} puntos de media por disparo.`
      : `De la primera a la última diana bajas ${formatoMedia(-cambio)} puntos de media por disparo: puede ser cansancio, prueba a descansar entre dianas.`;
  const grupo = primerR !== undefined && ultimoR !== undefined && Math.abs(ultimoR - primerR) >= 2
    ? ` El grupo ${ultimoR < primerR ? 'se cierra' : 'se abre'} de ${Math.round(primerR)} a ${Math.round(ultimoR)} mm.`
    : '';
  const modelo = geometria(sesion).diana;
  return (
    <>
      <SectionTitle>Evolución de las dianas</SectionTitle>
      <Card style={st.lectura}>
        <Text style={st.lecturaTitulo}>La mejor, la diana {mejor + 1} (media {formatoMedia(medias[mejor])})</Text>
        <Text style={s.muted}>{tendencia}{grupo}</Text>
      </Card>
      <Card>
        <GraficaSeries
          valores={medias}
          maximo={10}
          minimo={Math.max(0, Math.floor(Math.min(...medias) - 1))}
          texto={formatoMedia}
          etiqueta={(i) => `D${i + 1}`}
        />
        <Text style={[s.muted, { fontSize: 12, textAlign: 'center' }]}>Media por disparo en cada diana</Text>
      </Card>
      {dianas.map((d, i) => (
        <Card key={d.n} onPress={() => onElegir(d.n)} style={st.filaDiana}>
          <View style={st.mini}><MiniDiana disparos={d.disparos} tamano={48} modelo={modelo} /></View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={st.titulo}>Diana {i + 1}</Text>
            <Text style={s.muted}>
              {d.disparos.length} disparos · {d.series.length} {d.series.length === 1 ? 'serie' : 'series'}
              {d.radio !== undefined ? ` · grupo ${Math.round(d.radio)} mm` : ''}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[st.puntosDiana, i === mejor && { color: colors.green }]}>{d.puntos}</Text>
            <Text style={s.muted}>media {formatoMedia(d.media)}</Text>
          </View>
          <Icon name="chevron" color={colors.textMuted} />
        </Card>
      ))}
    </>
  );
}

/**
 * Al terminar: ¿los cartuchos salieron de casa? Si dices que sí, se apunta el gasto en la munición
 * del arma (y baja lo que tienes en casa). Nada se resta sin que lo confirmes.
 */
function GastoMunicion({ sesion, n }: { sesion: Sesion; n: number }) {
  const store = useStore();
  const cartuchos = n === 1 ? '1 cartucho' : `${n} cartuchos`;
  if (sesion.gasto) {
    return (
      <Card style={st.gasto}>
        <Icon name="box" color={sesion.gasto === 'casa' ? colors.green : colors.textMuted} />
        <Text style={[s.muted, { flex: 1 }]}>
          {sesion.gasto === 'casa' ? `Restados ${cartuchos} de la munición de casa.` : 'No se ha restado munición de casa.'}
        </Text>
        <Pressable hitSlop={10} onPress={() => store.apuntarGasto(sesion.id, sesion.gasto !== 'casa')}>
          <Text style={{ color: colors.accent, fontWeight: '700' }}>{sesion.gasto === 'casa' ? 'Deshacer' : 'Restar'}</Text>
        </Pressable>
      </Card>
    );
  }
  return (
    <Card style={{ gap: space.md, borderColor: colors.accent }}>
      <View style={st.gasto}>
        <Icon name="box" color={colors.accent} />
        <Text style={[s.text, { flex: 1 }]}>Has disparado {cartuchos}. ¿Salieron de la munición que tienes en casa?</Text>
      </View>
      <View style={st.botones}>
        <View style={{ flex: 1 }}>
          <Button title="No, del club" variant="secondary" onPress={() => store.apuntarGasto(sesion.id, false)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title={`Restar ${n}`} onPress={() => store.apuntarGasto(sesion.id, true)} />
        </View>
      </View>
    </Card>
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

/** Una frase para una diana: comparación con la diana anterior de la misma sesión. */
function resumenDiana(i: number, mediaHoy: number, mediaAntes: number | undefined, diferencia: number, porSerie: number) {
  const { texto } = resumenSesion(mediaHoy, undefined, diferencia, porSerie);
  if (mediaAntes === undefined) return { titulo: 'Primera diana de la sesión', texto };
  const cambio = mediaHoy - mediaAntes;
  if (Math.abs(cambio) < 0.05) return { titulo: 'Igual que la diana anterior', texto };
  return cambio > 0
    ? { titulo: `${formatoMedia(cambio)} puntos de media más que la diana ${i}`, texto }
    : { titulo: `${formatoMedia(-cambio)} puntos de media menos que la diana ${i}`, texto };
}

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

/** Línea con un punto por serie (o por diana) y su valor encima. */
function GraficaSeries({ valores: sumas, maximo, minimo: min, texto = String, etiqueta = (i) => String(i + 1) }: {
  valores: number[];
  maximo: number;
  minimo?: number;
  texto?: (v: number) => string;
  etiqueta?: (i: number) => string;
}) {
  const { width } = useWindowDimensions();
  const w = Math.min(width - 4 * space.lg, 400);
  const h = 140;
  const pad = { l: 30, r: 12, t: 22, b: 22 };
  const minimo = min ?? Math.max(0, Math.floor((Math.min(...sumas) - 5) / 10) * 10);
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
        <SvgText key={`t${i}`} x={x(i)} y={y(v) - 8} fontSize={11} fontWeight="600" fill={colors.text} textAnchor="middle">{texto(v)}</SvgText>
      ))}
      {sumas.map((_, i) => (
        <SvgText key={`s${i}`} x={x(i)} y={h - 6} fontSize={10} fill={colors.textMuted} textAnchor="middle">{etiqueta(i)}</SvgText>
      ))}
    </Svg>
  );
}

const st = StyleSheet.create({
  voz: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.cardAlt },
  vozActiva: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  vozTexto: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  datos: { flexDirection: 'row', gap: space.sm },
  botones: { flexDirection: 'row', gap: space.sm },
  borrar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingVertical: space.md },
  borrarTexto: { color: colors.red, fontWeight: '600' },
  camara: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  enlace: { color: colors.accent, fontWeight: '700', textAlign: 'center', fontSize: 13 },
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
  gasto: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  lectura: { gap: 4, borderLeftWidth: 4, borderLeftColor: colors.accent },
  lecturaTitulo: { color: colors.text, fontSize: 16, fontWeight: '800' },
  filaDiana: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  mini: { borderRadius: 24, overflow: 'hidden' },
  puntosDiana: { color: colors.text, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
