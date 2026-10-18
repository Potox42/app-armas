import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { FotoCampo, useFoto } from '@/components/FotoCampo';
import { Icon } from '@/components/Icon';
import { AvisosCalendario } from '@/components/AvisosCalendario';
import { DocumentoLicencia } from '@/components/DocumentoLicencia';
import { DatoTarjeta, EstadoTarjeta, Tarjeta } from '@/components/Tarjeta';
import { Button, Card, FakeQr, Screen, Segmented, nivelColor, s } from '@/components/ui';
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
          accessibilityLabel={vista === 'licencias' ? 'Editar licencia' : 'Editar federación'}
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
          <DocumentoLicencia permiso={datos.permiso} onPress={() => router.push('/licencia')} />
          {datos.permiso.licencias.length === 0 ? (
            <Card style={{ gap: space.md }}>
              <Text style={s.muted}>Escanea tu tarjeta de licencia de armas: leo cada licencia (E, F, D) con sus fechas y te aviso antes de que caduquen.</Text>
              <Button title="Escanear la licencia" onPress={() => router.push('/licencia')} />
            </Card>
          ) : (
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <FotoCampo
                etiqueta="Anverso"
                documento
                fotoId={datos.permiso.fotoAnverso}
                onChange={(fotoAnverso) => store.actualizarPermiso({ fotoAnverso })}
              />
              <FotoCampo
                etiqueta="Reverso"
                documento
                fotoId={datos.permiso.fotoReverso}
                onChange={(fotoReverso) => store.actualizarPermiso({ fotoReverso })}
              />
            </View>
          )}
        </>
      )}

      {vista === 'federacion' && (
        <>
          {hayFederacion ? (
            <Tarjeta
              tono="morado"
              etiqueta={f.nombre}
              titulo={datos.nombre || 'Carnet de federado'}
              sello="FED"
              onPress={() => router.push('/federacion')}
              pie={f.caducidadCarnet
                ? <EstadoTarjeta color={nivelColor(nivelPorDias(diasHasta(f.caducidadCarnet)))} texto={plazo(f.caducidadCarnet)} />
                : undefined}
            >
              <DatoTarjeta etiqueta="Nº de federado" valor={f.numeroFederado || '—'} />
              <DatoTarjeta etiqueta="Categoría" valor={f.categoria || '—'} />
              <DatoTarjeta etiqueta="Válido hasta" valor={f.caducidadCarnet ? formatear(f.caducidadCarnet) : '—'} />
            </Tarjeta>
          ) : (
            <Card style={{ gap: space.md }}>
              <Text style={st.titulo}>{f.nombre}</Text>
              <Text style={s.muted}>Añade tu número de federado, la foto del carnet y el QR del recinto.</Text>
              <Button title="Añadir carnet de federado" onPress={() => router.push('/federacion')} />
            </Card>
          )}
          <Card style={{ flexDirection: 'row', gap: space.sm }}>
            <FotoCampo
              etiqueta="Foto del carnet"
              documento
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

      <AvisosCalendario />
    </Screen>
  );
}

const st = StyleSheet.create({
  titulo: { color: colors.text, fontSize: 16, fontWeight: '700' },
  cabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
