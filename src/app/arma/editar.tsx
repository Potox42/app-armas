import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Chips } from '@/components/Chips';
import { FotoCampo } from '@/components/FotoCampo';
import { Campo, CampoFecha, formSt } from '@/components/Formulario';
import { Button, Card, Screen, s } from '@/components/ui';
import { nuevoId, useStore } from '@/data/store';
import type { Arma, TipoArma } from '@/data/types';
import { confirmar } from '@/lib/confirmar';
import { colors, space } from '@/theme';

const TIPOS: TipoArma[] = ['Pistola', 'Revólver', 'Carabina', 'Rifle', 'Escopeta'];

export default function EditarArma() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const store = useStore();
  const existente = id ? store.arma(id) : undefined;
  const licencias = store.datos.permiso.licencias;

  const [a, setA] = useState<Arma>(existente ?? {
    id: nuevoId('arma'),
    marca: '', modelo: '', tipo: 'Pistola', calibre: '', numeroSerie: '', numeroGuia: '', fechaGuia: '',
    licenciaId: licencias[0]?.id ?? '', disparosTotales: 0, intervaloLimpieza: 500, limpiezas: [],
  });
  const [intentado, setIntentado] = useState(false);
  const cambiar = (c: Partial<Arma>) => setA((x) => ({ ...x, ...c }));

  const faltan = [
    !a.marca.trim() && 'marca',
    !a.modelo.trim() && 'modelo',
    !a.numeroGuia.trim() && 'nº de guía',
    !a.licenciaId && 'licencia',
  ].filter(Boolean) as string[];

  const guardar = () => {
    setIntentado(true);
    if (faltan.length) return;
    store.guardarArma({ ...a, marca: a.marca.trim(), modelo: a.modelo.trim() });
    router.back();
  };

  return (
    <Screen title={existente ? 'Editar arma' : 'Nueva arma'} back>
      <FotoCampo etiqueta="Foto del arma" fotoId={a.foto} onChange={(foto) => cambiar({ foto })} proporcion={2} />

      <View style={formSt.fila}>
        <View style={{ flex: 1 }}><Campo etiqueta="Marca" valor={a.marca} onChange={(marca) => cambiar({ marca })} placeholder="Walther" /></View>
        <View style={{ flex: 1 }}><Campo etiqueta="Modelo" valor={a.modelo} onChange={(modelo) => cambiar({ modelo })} placeholder="P22" /></View>
      </View>

      <Text style={st.etiqueta}>Tipo</Text>
      <Chips opciones={TIPOS.map((t) => ({ value: t, label: t }))} valor={a.tipo} onChange={(tipo) => cambiar({ tipo })} />

      <View style={formSt.fila}>
        <View style={{ flex: 1 }}><Campo etiqueta="Calibre" valor={a.calibre} onChange={(calibre) => cambiar({ calibre })} placeholder=".22 LR" /></View>
        <View style={{ flex: 1 }}><Campo etiqueta="Nº de serie" valor={a.numeroSerie} onChange={(numeroSerie) => cambiar({ numeroSerie })} /></View>
      </View>

      <Card style={{ gap: space.md }}>
        <Text style={st.titulo}>Guía de pertenencia</Text>
        <View style={formSt.fila}>
          <FotoCampo etiqueta="Anverso" documento fotoId={a.fotoGuiaAnverso} onChange={(fotoGuiaAnverso) => cambiar({ fotoGuiaAnverso })} />
          <FotoCampo etiqueta="Reverso" documento fotoId={a.fotoGuiaReverso} onChange={(fotoGuiaReverso) => cambiar({ fotoGuiaReverso })} />
        </View>
        <View style={formSt.fila}>
          <View style={{ flex: 1 }}><Campo etiqueta="Nº de guía" valor={a.numeroGuia} onChange={(numeroGuia) => cambiar({ numeroGuia })} /></View>
          <View style={{ flex: 1 }}><CampoFecha etiqueta="Fecha de expedición" valor={a.fechaGuia} onChange={(fechaGuia) => cambiar({ fechaGuia })} /></View>
        </View>
        <Text style={st.etiqueta}>Licencia a la que va asociada</Text>
        {licencias.length === 0 ? (
          <Text style={s.muted}>Primero añade tus licencias en Cartera.</Text>
        ) : (
          <Chips
            opciones={licencias.map((l) => ({ value: l.id, label: `Licencia ${l.tipo}` }))}
            valor={a.licenciaId}
            onChange={(licenciaId) => cambiar({ licenciaId })}
          />
        )}
      </Card>

      <View style={formSt.fila}>
        <View style={{ flex: 1 }}>
          <Campo
            etiqueta="Disparos acumulados"
            valor={String(a.disparosTotales)}
            teclado="number-pad"
            onChange={(t) => cambiar({ disparosTotales: Number(t.replace(/\D/g, '')) || 0 })}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Campo
            etiqueta="Limpiar cada (disparos)"
            valor={String(a.intervaloLimpieza)}
            teclado="number-pad"
            onChange={(t) => cambiar({ intervaloLimpieza: Number(t.replace(/\D/g, '')) || 0 })}
          />
        </View>
      </View>

      {intentado && faltan.length > 0 && (
        <Text style={{ color: colors.red }}>Falta: {faltan.join(', ')}.</Text>
      )}
      <Button title="Guardar" onPress={guardar} />
      {existente && (
        <Button
          title="Borrar arma"
          variant="secondary"
          onPress={() => confirmar('Borrar arma', `Se borrará ${a.marca} ${a.modelo} y su historial de limpiezas.`, () => {
            store.borrarArma(a.id);
            router.replace('/armas');
          })}
        />
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  etiqueta: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  titulo: { color: colors.text, fontSize: 16, fontWeight: '700' },
});
