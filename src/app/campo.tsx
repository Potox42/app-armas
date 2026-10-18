import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Campo } from '@/components/Formulario';
import { useFoto } from '@/components/FotoCampo';
import { Icon } from '@/components/Icon';
import { Badge, Button, Card, FakeQr, Screen, SectionTitle, s } from '@/components/ui';
import { useStore } from '@/data/store';
import type { Arma, ListaCampo } from '@/data/types';
import { licenciaDe, nivelPorDias } from '@/lib/avisos';
import { cosasQueLlevar } from '@/lib/campo';
import { competiciones, cuandoEs, repartir } from '@/lib/competiciones';
import { diasHasta, formatear, plazo } from '@/lib/fechas';
import { estadoMunicion } from '@/lib/municion';
import { colors, radius, space } from '@/theme';

/**
 * «Voy al campo»: todo lo que se enseña en la entrada y en el control (pase, licencia, guías) en una
 * pantalla, con la munición que te queda y la lista de lo que hay que llevar.
 */
export default function VoyAlCampo() {
  const store = useStore();
  const { datos } = store;
  const lista: ListaCampo = store.ajustes.campo ?? { hechos: [] };
  const guardar = (cambios: Partial<ListaCampo>) => store.guardarAjustes({ campo: { ...lista, ...cambios } });

  const cerca = repartir(competiciones(datos)).proximas.find((c) => c.inscrito && diasHasta(c.fecha) <= 1);
  // Las armas elegidas; si no has elegido, la de la competición o la única que tienes.
  const porDefecto = cerca?.armaId ? [cerca.armaId] : datos.armas.length === 1 ? [datos.armas[0].id] : [];
  const elegidas = (lista.armas ?? porDefecto).filter((id) => datos.armas.some((a) => a.id === id));
  const armas = datos.armas.filter((a) => elegidas.includes(a.id));
  const alternar = (id: string) =>
    guardar({ armas: elegidas.includes(id) ? elegidas.filter((x) => x !== id) : [...elegidas, id] });

  const f = datos.federacion;
  const qr = useFoto(f.fotoQr);
  const p = datos.permiso;
  const seguro = (datos.documentos ?? []).find((d) => d.tipo === 'Seguro');

  return (
    <Screen title="Voy al campo" kicker="Para llevar" back="/">
      {cerca && (
        <Card style={{ gap: 2, borderColor: colors.accent }}>
          <Text style={st.kicker}>{cuandoEs(cerca.fecha).toUpperCase()}{cerca.hora ? ` · ${cerca.hora}` : ''}</Text>
          <Text style={s.text}>{cerca.categoria}: {cerca.modalidad}</Text>
          {cerca.lugar ? <Text style={s.muted}>{cerca.lugar}</Text> : null}
        </Card>
      )}

      <SectionTitle>Para entrar</SectionTitle>
      <View style={st.fila}>
        <Card style={st.mitad} onPress={qr || store.esEjemplo ? () => router.push('/pase') : () => router.push('/federacion')}>
          {qr ? <Image source={{ uri: qr }} style={st.qr} resizeMode="contain" /> : store.esEjemplo ? <FakeQr size={96} /> : <Icon name="qr" color={colors.textMuted} size={40} />}
          <Text style={s.text}>Pase</Text>
          <Text style={[s.muted, { fontSize: 12 }]}>{qr || store.esEjemplo ? 'Toca para verlo en grande' : 'Añade la captura del QR'}</Text>
        </Card>
        <Card style={st.mitad}>
          <Icon name="id" color={colors.accent} size={32} />
          <Text style={s.text}>Federado</Text>
          <Text style={[s.muted, { fontSize: 12 }]}>{f.numeroFederado ? `Nº ${f.numeroFederado}` : 'Sin número'}</Text>
          {f.caducidadCarnet ? <Badge nivel={nivelPorDias(diasHasta(f.caducidadCarnet))}>{plazo(f.caducidadCarnet)}</Badge> : null}
        </Card>
      </View>

      <SectionTitle>Licencia de armas</SectionTitle>
      <Card style={{ gap: space.sm }}>
        {p.licencias.length === 0 ? (
          <Text style={s.muted}>Aún no has añadido tu licencia. Hazlo en Cartera.</Text>
        ) : (
          p.licencias.map((l) => (
            <View key={l.id} style={st.linea}>
              <Text style={[s.text, { flex: 1 }]}>Licencia {l.tipo}{l.categoria ? ` (${l.categoria}ª)` : ''}</Text>
              <Badge nivel={nivelPorDias(diasHasta(l.caducidad))}>{plazo(l.caducidad)}</Badge>
            </View>
          ))
        )}
        <Fotos fotos={[[p.fotoAnverso, 'Licencia · anverso'], [p.fotoReverso, 'Licencia · reverso']]} />
      </Card>

      <SectionTitle>Qué arma llevas</SectionTitle>
      {datos.armas.length === 0 && <Card><Text style={s.muted}>Aún no has añadido armas.</Text></Card>}
      <View style={st.chips}>
        {datos.armas.map((a) => {
          const si = elegidas.includes(a.id);
          return (
            <Pressable key={a.id} onPress={() => alternar(a.id)} style={[st.chip, si && st.chipSi]}>
              {si && <Icon name="check" size={14} color="#fff" />}
              <Text style={[st.chipTexto, si && { color: '#fff' }]}>{a.marca} {a.modelo}</Text>
            </Pressable>
          );
        })}
      </View>
      {armas.map((a) => <FichaCampo key={a.id} arma={a} />)}

      {seguro && (
        <Card style={st.linea}>
          <Icon name="shield" color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={s.text}>{seguro.nombre}</Text>
            {seguro.numero ? <Text style={s.muted}>Póliza {seguro.numero}</Text> : null}
          </View>
          {seguro.caducidad ? <Badge nivel={nivelPorDias(diasHasta(seguro.caducidad))}>{plazo(seguro.caducidad)}</Badge> : null}
        </Card>
      )}

      <SectionTitle>Qué llevar</SectionTitle>
      <QueLlevar armas={armas} lista={lista} guardar={guardar} />
    </Screen>
  );
}

