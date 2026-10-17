import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Icon, type IconName } from '@/components/Icon';
import { Card, Screen, SectionTitle, nivelColor, s } from '@/components/ui';
import { useStore } from '@/data/store';
import { calcularAvisos, type TipoAviso } from '@/lib/avisos';
import { formatear } from '@/lib/fechas';
import { colors, radius, space } from '@/theme';

const ICONO_AVISO: Record<TipoAviso, IconName> = {
  licencia: 'id',
  revista: 'shield',
  carnet: 'id',
  pase: 'qr',
  limpieza: 'broom',
};

export default function Inicio() {
  const store = useStore();
  const { datos } = store;
  const avisos = calcularAvisos(datos).filter((a) => a.nivel !== 'verde' || a.orden < 365).slice(0, 5);

  return (
    <Screen>
      <View style={st.hello}>
        <View style={st.avatar}><Icon name="user" color={colors.textMuted} /></View>
        <View>
          <Text style={s.h2}>Hola, {datos.nombre}</Text>
          <Text style={s.muted}>Todo listo para entrenar</Text>
        </View>
      </View>

      <Pressable onPress={() => router.push('/entrenar')} style={[st.tile, st.entrenar]}>
        <Icon name="target" size={44} />
        <View style={{ flex: 1 }}>
          <Text style={st.tileTitle}>Entrenar</Text>
          <Text style={st.tileSub}>Iniciar nueva sesión</Text>
        </View>
        <Icon name="chevron" />
      </Pressable>

      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Pressable onPress={() => router.push('/armas')} style={[st.tile, st.square, { backgroundColor: colors.cardAlt }]}>
          <Icon name="gun" size={36} />
          <Text style={st.tileTitle}>Mis armas</Text>
          <Text style={st.tileSub}>{datos.armas.length === 1 ? '1 arma registrada' : `${datos.armas.length} armas registradas`}</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/cartera')} style={[st.tile, st.square, { backgroundColor: '#8A4A1F' }]}>
          <Icon name="wallet" size={36} />
          <Text style={st.tileTitle}>Mi cartera</Text>
          <Text style={st.tileSub}>Licencias y Federación</Text>
        </Pressable>
      </View>

      <Pressable onPress={() => router.push('/evolucion')} style={[st.tile, { backgroundColor: colors.purpleSoft }]}>
        <Icon name="chart" size={36} />
        <View style={{ flex: 1 }}>
          <Text style={st.tileTitle}>Mi evolución</Text>
          <Text style={st.tileSub}>Estadísticas y resultados</Text>
        </View>
      </Pressable>

      {store.esEjemplo && (
        <Pressable onPress={() => router.push('/perfil')}>
          <Card style={{ borderColor: colors.orange }}>
            <Text style={s.text}>Datos de ejemplo</Text>
            <Text style={s.muted}>Para usar los tuyos, ve a Perfil y empieza de cero.</Text>
          </Card>
        </Pressable>
      )}

      <SectionTitle>Próximos avisos</SectionTitle>
      <Card style={{ paddingVertical: space.sm }}>
        {avisos.length === 0 && (
          <Text style={[s.muted, { paddingVertical: space.md }]}>
            {datos.permiso.licencias.length || datos.armas.length
              ? 'Todo en regla: no hay renovaciones ni revistas en los próximos meses.'
              : 'Sin avisos. Añade tus licencias y armas en Cartera y Armas.'}
          </Text>
        )}
        {avisos.map((a, i) => (
          <Pressable
            key={a.id}
            onPress={() => router.push(a.armaId ? `/arma/${a.armaId}` : a.tipo === 'revista' ? '/armas' : '/cartera')}
            style={[st.aviso, i > 0 && st.avisoBorder]}
          >
            <View style={[st.avisoIcon, { backgroundColor: nivelColor(a.nivel) }]}>
              <Icon name={ICONO_AVISO[a.tipo]} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.text}>{a.titulo}</Text>
              <Text style={{ color: nivelColor(a.nivel), fontSize: 13 }}>{a.detalle}</Text>
            </View>
            {a.fecha && <Text style={s.muted}>{formatear(a.fecha)}</Text>}
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}

const st = StyleSheet.create({
  hello: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.sm },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
  },
  tile: { borderRadius: radius.lg, padding: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md },
  entrenar: { backgroundColor: colors.accent, paddingVertical: space.xl },
  square: { flex: 1, flexDirection: 'column', alignItems: 'flex-start', gap: 6 },
  tileTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  tileSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  aviso: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  avisoBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  avisoIcon: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
