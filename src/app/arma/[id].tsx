import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Cifra } from '@/components/Cifra';
import { MiniDiana } from '@/components/Diana';
import { Icon } from '@/components/Icon';
import { FotoArma } from '@/components/FotoArma';
import { FotoCampo } from '@/components/FotoCampo';
import {
  Badge, Button, Card, ProgressBar, Row, Screen, Segmented, SectionTitle, s,
} from '@/components/ui';
import { useStore } from '@/data/store';
import type { Limpieza } from '@/data/types';
import { disparosDesdeLimpieza, licenciaDe, nivelPorDias, proximaRevista } from '@/lib/avisos';
import { diasHasta, formatear, mesAnio, plazo } from '@/lib/fechas';
import { formatoMedia, media, todosLosDisparos, totalSesion } from '@/lib/sesiones';
import { colors, radius, space } from '@/theme';

type Vista = 'mantenimiento' | 'documentacion' | 'entrenamientos';

export default function FichaArma() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const arma = store.arma(id);
  const [vista, setVista] = useState<Vista>('mantenimiento');
  const [registrando, setRegistrando] = useState(false);

  if (!arma) {
    return <Screen title="Arma" back><Text style={s.muted}>No se encuentra esta arma.</Text></Screen>;
  }

  const licencia = licenciaDe(store.datos, arma);
  const revista = proximaRevista(store.datos, arma);
  const desde = disparosDesdeLimpieza(arma);
  const limpiar = desde >= arma.intervaloLimpieza;
  const sesiones = store.datos.sesiones.filter((x) => x.armaId === arma.id && x.terminada);
  const ultimos = sesiones.slice(0, 5).flatMap(todosLosDisparos);

  return (
    <Screen
      title={`${arma.marca} ${arma.modelo}`}
      back
      right={
        <Pressable hitSlop={12} onPress={() => router.push(`/arma/editar?id=${arma.id}`)}>
          <Text style={{ color: colors.accent, fontWeight: '700' }}>Editar</Text>
        </Pressable>
      }
    >
      <View style={st.hero}>
        <FotoArma arma={arma} ancho={240} />
        <Text style={st.heroNombre}>{arma.marca} {arma.modelo}</Text>
        <Text style={s.muted}>{arma.tipo} · {arma.calibre} · Guía {arma.numeroGuia}</Text>
        <View style={[st.estado, { backgroundColor: limpiar ? colors.orangeSoft : colors.greenSoft }]}>
          <View style={[st.punto, { backgroundColor: limpiar ? colors.orange : colors.green }]} />
          <Text style={{ color: limpiar ? colors.orange : colors.green, fontWeight: '700' }}>
            {limpiar ? 'Toca limpiar' : 'Operativa'}
          </Text>
        </View>
      </View>

      <View style={st.cifras}>
        <Cifra titulo="Disparos" valor={arma.disparosTotales.toLocaleString('es-ES')} />
        <Cifra titulo="Tiradas" valor={String(sesiones.length)} />
        <Cifra
          titulo="Media"
          valor={ultimos.length ? formatoMedia(media(ultimos)) : '–'}
          detalle={ultimos.length ? 'últimos 5' : undefined}
          color={colors.green}
        />
      </View>

      <Segmented
        value={vista}
        onChange={setVista}
        options={[
          { value: 'mantenimiento', label: 'Cuidado' },
          { value: 'documentacion', label: 'Papeles' },
          { value: 'entrenamientos', label: 'Tiradas' },
        ]}
      />

      {vista === 'entrenamientos' && (
        <>
          {sesiones.length === 0 && (
            <Card><Text style={s.muted}>Aún no has entrenado con esta arma.</Text></Card>
          )}
          {sesiones.map((x) => {
            const d = todosLosDisparos(x);
            return (
              <Card key={x.id} onPress={() => router.push(`/sesion/${x.id}`)} style={st.tirada}>
                <View style={st.mini}><MiniDiana disparos={d} tamano={44} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.text}>{formatear(x.fecha.slice(0, 10))}</Text>
                  <Text style={s.muted}>{x.modalidad} · {x.distancia} m · {d.length} disparos</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: colors.green, fontSize: 18, fontWeight: '800' }}>{totalSesion(x)}</Text>
                  <Text style={s.muted}>media {formatoMedia(media(d))}</Text>
                </View>
              </Card>
            );
          })}
        </>
      )}

      {vista === 'documentacion' && (
        <>
          <Card style={{ gap: space.sm }}>
            <Text style={st.titulo}>Guía de pertenencia</Text>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <FotoCampo
                etiqueta="Anverso"
                documento
                fotoId={arma.fotoGuiaAnverso}
                onChange={(fotoGuiaAnverso) => store.guardarArma({ ...arma, fotoGuiaAnverso })}
              />
              <FotoCampo
                etiqueta="Reverso"
                documento
                fotoId={arma.fotoGuiaReverso}
                onChange={(fotoGuiaReverso) => store.guardarArma({ ...arma, fotoGuiaReverso })}
              />
            </View>
            <Row label="Nº de guía" value={arma.numeroGuia} />
            <Row label="Marca" value={arma.marca} />
            <Row label="Modelo" value={arma.modelo} />
            <Row label="Calibre" value={arma.calibre} />
            <Row label="Nº de serie" value={arma.numeroSerie} />
            <Row label="Fecha de expedición" value={arma.fechaGuia ? formatear(arma.fechaGuia) : '—'} />
            <Row label="Licencia" value={licencia ? `Tipo ${licencia.tipo}` : '—'} />
          </Card>
          {revista && (
            <Card style={{ gap: space.sm }}>
              <Text style={st.titulo}>Próxima revista</Text>
              <Text style={s.text}>Mes de {mesAnio(revista)}</Text>
              <Badge nivel={nivelPorDias(diasHasta(revista))}>{plazo(revista, 'Toca')}</Badge>
              <Text style={s.muted}>
                Se pasa en la Intervención de Armas de la Guardia Civil, dentro del mes en que renuevas la licencia
                {licencia ? ` ${licencia.tipo}` : ''}. No pasar dos revistas seguidas anula la guía.
              </Text>
            </Card>
          )}
        </>
      )}

      {vista === 'mantenimiento' && (
        <>
          <Card style={{ gap: space.sm }}>
            <Text style={st.titulo}>Próxima limpieza recomendada</Text>
            <ProgressBar value={desde} max={arma.intervaloLimpieza} />
            <View style={st.entre}>
              <Text style={s.muted}>{desde} / {arma.intervaloLimpieza} disparos</Text>
              <Text style={s.muted}>
                {desde >= arma.intervaloLimpieza ? 'Toca limpiar' : `Quedan ${arma.intervaloLimpieza - desde}`}
              </Text>
            </View>
            {registrando ? (
              <RegistrarLimpieza
                onCancel={() => setRegistrando(false)}
                onSave={(tipo) => {
                  store.registrarLimpieza(arma.id, tipo);
                  setRegistrando(false);
                }}
              />
            ) : (
              <Button title="Registrar limpieza" onPress={() => setRegistrando(true)} />
            )}
          </Card>

          <Card style={{ gap: space.sm }}>
            <Text style={st.titulo}>Sumar disparos sueltos</Text>
            <Text style={s.muted}>Los entrenamientos se suman solos. Si has tirado sin registrarlo, añádelos aquí.</Text>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {[50, 100, 200].map((n) => (
                <Pressable key={n} style={st.chip} onPress={() => store.sumarDisparos(arma.id, n)}>
                  <Text style={st.chipText}>+{n}</Text>
                </Pressable>
              ))}
            </View>
          </Card>

          <SectionTitle>Historial de mantenimiento</SectionTitle>
          <Card style={{ paddingVertical: space.sm }}>
            {arma.limpiezas.length === 0 && <Text style={s.muted}>Sin limpiezas registradas.</Text>}
            {arma.limpiezas.map((l, i) => (
              <View key={l.id} style={[st.hist, i > 0 && st.histBorder]}>
                <Icon name="broom" size={18} color={l.tipo === 'Completa' ? colors.green : colors.accent} />
                <Text style={[s.text, { width: 92 }]}>{formatear(l.fecha)}</Text>
                <Text style={[s.text, { flex: 1 }]}>Limpieza {l.tipo.toLowerCase()}</Text>
                <Text style={s.muted}>{l.disparos.toLocaleString('es-ES')} disp.</Text>
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

function RegistrarLimpieza({ onSave, onCancel }: {
  onSave: (tipo: Limpieza['tipo']) => void;
  onCancel: () => void;
}) {
  const [tipo, setTipo] = useState<Limpieza['tipo']>('Básica');
  return (
    <View style={{ gap: space.sm }}>
      <Segmented
        value={tipo}
        onChange={setTipo}
        options={[
          { value: 'Básica', label: 'Básica' },
          { value: 'Completa', label: 'Completa' },
        ]}
      />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}><Button title="Cancelar" variant="secondary" onPress={onCancel} /></View>
        <View style={{ flex: 1 }}><Button title="Guardar hoy" onPress={() => onSave(tipo)} /></View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  hero: {
    alignItems: 'center', gap: 4, paddingVertical: space.lg, backgroundColor: colors.card,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
  },
  heroNombre: { color: colors.text, fontSize: 24, fontWeight: '800', marginTop: space.sm },
  estado: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.sm,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999,
  },
  punto: { width: 8, height: 8, borderRadius: 4 },
  cifras: { flexDirection: 'row', gap: space.sm },
  tirada: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  mini: { borderRadius: 22, overflow: 'hidden' },
  titulo: { color: colors.text, fontSize: 16, fontWeight: '700' },
  entre: { flexDirection: 'row', justifyContent: 'space-between' },
  chip: {
    flex: 1, paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.cardAlt,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  chipText: { color: colors.text, fontWeight: '700' },
  hist: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md },
  histBorder: { borderTopWidth: 1, borderTopColor: colors.border },
});
