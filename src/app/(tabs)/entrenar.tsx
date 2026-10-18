import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { MiniDiana } from '@/components/Diana';
import { geometria } from '@/lib/diana';
import { Degradado } from '@/components/Degradado';
import { Icon } from '@/components/Icon';
import { Card, Screen, SectionTitle, s } from '@/components/ui';
import { useStore } from '@/data/store';
import { formatear } from '@/lib/fechas';
import { formatoMedia, media, todosLosDisparos, totalSesion } from '@/lib/sesiones';
import { colors, radius, space } from '@/theme';

export default function Entrenar() {
  const { datos, arma } = useStore();
  const enCurso = datos.sesiones.find((x) => !x.terminada);
  const terminadas = datos.sesiones.filter((x) => x.terminada);

  return (
    <Screen title="Entrenar">
      <Pressable
        onPress={() => router.push(enCurso ? `/sesion/${enCurso.id}` : '/sesion/nueva')}
        style={({ pressed }) => [st.nueva, pressed && { opacity: 0.8 }]}
      >
        <Degradado desde={colors.accentLight} hasta={colors.accentDark} brillo="#BFE3FF" />
        <Icon name="target" size={40} />
        <View style={{ flex: 1 }}>
          <Text style={st.nuevaTitulo}>{enCurso ? 'Continuar sesión' : 'Nueva sesión'}</Text>
          <Text style={st.nuevaSub}>{enCurso ? 'Tienes un entrenamiento a medias' : 'Arma, modalidad, distancia y munición'}</Text>
        </View>
        <Icon name="chevron" />
      </Pressable>

      <SectionTitle>Entrenamientos</SectionTitle>
      {terminadas.length === 0 && <Text style={s.muted}>Aún no hay entrenamientos.</Text>}
      {terminadas.map((x) => {
        const a = arma(x.armaId);
        const disparos = todosLosDisparos(x);
        return (
          <Card key={x.id} onPress={() => router.push(`/sesion/${x.id}`)} style={st.fila}>
            <View style={st.mini}><MiniDiana disparos={disparos} tamano={52} modelo={geometria(x).diana} /></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={st.nombre} numberOfLines={1}>{a ? `${a.marca} ${a.modelo}` : 'Arma'} · {x.distancia} m</Text>
              <Text style={s.muted} numberOfLines={1}>{formatear(x.fecha.slice(0, 10))} · {disparos.length} disparos</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={st.total}>{totalSesion(x)}</Text>
              <Text style={s.muted}>media {formatoMedia(media(disparos))}</Text>
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}

const st = StyleSheet.create({
  nueva: {
    backgroundColor: colors.accent, borderRadius: radius.lg, padding: space.lg, overflow: 'hidden', zIndex: 0,
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    shadowColor: colors.accentDark, shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
  },
  nuevaTitulo: { color: '#fff', fontSize: 19, fontWeight: '900' },
  nuevaSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  mini: { borderRadius: 26, overflow: 'hidden' },
  nombre: { color: colors.text, fontSize: 16, fontWeight: '700' },
  total: { color: colors.green, fontSize: 22, fontWeight: '700' },
});
