import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { FotoCampo } from '@/components/FotoCampo';
import { Campo, CampoFecha, formSt } from '@/components/Formulario';
import { Button, Card, Screen } from '@/components/ui';
import { useStore } from '@/data/store';
import type { Federacion } from '@/data/types';
import { colors, space } from '@/theme';

export default function EditarFederacion() {
  const store = useStore();
  const [f, setF] = useState<Federacion>(store.datos.federacion);
  const cambiar = (c: Partial<Federacion>) => setF((x) => ({ ...x, ...c }));

  return (
    <Screen title="Federación" back>
      <Campo etiqueta="Federación" valor={f.nombre} onChange={(nombre) => cambiar({ nombre })} />
      <Card style={{ gap: space.md }}>
        <Text style={st.titulo}>Carnet de federado</Text>
        <FotoCampo etiqueta="Foto del carnet" fotoId={f.fotoCarnet} onChange={(fotoCarnet) => cambiar({ fotoCarnet })} />
        <View style={formSt.fila}>
          <View style={{ flex: 1 }}><Campo etiqueta="Nº de federado" valor={f.numeroFederado} onChange={(numeroFederado) => cambiar({ numeroFederado })} /></View>
          <View style={{ flex: 1 }}><Campo etiqueta="Categoría" valor={f.categoria} onChange={(categoria) => cambiar({ categoria })} placeholder="Senior" /></View>
        </View>
        <CampoFecha etiqueta="Válido hasta" valor={f.caducidadCarnet} onChange={(caducidadCarnet) => cambiar({ caducidadCarnet })} />
      </Card>
      <Card style={{ gap: space.md }}>
        <Text style={st.titulo}>Pase de acceso al recinto</Text>
        <Text style={{ color: colors.textMuted }}>Haz una captura del QR en la app o web de la federación y elígela aquí.</Text>
        <View style={{ width: '60%', alignSelf: 'center' }}>
          <FotoCampo etiqueta="Captura del QR" fotoId={f.fotoQr} onChange={(fotoQr) => cambiar({ fotoQr })} proporcion={1} />
        </View>
        <Campo etiqueta="Código del pase (opcional)" valor={f.codigoPase} onChange={(codigoPase) => cambiar({ codigoPase })} />
        <CampoFecha etiqueta="Pase válido hasta" valor={f.caducidadPase} onChange={(caducidadPase) => cambiar({ caducidadPase })} />
      </Card>
      <Button title="Guardar" onPress={() => { store.guardarFederacion(f); router.back(); }} />
    </Screen>
  );
}

const st = StyleSheet.create({
  titulo: { color: colors.text, fontSize: 16, fontWeight: '700' },
});
