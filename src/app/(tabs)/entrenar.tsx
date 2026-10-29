import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useLicenciaApp } from '@/components/Activacion';
import { Degradado } from '@/components/Degradado';
import { ListaPorMes } from '@/components/Historial';
import { Icon } from '@/components/Icon';
import { Card, Screen, SectionTitle, s } from '@/components/ui';
import { useStore } from '@/data/store';
import { formatear } from '@/lib/fechas';
import { formatoMedia, media, todosLosDisparos } from '@/lib/sesiones';
import { colors, radius, space } from '@/theme';

export default function Entrenar() {
  const { datos, arma } = useStore();
  const { esPro } = useLicenciaApp();
  const enCurso = datos.sesiones.find((x) => !x.terminada);
  const terminadas = datos.sesiones.filter((x) => x.terminada);
  // Carpeta abierta: al principio, la del arma con la que entrenaste por última vez.
  const [abierta, setAbierta] = useState<string | null>(terminadas[0]?.armaId ?? null);
  // Agrupadas por arma; primero el arma con la que entrenaste por última vez.
  const porArma: { armaId: string; sesiones: typeof terminadas }[] = [];
  for (const x of terminadas) {
    const g = porArma.find((p) => p.armaId === x.armaId);
    if (g) g.sesiones.push(x);
    else porArma.push({ armaId: x.armaId, sesiones: [x] });
  }

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
          <Text style={st.nuevaSub}>{enCurso ? 'Tienes una sesión a medias' : 'Todas las dianas que tires hoy, en una sesión'}</Text>
        </View>
        <Icon name="chevron" />
      </Pressable>

      {/* Otra forma de entrenar: tan visible como «Nueva sesión», con los colores de sus luces. */}
      <Pressable
        onPress={() => router.push('/simulador')}
        style={({ pressed }) => [st.nueva, st.simulador, pressed && { opacity: 0.8 }]}
        accessibilityLabel="Simulador de tirada"
      >
        <Degradado desde="#1F9D5C" hasta="#0B5E36" brillo="#C8FFE0" />
        <View style={st.luces}>
          <View style={[st.luz, { backgroundColor: '#FF4D5E' }]} />
          <View style={[st.luz, { backgroundColor: '#3DF08F' }]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.nuevaTitulo}>Simulador de tirada{esPro ? '' : ' · Pro'}</Text>
          <Text style={st.nuevaSub}>Entrena los tiempos: órdenes por voz y luces roja y verde</Text>
        </View>
        <Icon name="chevron" />
      </Pressable>

      <SectionTitle>Sesiones de entrenamiento</SectionTitle>
      {terminadas.length === 0 && <Text style={s.muted}>Aún no hay sesiones.</Text>}
      {porArma.map(({ armaId, sesiones }) => {
        const a = arma(armaId);
        const disparos = sesiones.flatMap(todosLosDisparos);
        return (
          <View key={armaId} style={{ gap: space.sm }}>
            <Card onPress={() => setAbierta(abierta === armaId ? null : armaId)} style={st.fila}>
              <Icon name="gun" color={colors.accent} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={st.nombre} numberOfLines={1}>{a ? `${a.marca} ${a.modelo}` : 'Arma borrada'}</Text>
                <Text style={s.muted} numberOfLines={1}>
                  {a ? `${a.tipo} · ` : ''}{sesiones.length === 1 ? '1 sesión' : `${sesiones.length} sesiones`} · última {formatear(sesiones[0].fecha.slice(0, 10))}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={st.media}>{formatoMedia(media(disparos))}</Text>
                <Text style={s.muted}>media</Text>
              </View>
              <View style={{ transform: [{ rotate: abierta === armaId ? '90deg' : '0deg' }] }}>
                <Icon name="chevron" color={colors.textMuted} />
              </View>
            </Card>
            {abierta === armaId && sesiones.length > 1 && (
              <Card onPress={() => router.push(`/evolucion?arma=${armaId}`)} style={[st.fila, st.dentro]}>
                <Icon name="chart" color={colors.accent} />
                <Text style={[st.nombre, { flex: 1 }]}>Evolución con esta arma</Text>
                <Icon name="chevron" color={colors.textMuted} />
              </Card>
            )}
            {abierta === armaId && <ListaPorMes sesiones={sesiones} />}
          </View>
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
  simulador: { shadowColor: '#0E8A4A' },
  luces: { width: 40, alignItems: 'center', gap: 6 },
  luz: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)' },
  nuevaTitulo: { color: '#fff', fontSize: 19, fontWeight: '900' },
  nuevaSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  dentro: { marginLeft: space.lg },
  media: { color: colors.green, fontSize: 20, fontWeight: '800' },
  nombre: { color: colors.text, fontSize: 16, fontWeight: '700' },
});
