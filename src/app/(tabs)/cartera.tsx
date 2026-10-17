import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@/components/Icon';
import { Badge, Button, Card, DocPlaceholder, FakeQr, Row, Screen, Segmented, s } from '@/components/ui';
import { useStore } from '@/data/store';
import { nivelPorDias } from '@/lib/avisos';
import { diasHasta, formatear, plazo } from '@/lib/fechas';
import { colors, space } from '@/theme';

type Vista = 'licencias' | 'federacion';

export default function Cartera() {
  const { datos } = useStore();
  const [vista, setVista] = useState<Vista>('licencias');
  const f = datos.federacion;

  return (
    <Screen title="Mi cartera">
      <Segmented
        value={vista}
        onChange={setVista}
        options={[
          { value: 'licencias', label: 'Licencias' },
          { value: 'federacion', label: 'Federación' },
        ]}
      />

      {vista === 'licencias' && (
        <>
          <Card style={{ gap: space.sm }}>
            <Text style={st.titulo}>Permiso de armas</Text>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <DocPlaceholder label="Anverso" />
              <DocPlaceholder label="Reverso" />
            </View>
          </Card>
          {datos.permiso.licencias.map((l) => {
            const dias = diasHasta(l.caducidad);
            return (
              <Card key={l.id} style={{ gap: 4 }}>
                <View style={st.cabecera}>
                  <Text style={st.titulo}>Tipo {l.tipo}</Text>
                  <Badge nivel={dias < 0 ? 'rojo' : 'verde'}>{dias < 0 ? 'Caducada' : 'Vigente'}</Badge>
                </View>
                <Row label="Nº" value={l.numero} />
                <Row label="Expedición" value={formatear(l.expedicion)} />
                <Row label="Caducidad" value={formatear(l.caducidad)} />
                <Badge nivel={nivelPorDias(dias)}>{plazo(l.caducidad)}</Badge>
              </Card>
            );
          })}
        </>
      )}

      {vista === 'federacion' && (
        <>
          <Card style={{ gap: 4 }}>
            <Text style={st.titulo}>{f.nombre}</Text>
            <Text style={[s.muted, { marginBottom: space.sm }]}>Carnet de federado</Text>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <DocPlaceholder label="Carnet" />
            </View>
            <Row label="Nº de federado" value={f.numeroFederado} />
            <Row label="Categoría" value={f.categoria} />
            <Row label="Válido hasta" value={formatear(f.caducidadCarnet)} />
            <Badge nivel={nivelPorDias(diasHasta(f.caducidadCarnet))}>{plazo(f.caducidadCarnet)}</Badge>
          </Card>
          <Card style={{ alignItems: 'center', gap: space.md }}>
            <Text style={st.titulo}>Pase de acceso al recinto</Text>
            <FakeQr size={170} />
            <Text style={s.muted}>Código: {f.codigoPase}</Text>
            <Text style={s.muted}>Válido hasta {formatear(f.caducidadPase)}</Text>
            <View style={{ alignSelf: 'stretch' }}>
              <Button title="Mostrar en grande" onPress={() => router.push('/pase')} />
            </View>
          </Card>
          <Card style={st.info}>
            <Icon name="qr" color={colors.textMuted} />
            <Text style={[s.muted, { flex: 1 }]}>
              QR de ejemplo. En la app real guardarás una captura del QR de la federación.
            </Text>
          </Card>
        </>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  titulo: { color: colors.text, fontSize: 16, fontWeight: '700' },
  cabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  info: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
