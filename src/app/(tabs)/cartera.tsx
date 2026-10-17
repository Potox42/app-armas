import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { FotoCampo, useFoto } from '@/components/FotoCampo';
import { Icon } from '@/components/Icon';
import { Badge, Button, Card, FakeQr, Row, Screen, Segmented, s } from '@/components/ui';
import { useStore } from '@/data/store';
import { nivelPorDias } from '@/lib/avisos';
import { diasHasta, formatear, plazo } from '@/lib/fechas';
import { colors, space } from '@/theme';

type Vista = 'licencias' | 'federacion';

export default function Cartera() {
  const store = useStore();
  const { datos } = store;
  const [vista, setVista] = useState<Vista>('licencias');
  const f = datos.federacion;
  const qr = useFoto(f.fotoQr);
  const hayFederacion = !!(f.numeroFederado || f.caducidadCarnet || f.fotoCarnet || f.fotoQr);

  return (
    <Screen
      title="Mi cartera"
      right={
        <Pressable
          hitSlop={12}
          accessibilityLabel={vista === 'licencias' ? 'Añadir licencia' : 'Editar federación'}
          onPress={() => router.push(vista === 'licencias' ? '/licencia' : '/federacion')}
        >
          <Icon name="plus" color={colors.text} />
        </Pressable>
      }
    >
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
              <FotoCampo
                etiqueta="Anverso"
                fotoId={datos.permiso.fotoAnverso}
                onChange={(fotoAnverso) => store.actualizarPermiso({ fotoAnverso })}
              />
              <FotoCampo
                etiqueta="Reverso"
                fotoId={datos.permiso.fotoReverso}
                onChange={(fotoReverso) => store.actualizarPermiso({ fotoReverso })}
              />
            </View>
          </Card>
          {datos.permiso.licencias.length === 0 && (
            <Card style={{ gap: space.md }}>
              <Text style={s.muted}>Añade tus licencias (F, D, E) para recibir avisos de renovación y de revista.</Text>
              <Button title="Añadir licencia" onPress={() => router.push('/licencia')} />
            </Card>
          )}
          {datos.permiso.licencias.map((l) => {
            const dias = diasHasta(l.caducidad);
            return (
              <Card key={l.id} style={{ gap: 4 }} onPress={() => router.push(`/licencia?id=${l.id}`)}>
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
          <Card style={{ gap: 4 }} onPress={() => router.push('/federacion')}>
            <Text style={st.titulo}>{f.nombre}</Text>
            <Text style={[s.muted, { marginBottom: space.sm }]}>Carnet de federado · toca para editar</Text>
            {hayFederacion ? (
              <>
                <Row label="Nº de federado" value={f.numeroFederado || '—'} />
                <Row label="Categoría" value={f.categoria || '—'} />
                {f.caducidadCarnet ? (
                  <>
                    <Row label="Válido hasta" value={formatear(f.caducidadCarnet)} />
                    <Badge nivel={nivelPorDias(diasHasta(f.caducidadCarnet))}>{plazo(f.caducidadCarnet)}</Badge>
                  </>
                ) : null}
              </>
            ) : (
              <Text style={s.muted}>Añade tu número de federado, la foto del carnet y el QR del recinto.</Text>
            )}
          </Card>
          <Card style={{ flexDirection: 'row', gap: space.sm }}>
            <FotoCampo
              etiqueta="Foto del carnet"
              fotoId={f.fotoCarnet}
              onChange={(fotoCarnet) => store.guardarFederacion({ ...f, fotoCarnet })}
            />
          </Card>
          <Card style={{ alignItems: 'center', gap: space.md }}>
            <Text style={st.titulo}>Pase de acceso al recinto</Text>
            {qr ? (
              <Image source={{ uri: qr }} style={{ width: 200, height: 200 }} resizeMode="contain" />
            ) : store.esEjemplo ? (
              <FakeQr size={170} />
            ) : (
              <Text style={s.muted}>Aún no has guardado la captura del QR.</Text>
            )}
            {f.codigoPase ? <Text style={s.muted}>Código: {f.codigoPase}</Text> : null}
            {f.caducidadPase ? <Text style={s.muted}>Válido hasta {formatear(f.caducidadPase)}</Text> : null}
            <View style={{ alignSelf: 'stretch' }}>
              {qr || store.esEjemplo ? (
                <Button title="Mostrar en grande" onPress={() => router.push('/pase')} />
              ) : (
                <Button title="Añadir captura del QR" onPress={() => router.push('/federacion')} />
              )}
            </View>
          </Card>
        </>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  titulo: { color: colors.text, fontSize: 16, fontWeight: '700' },
  cabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
