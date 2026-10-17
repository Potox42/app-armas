import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Icon } from '@/components/Icon';
import {
  Badge, Button, Card, DocPlaceholder, GunArt, ProgressBar, Row, Screen, Segmented, SectionTitle, s,
} from '@/components/ui';
import { useStore } from '@/data/store';
import type { Limpieza } from '@/data/types';
import { disparosDesdeLimpieza, licenciaDe, nivelPorDias, proximaRevista } from '@/lib/avisos';
import { diasHasta, formatear, mesAnio, plazo } from '@/lib/fechas';
import { colors, radius, space } from '@/theme';

type Vista = 'documentacion' | 'mantenimiento';

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

  return (
    <Screen title={`${arma.marca} ${arma.modelo}`} back>
      <Card style={st.cabecera}>
        <GunArt tipo={arma.tipo} width={130} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.h2}>{arma.marca} {arma.modelo}</Text>
          <Text style={s.muted}>{arma.tipo} · {arma.calibre}</Text>
          <Text style={s.muted}>Nº de guía: {arma.numeroGuia}</Text>
          <Text style={s.muted}>{arma.disparosTotales.toLocaleString('es-ES')} disparos</Text>
        </View>
      </Card>

      <Segmented
        value={vista}
        onChange={setVista}
        options={[
          { value: 'documentacion', label: 'Documentación' },
          { value: 'mantenimiento', label: 'Mantenimiento' },
        ]}
      />

      {vista === 'documentacion' && (
        <>
          <Card style={{ gap: space.sm }}>
            <Text style={st.titulo}>Guía de pertenencia</Text>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <DocPlaceholder label="Anverso" />
              <DocPlaceholder label="Reverso" />
            </View>
            <Row label="Nº de guía" value={arma.numeroGuia} />
            <Row label="Marca" value={arma.marca} />
            <Row label="Modelo" value={arma.modelo} />
            <Row label="Calibre" value={arma.calibre} />
            <Row label="Nº de serie" value={arma.numeroSerie} />
            <Row label="Fecha de expedición" value={formatear(arma.fechaGuia)} />
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
            <Text style={st.titulo}>Sumar disparos de hoy</Text>
            <Text style={s.muted}>Hasta que llegue el diario de entrenamiento, súmalos a mano.</Text>
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
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: space.md },
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
