import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { PermisoArmas } from '@/data/types';
import { nivelPorDias } from '@/lib/avisos';
import { diasHasta, formatear } from '@/lib/fechas';
import { ocultar } from '@/lib/informe';
import { radius, space } from '@/theme';
import { nivelColor } from './ui';

const TINTA = '#16203A';

/** «92 días», «6 meses», «2 años» o «Caducada». */
function queda(dias: number): string {
  if (dias < 0) return 'Caducada';
  if (dias === 0) return 'Hoy';
  if (dias <= 120) return `${dias} días`;
  if (dias < 730) return `${Math.round(dias / 30)} meses`;
  return `${Math.floor(dias / 365)} años`;
}

/**
 * La tarjeta de licencia de armas tal como es: amarilla y azul, con el NIF del titular
 * y una tabla con cada licencia (tipo, válida desde, válida hasta) y su estado.
 */
export function DocumentoLicencia({ permiso, onPress }: { permiso: PermisoArmas; onPress?: () => void }) {
  // Mismo orden que en la tarjeta: E, F, D.
  // El NIF sale tapado (por si alguien mira la pantalla) hasta que se toca.
  const [verNif, setVerNif] = useState(false);
  const filas = [...permiso.licencias].sort((a, b) => 'EFD'.indexOf(a.tipo) - 'EFD'.indexOf(b.tipo));
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [st.tarjeta, pressed && { opacity: 0.9 }]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 63">
        <Defs>
          <LinearGradient id="doc-lic" x1="0" y1="0.3" x2="1" y2="0.7">
            <Stop offset="0" stopColor="#F1BE45" />
            <Stop offset="0.5" stopColor="#F5E4B8" />
            <Stop offset="1" stopColor="#3F5FD8" />
          </LinearGradient>
        </Defs>
        <Rect width="100" height="63" fill="url(#doc-lic)" />
      </Svg>
      {/* Estrellas de la bandera europea, como en la tarjeta real */}
      <Svg style={st.estrellas} width={58} height={58} viewBox="0 0 20 20">
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return <Circle key={i} cx={10 + Math.cos(a) * 8} cy={10 + Math.sin(a) * 8} r={1.1} fill="#FFE07A" />;
        })}
      </Svg>

      <View style={st.cabecera}>
        <View style={{ flex: 1 }}>
          <Text style={st.pais}>España · Ministerio del Interior</Text>
          <Text style={st.titulo}>Licencia de armas</Text>
          {permiso.numero ? (
            <Pressable onPress={() => setVerNif((v) => !v)} hitSlop={8} accessibilityLabel={verNif ? 'Ocultar NIF' : 'Ver NIF'} style={{ alignSelf: 'flex-start' }}>
              <Text style={st.nif}>
                NIF {verNif ? permiso.numero : ocultar(permiso.numero)}
                <Text style={st.ver}>  {verNif ? 'ocultar' : 'ver'}</Text>
              </Text>
            </Pressable>
          ) : (
            <Text style={st.nif}>Toca para añadir tus datos</Text>
          )}
        </View>
      </View>

      <View style={st.tabla}>
        <View style={[st.fila, st.filaCabecera]}>
          <Text style={[st.th, st.colTipo]}>Tipo</Text>
          <Text style={[st.th, st.col]}>Desde</Text>
          <Text style={[st.th, st.col]}>Hasta</Text>
          <Text style={[st.th, st.colEstado]}>Estado</Text>
        </View>
        {filas.length === 0 && <Text style={[st.td, { padding: space.sm }]}>Sin licencias todavía</Text>}
        {filas.map((l, i) => {
          const dias = diasHasta(l.caducidad);
          return (
            <View key={l.id} style={[st.fila, i < filas.length - 1 && st.separador]}>
              <Text style={[st.tipo, st.colTipo]}>
                {l.tipo}
                {l.categoria ? <Text style={st.cat}> {l.categoria}ª</Text> : null}
              </Text>
              <Text style={[st.td, st.col]}>{formatear(l.expedicion)}</Text>
              <Text style={[st.td, st.col, { fontWeight: '800' }]}>{formatear(l.caducidad)}</Text>
              <View style={[st.colEstado, st.estado]}>
                <View style={[st.punto, { backgroundColor: nivelColor(nivelPorDias(dias)) }]} />
                <Text style={st.estadoTexto} numberOfLines={1}>{queda(dias)}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </Pressable>
  );
}

const st = StyleSheet.create({
  ver: { fontSize: 11, fontWeight: '700', textDecorationLine: 'underline' },
  tarjeta: { borderRadius: radius.lg, overflow: 'hidden', padding: space.lg, gap: space.md, minHeight: 210 },
  cabecera: { flexDirection: 'row' },
  estrellas: { position: 'absolute', top: 14, right: 16 },
  pais: { color: TINTA, opacity: 0.7, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  titulo: { color: TINTA, fontSize: 24, fontWeight: '900', marginTop: 2 },
  nif: { color: TINTA, fontSize: 14, fontWeight: '700', marginTop: 4, fontVariant: ['tabular-nums'] },
  tabla: { backgroundColor: 'rgba(255,255,255,0.78)', borderRadius: radius.md, overflow: 'hidden' },
  fila: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, paddingVertical: 9 },
  filaCabecera: { backgroundColor: 'rgba(22,32,58,0.08)', paddingVertical: 6 },
  separador: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(22,32,58,0.2)' },
  th: { color: TINTA, opacity: 0.65, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  td: { color: TINTA, fontSize: 13, fontVariant: ['tabular-nums'] },
  tipo: { color: TINTA, fontSize: 20, fontWeight: '900' },
  cat: { fontSize: 11, fontWeight: '700' },
  colTipo: { width: 48 },
  col: { flex: 1 },
  colEstado: { width: 92 },
  estado: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  punto: { width: 9, height: 9, borderRadius: 5 },
  estadoTexto: { color: TINTA, fontSize: 12, fontWeight: '700', flexShrink: 1 },
});
