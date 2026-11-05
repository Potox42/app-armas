import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Degradado } from '@/components/Degradado';
import { ListaPorMes } from '@/components/Historial';
import { FotoArma } from '@/components/FotoArma';
import { Icon } from '@/components/Icon';
import { Card, Kicker, Screen, SectionTitle, s } from '@/components/ui';
import { useStore } from '@/data/store';
import { formatear } from '@/lib/fechas';
import { formatoMedia, media, todosLosDisparos } from '@/lib/sesiones';
import { colors, radius, space } from '@/theme';

export default function Entrenar() {
  const { datos, arma } = useStore();
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
          <Text style={st.nuevaTitulo}>Simulador de tirada</Text>
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
          <View key={armaId} style={st.grupo}>
            {/* Cabecera del arma: más grande y con su foto o silueta, para que no se confunda con las filas de debajo. */}
            <Pressable
              onPress={() => setAbierta(abierta === armaId ? null : armaId)}
              style={({ pressed }) => [st.arma, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}
              accessibilityLabel={a ? `${a.marca} ${a.modelo}` : 'Arma borrada'}
            >
              <Degradado desde={colors.heroDesde} hasta={colors.heroHasta} brillo={colors.heroBrillo} brilloEn={[0.9, 0.1]} />
              <View style={st.franja} />
              {a ? <FotoArma arma={a} ancho={76} /> : <Icon name="gun" size={34} color={colors.accent} />}
              <View style={{ flex: 1, gap: 3 }}>
                <Kicker>{a ? `${a.tipo} · ${a.calibre}` : 'Arma'}</Kicker>
                <Text style={st.armaNombre} numberOfLines={2}>{a ? `${a.marca} ${a.modelo}` : 'Arma borrada'}</Text>
                <Text style={s.muted} numberOfLines={2}>
                  {sesiones.length === 1 ? '1 sesión' : `${sesiones.length} sesiones`}{'\n'}última {formatear(sesiones[0].fecha.slice(0, 10))}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={st.armaMedia}>{formatoMedia(media(disparos))}</Text>
                <Text style={s.muted}>media</Text>
              </View>
              <View style={{ transform: [{ rotate: abierta === armaId ? '90deg' : '0deg' }] }}>
                <Icon name="chevron" color={colors.text} />
              </View>
            </Pressable>
            {abierta === armaId && (
              // Lo de dentro va colgado de una raya azul: así se ve que son los datos de esa arma.
              <View style={st.contenido}>
                {sesiones.length > 1 && (
                  <Card onPress={() => router.push(`/evolucion?arma=${armaId}`)} style={st.fila}>
                    <Icon name="chart" color={colors.accent} />
                    <Text style={[st.nombre, { flex: 1 }]}>Evolución con esta arma</Text>
                    <Icon name="chevron" color={colors.textMuted} />
                  </Card>
                )}
                <ListaPorMes sesiones={sesiones} />
              </View>
            )}
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
  grupo: { gap: space.sm, marginTop: space.sm },
  arma: {
    borderRadius: radius.xl, padding: space.lg, paddingLeft: space.lg + 6, overflow: 'hidden', zIndex: 0,
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    borderWidth: 1.5, borderColor: colors.accent,
    shadowColor: colors.accentDark, shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 },
  },
  franja: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, backgroundColor: colors.accent },
  armaNombre: { color: colors.text, fontSize: 21, lineHeight: 24, fontWeight: '900', letterSpacing: -0.5 },
  armaMedia: { color: colors.green, fontSize: 26, fontWeight: '900' },
  contenido: { gap: space.sm, marginLeft: space.sm, paddingLeft: space.md, borderLeftWidth: 3, borderLeftColor: colors.accent },
  nombre: { color: colors.text, fontSize: 16, fontWeight: '700' },
});
