import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Cifra } from '@/components/Cifra';
import { Card, SectionTitle, s } from '@/components/ui';
import type { Arma, Mano, Sesion } from '@/data/types';
import { conclusion } from '@/lib/conclusion';
import { geometria } from '@/lib/diana';
import { anilloDondeCabe, correccion, desplazado, MIN_IMPACTOS, textoCorreccion, type Medidas } from '@/lib/grupo';
import { colors, space } from '@/theme';

/** Qué haces bien, qué corregir y cómo, en palabras sencillas. */
export function Conclusion({ sesion, arma, mano }: { sesion: Sesion; arma?: Arma; mano?: Mano }) {
  const c = conclusion(sesion, arma, mano);
  if (!c.bien.length && !c.mejorar.length) return null;
  return (
    <>
      <SectionTitle>Conclusión</SectionTitle>
      {c.bien.length > 0 && (
        <Card style={[st.bloque, { borderLeftColor: colors.green }]}>
          <Text style={st.titulo}>Lo que haces bien</Text>
          {c.bien.map((t) => (
            <View key={t} style={st.punto}>
              <Text style={[st.marca, { color: colors.green }]}>✓</Text>
              <Text style={[s.text, { flex: 1 }]}>{t}</Text>
            </View>
          ))}
        </Card>
      )}
      {c.mejorar.length > 0 ? (
        <Card style={[st.bloque, { borderLeftColor: colors.orange }]}>
          <Text style={st.titulo}>Lo que tienes que corregir</Text>
          {c.mejorar.map((m, i) => (
            <View key={m.que} style={[st.mejora, i > 0 && st.borde]}>
              {i === 0 && c.mejorar.length > 1 && <Text style={st.primero}>EMPIEZA POR AQUÍ</Text>}
              <View style={st.punto}>
                <Text style={[st.marca, { color: colors.orange }]}>{i + 1}</Text>
                <Text style={[s.text, { flex: 1, fontWeight: '700' }]}>{m.que}</Text>
              </View>
              <Text style={st.linea}><Text style={st.etiqueta}>Por qué pasa: </Text>{m.porque}</Text>
              <Text style={st.linea}><Text style={st.etiqueta}>Qué hacer: </Text>{m.hacer}</Text>
            </View>
          ))}
          <Text style={[s.muted, { fontSize: 12 }]}>
            Son las causas más habituales; tu entrenador puede confirmarlas viéndote tirar.
            {!mano ? ' Se lee como tirador diestro: si eres zurdo, cámbialo en Perfil.' : ''}
          </Text>
        </Card>
      ) : (
        !c.sinPosicion && (
          <Card style={[st.bloque, { borderLeftColor: colors.green }]}>
            <Text style={st.titulo}>Nada que corregir en esta diana</Text>
            <Text style={s.muted}>Sigue así y repite la misma rutina en el próximo entreno.</Text>
          </Card>
        )
      )}
      {c.sinPosicion && (
        <Text style={[s.muted, { fontSize: 13 }]}>
          Para saber dónde y por qué fallas, marca los impactos en la diana (con el dedo, la cámara o la foto). Con el teclado de
          números solo se analizan los puntos.
        </Text>
      )}
    </>
  );
}

/** Medidas del grupo (como en las dianas electrónicas) y cuánto mover las miras para centrarlo. */
export function MedidasGrupo({ sesion, m, arma }: { sesion: Sesion; m: Medidas; arma?: Arma }) {
  if (m.n < MIN_IMPACTOS) {
    return <Text style={[s.muted, { fontSize: 13 }]}>Con {MIN_IMPACTOS} impactos marcados o más verás las medidas del grupo.</Text>;
  }
  const { diana, calibre } = geometria(sesion);
  const anillo = anilloDondeCabe(m.cep50 * 2 + calibre, diana);
  const c = correccion(m.cx, m.cy, sesion.distancia, arma?.clic);
  const mover = desplazado(m, diana);
  return (
    <>
      <View style={st.fila}>
        <Cifra titulo="La mitad cabe en" valor={`Ø ${Math.round(m.cep50 * 2)} mm`} detalle={anillo ? `como el ${anillo} (CEP50)` : 'CEP50'} />
        <Cifra titulo="Separación máx." valor={`${Math.round(m.dispersion)} mm`} detalle="los 2 más lejanos" />
      </View>
      <View style={st.fila}>
        <Cifra titulo="Ancho del grupo" valor={`${Math.round(m.ancho)} mm`} detalle="de izquierda a derecha" />
        <Cifra titulo="Alto del grupo" valor={`${Math.round(m.alto)} mm`} detalle="de arriba abajo" />
      </View>
      <Card style={{ gap: space.sm }}>
        <Text style={st.titulo}>{mover ? 'Para centrar el grupo' : 'Grupo centrado'}</Text>
        {mover ? (
          <>
            {Math.abs(m.cx) >= 2 && <Text style={s.text}>↔ {textoCorreccion(c.horizontal, 'h', arma?.clic)}</Text>}
            {Math.abs(m.cy) >= 2 && <Text style={s.text}>↕ {textoCorreccion(c.vertical, 'v', arma?.clic)}</Text>}
            <Text style={[s.muted, { fontSize: 13 }]}>
              Mueve el alza o la torreta del visor hacia donde quieres llevar los disparos. Hazlo solo si se repite en varios
              entrenos: un día suelto puede ser casualidad.
            </Text>
            {!arma?.clic && arma && (
              <Text style={st.enlace} onPress={() => router.push(`/arma/editar?id=${arma.id}`)}>
                Escribe cuánto mueve cada clic de tus miras y te lo diré en clics
              </Text>
            )}
          </>
        ) : (
          <Text style={s.muted}>
            El centro de impactos está a {Math.round(Math.hypot(m.cx, m.cy))} mm del centro de la diana: no hace falta tocar las miras.
          </Text>
        )}
      </Card>
      <Text style={[s.muted, { fontSize: 12 }]}>
        Cruz azul: centro de impactos. Círculo azul: distancia media al centro ({Math.round(m.radioMedio)} mm). Números naranjas:
        centro de cada serie. Aro naranja: disparo suelto.
      </Text>
    </>
  );
}

const st = StyleSheet.create({
  bloque: { gap: space.sm, borderLeftWidth: 4 },
  titulo: { color: colors.text, fontSize: 16, fontWeight: '800' },
  punto: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  marca: { width: 18, fontWeight: '800', fontSize: 15, textAlign: 'center' },
  mejora: { gap: 4, paddingVertical: space.sm },
  borde: { borderTopWidth: 1, borderTopColor: colors.border },
  primero: { color: colors.orange, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  linea: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginLeft: 26 },
  etiqueta: { color: colors.text, fontWeight: '700' },
  fila: { flexDirection: 'row', gap: space.sm },
  enlace: { color: colors.accent, fontWeight: '700', fontSize: 13 },
});
