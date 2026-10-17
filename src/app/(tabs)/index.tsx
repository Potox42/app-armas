import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Avatar } from '@/components/Avatar';
import { Anillo, Cifra } from '@/components/Cifra';
import { InstalarApp } from '@/components/InstalarApp';
import { Icon, type IconName } from '@/components/Icon';
import { Card, Screen, SectionTitle, nivelColor, s } from '@/components/ui';
import { useStore } from '@/data/store';
import { calcularAvisos, type TipoAviso } from '@/lib/avisos';
import { diasHasta, formatear } from '@/lib/fechas';
import { formatoMedia, media, sumaSerie, todosLosDisparos, totalSesion } from '@/lib/sesiones';
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
  if (!store.ajustes.bienvenida) return <Redirect href="/bienvenida" />;
  const avisos = calcularAvisos(datos).filter((a) => a.nivel !== 'verde' || a.orden < 365).slice(0, 5);
  const prioridad = avisos[0] && avisos[0].nivel !== 'verde' ? avisos[0] : undefined;
  const resto = prioridad ? avisos.slice(1) : avisos;
  const activas = datos.permiso.licencias.filter((l) => diasHasta(l.caducidad) >= 0);
  const proxima = [...activas].sort((a, b) => a.caducidad.localeCompare(b.caducidad))[0];
  const ultima = datos.sesiones.find((x) => x.terminada);
  const armaUltima = ultima && store.arma(ultima.armaId);
  const sumas = ultima ? ultima.series.map(sumaSerie) : [];

  return (
    <Screen>
      <View style={st.hello}>
        <Avatar nombre={datos.nombre} />
        <View>
          <Text style={s.h2}>{datos.nombre ? `Hola, ${datos.nombre}` : 'Hola'}</Text>
          <Text style={s.muted}>Todo listo para entrenar</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Cifra
          titulo="Caduca en"
          valor={proxima ? `${diasHasta(proxima.caducidad)} d` : '—'}
          detalle={proxima ? `Licencia ${proxima.tipo}` : 'Sin licencias'}
          color={proxima && diasHasta(proxima.caducidad) <= 120 ? colors.orange : colors.text}
        />
        <Cifra titulo="Licencias" valor={String(activas.length)} detalle="en vigor" />
        <Cifra
          titulo="Última media"
          valor={ultima ? formatoMedia(media(todosLosDisparos(ultima))) : '—'}
          detalle={ultima ? formatear(ultima.fecha.slice(0, 10)).slice(0, 5) : 'Sin sesiones'}
          color={ultima ? colors.green : colors.text}
        />
      </View>

      {prioridad && (
        <Pressable
          onPress={() => router.push(prioridad.armaId ? `/arma/${prioridad.armaId}` : prioridad.tipo === 'revista' ? '/armas' : '/cartera')}
          style={[st.prioridad, { borderColor: nivelColor(prioridad.nivel) }]}
        >
          <View style={[st.avisoIcon, { backgroundColor: nivelColor(prioridad.nivel), width: 44, height: 44 }]}>
            <Icon name={ICONO_AVISO[prioridad.tipo]} size={24} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[st.etiquetaPrioridad, { color: nivelColor(prioridad.nivel) }]}>Lo más urgente</Text>
            <Text style={st.tileTitle}>{prioridad.titulo}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>{prioridad.detalle}</Text>
          </View>
          <Icon name="chevron" color={colors.textMuted} />
        </Pressable>
      )}

      <Pressable onPress={() => router.push('/entrenar')} style={[st.tile, st.entrenar]}>
        <Icon name="target" size={44} />
        <View style={{ flex: 1 }}>
          <Text style={st.tileTitle}>Entrenar</Text>
          <Text style={st.tileSub}>Iniciar nueva sesión</Text>
        </View>
        <Icon name="chevron" />
      </Pressable>

      {ultima && (
        <>
          <SectionTitle>Última sesión</SectionTitle>
          <Pressable onPress={() => router.push(`/sesion/${ultima.id}`)}>
            <Card style={st.ultima}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={st.ultimaEtiqueta}>{ultima.modalidad} · {ultima.distancia} m</Text>
                <Text style={st.tileTitle}>{armaUltima ? `${armaUltima.marca} ${armaUltima.modelo}` : 'Arma'}</Text>
                <Text style={s.muted}>
                  {formatear(ultima.fecha.slice(0, 10))} · {todosLosDisparos(ultima).length} disparos{ultima.municion ? ` · ${ultima.municion}` : ''}
                </Text>
                <View style={st.barras}>
                  {sumas.map((v, i) => {
                    const max = ultima.series[i].disparos.length * 10 || 1;
                    return <View key={i} style={[st.barra, { height: 8 + 40 * Math.max(0, (v / max - 0.6) / 0.4) }]} />;
                  })}
                </View>
              </View>
              <Anillo valor={totalSesion(ultima)} maximo={todosLosDisparos(ultima).length * 10} tamano={92} grosor={8} color={colors.green}>
                <Text style={st.ultimaMedia}>{formatoMedia(media(todosLosDisparos(ultima)))}</Text>
                <Text style={[s.muted, { fontSize: 11 }]}>media</Text>
              </Anillo>
            </Card>
          </Pressable>
        </>
      )}

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
        {prioridad && resto.length === 0 && (
          <Text style={[s.muted, { paddingVertical: space.md }]}>Nada más pendiente en los próximos meses.</Text>
        )}
        {resto.map((a, i) => (
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

      <InstalarApp />
    </Screen>
  );
}

const st = StyleSheet.create({
  hello: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.sm },
  tile: { borderRadius: radius.lg, padding: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md },
  entrenar: { backgroundColor: colors.accent, paddingVertical: space.xl },
  square: { flex: 1, flexDirection: 'column', alignItems: 'flex-start', gap: 6 },
  tileTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  tileSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  prioridad: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg,
    backgroundColor: colors.card, borderWidth: 1.5,
  },
  etiquetaPrioridad: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  ultima: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  ultimaEtiqueta: { color: colors.accent, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  ultimaMedia: { color: colors.text, fontSize: 24, fontWeight: '800' },
  barras: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 48, marginTop: space.sm },
  barra: { flex: 1, maxWidth: 22, borderRadius: 4, backgroundColor: colors.accent },
  aviso: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  avisoBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  avisoIcon: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
