import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@/components/Icon';
import { Button, Card, Screen, SectionTitle, s } from '@/components/ui';
import { useStore } from '@/data/store';
import type { Competicion } from '@/data/types';
import { competiciones, cuandoEs, historial, participo, repartir, textoResultado } from '@/lib/competiciones';
import { deISO, hoyISO } from '@/lib/fechas';
import { avisosDisponibles } from '@/lib/notificaciones';
import { colors, radius, space } from '@/theme';

const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

/** Calendario de competiciones: las que vienen, con las que te has apuntado destacadas, y las ya pasadas. */
export default function Competiciones() {
  const store = useStore();
  const { proximas, pasadas } = repartir(competiciones(store.datos));
  const nueva = () => router.push('/competicion/editar');
  const anio = hoyISO().slice(0, 4);
  const esteAnio = historial(store.datos).filter((c) => c.fecha.startsWith(anio));
  const puestos = esteAnio.map((c) => c.puesto).filter((p): p is number => p !== undefined);

  return (
    <Screen
      title="Competiciones"
      kicker="Calendario"
      back="/"
      right={
        <Pressable hitSlop={12} accessibilityLabel="Añadir competición" onPress={nueva}>
          <Icon name="plus" color={colors.text} size={22} />
        </Pressable>
      }
    >
      {proximas.length === 0 && (
        <Card style={{ gap: space.sm }}>
          <Text style={s.text}>No tienes competiciones próximas</Text>
          <Text style={s.muted}>
            Mira el calendario de tu federación y añade las que te interesen con su día, hora y tipo. Marca las que te
            apuntes y te avisaré antes.
          </Text>
        </Card>
      )}
      <Button title="+  Añadir competición" onPress={nueva} />

      {proximas.length > 0 && <SectionTitle kicker={`${proximas.length}`}>Próximas</SectionTitle>}
      {proximas.map((c) => (
        <Fila key={c.id} c={c} onApuntar={() => store.guardarCompeticion({ ...c, inscrito: !c.inscrito })} />
      ))}

      {proximas.some((c) => c.inscrito) && (
        <Text style={[s.muted, { fontSize: 13 }]}>
          {avisosDisponibles
            ? 'Te aviso una semana antes, la tarde anterior y 2 horas antes de las que estás apuntado (actívalo en Perfil › Avisos).'
            : 'Las que estás apuntado salen en Inicio dos semanas antes. Para que el iPhone te avise aunque no abras la app, entra en la competición y toca «Añadir al calendario del iPhone».'}
        </Text>
      )}

      {pasadas.length > 0 && <SectionTitle>Pasadas</SectionTitle>}
      {pasadas.length > 0 && (
        <Card style={{ gap: 4 }}>
          <Text style={s.text}>
            {esteAnio.length === 0 ? `En ${anio} aún no has participado en ninguna` : `${esteAnio.length} ${esteAnio.length === 1 ? 'tirada' : 'tiradas'} en ${anio}`}
            {puestos.length ? ` · mejor puesto: ${Math.min(...puestos)}º` : ''}
          </Text>
          <Text style={[s.muted, { fontSize: 13 }]}>Entra en cada una para apuntar si participaste, tus puntos y tu puesto.</Text>
        </Card>
      )}
      {pasadas.map((c) => (
        <Fila key={c.id} c={c} pasada />
      ))}
    </Screen>
  );
}

function Fila({ c, pasada, onApuntar }: { c: Competicion; pasada?: boolean; onApuntar?: () => void }) {
  const d = deISO(c.fecha);
  const tiro = pasada && participo(c);
  const resultado = tiro ? textoResultado(c) : '';
  return (
    <Card onPress={() => router.push({ pathname: '/competicion/editar', params: { id: c.id } })} style={[st.fila, pasada && !tiro && { opacity: 0.6 }]}>
      <View style={[st.dia, c.inscrito && !pasada && st.diaApuntado]}>
        <Text style={st.diaNum}>{d.getDate()}</Text>
        <Text style={st.diaMes}>{MESES[d.getMonth()]}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={st.categoria}>{c.categoria.toUpperCase()}</Text>
        <Text style={st.modalidad} numberOfLines={2}>{c.modalidad}</Text>
        <Text style={s.muted} numberOfLines={1}>
          {pasada ? cuandoEs(c.fecha) : `${cuandoEs(c.fecha)}${c.hora ? ` · ${c.hora}` : ''}`}
          {c.lugar ? ` · ${c.lugar}` : ''}
        </Text>
        {tiro && (
          <Text style={{ color: resultado ? colors.green : colors.accent, fontSize: 13, fontWeight: '700' }}>
            {resultado || 'Añade tu resultado'}
          </Text>
        )}
      </View>
      {!pasada && onApuntar && (
        <Pressable
          onPress={onApuntar}
          hitSlop={8}
          accessibilityLabel={c.inscrito ? 'Quitar apuntado' : 'Me he apuntado'}
          style={[st.apuntar, c.inscrito && st.apuntado]}
        >
          {c.inscrito && <Icon name="check" size={14} color={colors.green} />}
          <Text style={[st.apuntarTexto, c.inscrito && { color: colors.green }]}>{c.inscrito ? 'Apuntado' : 'Apuntarme'}</Text>
        </Pressable>
      )}
      {tiro && <Icon name="check" size={18} color={colors.green} />}
    </Card>
  );
}

const st = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  dia: {
    width: 54, paddingVertical: 8, borderRadius: radius.md, alignItems: 'center',
    backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border,
  },
  diaApuntado: { backgroundColor: colors.greenSoft, borderColor: colors.green },
  diaNum: { color: colors.text, fontSize: 22, fontWeight: '900', lineHeight: 24 },
  diaMes: { color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  categoria: { color: colors.kicker, fontSize: 10, fontWeight: '900', letterSpacing: 1.6 },
  modalidad: { color: colors.text, fontSize: 16, fontWeight: '800' },
  apuntar: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardAlt,
  },
  apuntado: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  apuntarTexto: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
});