/** Guía, licencia de la que depende y munición en casa de un arma. */
function FichaCampo({ arma }: { arma: Arma }) {
  const { datos } = useStore();
  const licencia = licenciaDe(datos, arma);
  const m = estadoMunicion(arma);
  return (
    <Card style={{ gap: space.sm }}>
      <Text style={st.titulo}>{arma.marca} {arma.modelo}</Text>
      <Text style={s.muted}>{arma.tipo} · {arma.calibre} · Guía {arma.numeroGuia || '—'}{arma.fechaGuia ? ` del ${formatear(arma.fechaGuia)}` : ''}</Text>
      <View style={st.linea}>
        <Text style={[s.text, { flex: 1 }]}>{licencia ? `Va con la licencia ${licencia.tipo}` : 'Sin licencia asignada'}</Text>
        {licencia && <Badge nivel={nivelPorDias(diasHasta(licencia.caducidad))}>{plazo(licencia.caducidad)}</Badge>}
      </View>
      <View style={st.linea}>
        <Text style={[s.text, { flex: 1 }]}>Munición en casa</Text>
        <Text style={{ color: m.enCasa > 0 ? colors.text : colors.orange, fontWeight: '800' }}>{m.enCasa} cartuchos</Text>
      </View>
      <Fotos fotos={[[arma.fotoGuiaAnverso, `Guía ${arma.marca} ${arma.modelo} · anverso`], [arma.fotoGuiaReverso, `Guía ${arma.marca} ${arma.modelo} · reverso`]]} />
    </Card>
  );
}

