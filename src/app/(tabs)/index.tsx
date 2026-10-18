import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, type Href } from 'expo-router';
import { Avatar } from '@/components/Avatar';
import { Anillo, Cifra } from '@/components/Cifra';
import { InstalarApp } from '@/components/InstalarApp';
import { Icon, type IconName } from '@/components/Icon';
import { Degradado } from '@/components/Degradado';
import { Button, Card, Kicker, Screen, SectionTitle, nivelColor, s } from '@/components/ui';
import { useStore } from '@/data/store';
import { calcularAvisos, type Aviso, type TipoAviso } from '@/lib/avisos';
import { competiciones, fechaCorta, repartir } from '@/lib/competiciones';
import { diasHasta, formatear } from '@/lib/fechas';
import { formatoMedia, media, sumaSerie, todosLosDisparos, totalSesion } from '@/lib/sesiones';
import { colors, radius, space } from '@/theme';

const ICONO_AVISO: Record<TipoAviso, IconName> = {
  competicion: 'calendar',
  municion: 'box',
  licencia: 'id',
  revista: 'shield',
  carnet: 'id',
  pase: 'qr',
  limpieza: 'broom',
};

const ACCESOS: { titulo: string; texto: string; icono: IconName; ruta: Href }[] = [
  { titulo: 'Licencias', texto: 'E, F, D con sus fechas', icono: 'id', ruta: '/cartera' },
  { titulo: 'Mis armas', texto: '', icono: 'gun', ruta: '/armas' },
  { titulo: 'Entrenar', texto: 'Diana, números o cámara', icono: 'target', ruta: '/entrenar' },
  { titulo: 'Evolución', texto: 'Medias y tendencia', icono: 'chart', ruta: '/evolucion' },
  { titulo: 'Competiciones', texto: 'Tu calendario y avisos', icono: 'calendar', ruta: '/competiciones' },
  { titulo: 'Munición', texto: 'Compras, cupo y depósito', icono: 'box', ruta: '/municion' },
];

const rutaAviso = (a: Aviso): Href =>
  a.armaId ? `/arma/${a.armaId}` : a.tipo === 'revista' ? '/armas' : a.tipo === 'competicion' ? '/competiciones' : a.tipo === 'municion' ? '/municion' : '/cartera';

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
  const siguiente = repartir(competiciones(datos)).proximas.find((c) => c.inscrito);
  const armaUltima = ultima && store.arma(ultima.armaId);
  const sumas = ultima ? ultima.series.map(sumaSerie) : [];

  return (
    <Screen>
      <View style={st.hello}>
        <View style={{ flex: 1 }}>
          <Kicker>Tirador deportivo</Kicker>
          <Text style={st.saludo}>{datos.nombre ? `Hola, ${datos.nombre.split(' ')[0]}` : 'Hola'}</Text>
          <Text style={s.muted}>Tu centro deportivo personal</Text>
        </View>
        <Pressable onPress={() => router.push('/perfil')} accessibilityLabel="Perfil">
          <Avatar nombre={datos.nombre} tamano={46} />
        </Pressable>
      </View>

      <View style={st.hero}>
        <Degradado desde="#183149" hasta="#07101A" brillo="#5BB3FF" brilloEn={[0.85, 0.08]} />
        <View style={st.estado}>
          <View style={[st.punto, { backgroundColor: prioridad ? nivelColor(prioridad.nivel) : colors.green }]} />
          <Text style={st.estadoTexto}>{prioridad ? 'Tienes algo pendiente' : 'Documentación al día'}</Text>
        </View>
        <Text style={st.titular}>Todo lo importante, de un vistazo</Text>
        <Text style={s.muted}>Licencias, armas, entrenamiento y evolución en un solo sitio.</Text>
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
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
        <View style={{ marginTop: space.sm }}>
          <Button title="◎  Iniciar entrenamiento" onPress={() => router.push('/entrenar')} />
        </View>
      </View>

      {prioridad && (
        <Pressable
          onPress={() => router.push(rutaAviso(prioridad))}
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

      <SectionTitle kicker="Hoy">Centro de control</SectionTitle>
      <View style={st.rejilla}>
        {ACCESOS.map((x) => (
          <Card key={x.titulo} onPress={() => router.push(x.ruta)} style={st.acceso}>
            <View style={st.accesoIcono}><Icon name={x.icono} size={22} color="#A7D9FF" /></View>
            <Text style={st.accesoTitulo}>{x.titulo}</Text>
            <Text style={st.accesoTexto}>
              {x.titulo === 'Mis armas'
                ? datos.armas.length === 1 ? '1 arma registrada' : `${datos.armas.length} armas registradas`
                : x.titulo === 'Competiciones' && siguiente
                  ? `Próxima: ${fechaCorta(siguiente.fecha)} · ${siguiente.modalidad}`
                  : x.texto}
            </Text>
          </Card>
        ))}
      </View>

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
            onPress={() => router.push(rutaAviso(a))}
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
  hello: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md, marginBottom: space.xs },
  saludo: { color: colors.text, fontSize: 31, lineHeight: 34, fontWeight: '900', letterSpacing: -1.2, marginTop: 4 },
  hero: {
    borderRadius: radius.xl, padding: space.xl - 2, gap: space.sm, overflow: 'hidden', zIndex: 0,
    borderWidth: 1, borderColor: 'rgba(117,173,225,0.34)',
    shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 30, shadowOffset: { width: 0, height: 18 },
  },
  estado: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  punto: { width: 8, height: 8, borderRadius: 4 },
  estadoTexto: { color: colors.text, fontSize: 12, fontWeight: '800' },
  titular: { color: colors.text, fontSize: 32, lineHeight: 33, fontWeight: '900', letterSpacing: -1.3 },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  acceso: { width: '47.5%', flexGrow: 1, minHeight: 128, gap: 4, padding: space.lg },
  accesoIcono: {
    width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#163A60', borderWidth: 1, borderColor: 'rgba(101,175,240,0.2)', marginBottom: space.sm,
  },
  accesoTitulo: { color: colors.text, fontSize: 16, fontWeight: '800' },
  accesoTexto: { color: colors.textMuted, fontSize: 12, lineHeight: 16 },
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