/** Miniaturas de documentos; al tocarlas se ven a pantalla completa. */
function Fotos({ fotos }: { fotos: [string | undefined, string][] }) {
  const hay = fotos.filter(([id]) => id);
  if (!hay.length) return <Text style={[s.muted, { fontSize: 12 }]}>Sin fotos del documento.</Text>;
  return (
    <View style={st.fila}>
      {hay.map(([id, titulo]) => <Miniatura key={id} id={id!} titulo={titulo} />)}
    </View>
  );
}

function Miniatura({ id, titulo }: { id: string; titulo: string }) {
  const uri = useFoto(id);
  return (
    <Pressable style={st.mini} accessibilityLabel={titulo} onPress={() => router.push({ pathname: '/ver-foto', params: { id, titulo } })}>
      {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : null}
    </Pressable>
  );
}

function QueLlevar({ armas, lista, guardar }: { armas: Arma[]; lista: ListaCampo; guardar: (c: Partial<ListaCampo>) => void }) {
  const [nueva, setNueva] = useState('');
  const cosas = cosasQueLlevar(armas, lista);
  const hechos = lista.hechos.filter((x) => cosas.includes(x));
  const marcar = (x: string) => guardar({ hechos: hechos.includes(x) ? hechos.filter((h) => h !== x) : [...hechos, x] });
  const anadir = () => {
    const t = nueva.trim();
    if (!t || cosas.includes(t)) return;
    guardar({ propios: [...(lista.propios ?? []), t] });
    setNueva('');
  };
  const quitar = (x: string) => guardar({ propios: (lista.propios ?? []).filter((p) => p !== x), hechos: hechos.filter((h) => h !== x) });

  return (
    <>
      <Card style={{ paddingVertical: space.xs }}>
        <Text style={[s.muted, { paddingTop: space.sm }]}>
          {hechos.length === cosas.length ? 'Lo tienes todo.' : `Llevas ${hechos.length} de ${cosas.length}.`}
        </Text>
        {cosas.map((x, i) => {
          const si = hechos.includes(x);
          const propio = (lista.propios ?? []).includes(x);
          return (
            <Pressable key={x} onPress={() => marcar(x)} style={[st.cosa, i > 0 && st.cosaBorde]} accessibilityRole="checkbox" accessibilityState={{ checked: si }}>
              <View style={[st.caja, si && st.cajaSi]}>{si && <Icon name="check" size={14} color="#fff" />}</View>
              <Text style={[s.text, { flex: 1 }, si && { color: colors.textMuted, textDecorationLine: 'line-through' }]}>{x}</Text>
              {propio && (
                <Pressable hitSlop={10} onPress={() => quitar(x)} accessibilityLabel={`Quitar ${x}`}>
                  <Icon name="trash" size={16} color={colors.textMuted} />
                </Pressable>
              )}
            </Pressable>
          );
        })}
      </Card>
      <View style={st.linea}>
        <View style={{ flex: 1 }}>
          <Campo etiqueta="Añadir a la lista" valor={nueva} onChange={setNueva} placeholder="Visera, diana de repuesto…" />
        </View>
      </View>
      <Button title="Añadir" variant="secondary" onPress={anadir} />
      {hechos.length > 0 && <Button title="Desmarcar todo (para la próxima vez)" variant="secondary" onPress={() => guardar({ hechos: [] })} />}
    </>
  );
}

const st = StyleSheet.create({
  kicker: { color: colors.kicker, fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  titulo: { color: colors.text, fontSize: 17, fontWeight: '800' },
  fila: { flexDirection: 'row', gap: space.sm },
  mitad: { flex: 1, alignItems: 'center', gap: 6 },
  qr: { width: 110, height: 110, backgroundColor: '#fff', borderRadius: radius.sm },
  linea: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardAlt,
  },
  chipSi: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipTexto: { color: colors.text, fontWeight: '700' },
  mini: { flex: 1, aspectRatio: 1.58, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.cardAlt },
  cosa: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  cosaBorde: { borderTopWidth: 1, borderTopColor: colors.border },
  caja: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  cajaSi: { backgroundColor: colors.green, borderColor: colors.green },
});
