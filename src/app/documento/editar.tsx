import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Chips } from '@/components/Chips';
import { Campo, CampoFecha } from '@/components/Formulario';
import { FotoCampo } from '@/components/FotoCampo';
import { Button, Screen } from '@/components/ui';
import { nuevoId, useStore } from '@/data/store';
import type { Documento, TipoDocumento } from '@/data/types';
import { confirmar } from '@/lib/confirmar';
import { volver } from '@/lib/volver';
import { colors, space } from '@/theme';

const TIPOS: TipoDocumento[] = ['DNI', 'Seguro', 'Certificado médico', 'Otro'];
const NOMBRE: Record<TipoDocumento, string> = { DNI: 'DNI', Seguro: 'Seguro', 'Certificado médico': 'Certificado médico', Otro: '' };

/** Alta y edición de otros papeles: seguro, certificado médico o lo que quieras tener a mano. */
export default function EditarDocumento() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const store = useStore();
  const existente = id ? (store.datos.documentos ?? []).find((d) => d.id === id) : undefined;
  const [d, setD] = useState<Documento>(existente ?? { id: nuevoId('doc'), tipo: 'Seguro', nombre: 'Seguro' });
  const [intentado, setIntentado] = useState(false);
  const cambiar = (x: Partial<Documento>) => setD((v) => ({ ...v, ...x }));

  const guardar = () => {
    setIntentado(true);
    if (!d.nombre.trim()) return;
    store.guardarDocumento({
      ...d, nombre: d.nombre.trim(), numero: d.numero?.trim() || undefined, nota: d.nota?.trim() || undefined,
      caducidad: d.caducidad || undefined,
    });
    volver('/cartera');
  };

  return (
    <Screen title={existente ? d.nombre || 'Documento' : 'Nuevo documento'} kicker="Otros papeles" back="/cartera">
      <Text style={st.etiqueta}>Tipo</Text>
      <Chips
        opciones={TIPOS.map((t) => ({ value: t, label: t }))}
        valor={d.tipo}
        onChange={(tipo) => cambiar({ tipo, nombre: !d.nombre || d.nombre === NOMBRE[d.tipo] ? NOMBRE[tipo] : d.nombre })}
      />
      <Campo
        etiqueta="Nombre"
        valor={d.nombre}
        onChange={(nombre) => cambiar({ nombre })}
        placeholder="Seguro de la federación, certificado médico…"
        error={intentado && !d.nombre.trim() ? 'Escribe un nombre' : undefined}
      />
      <Campo etiqueta={d.tipo === 'Seguro' ? 'Nº de póliza (opcional)' : 'Número (opcional)'} valor={d.numero ?? ''} onChange={(numero) => cambiar({ numero })} />
      <CampoFecha etiqueta="Válido hasta (opcional)" valor={d.caducidad ?? ''} onChange={(caducidad) => cambiar({ caducidad })} />
      <Text style={[st.etiqueta, { fontWeight: '400' }]}>Con fecha, te aviso antes de que caduque, igual que con la licencia.</Text>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <FotoCampo etiqueta="Anverso" documento fotoId={d.foto} onChange={(foto) => cambiar({ foto })} />
        <FotoCampo etiqueta="Reverso (opcional)" documento fotoId={d.fotoReverso} onChange={(fotoReverso) => cambiar({ fotoReverso })} />
      </View>
      <Campo etiqueta="Nota (opcional)" valor={d.nota ?? ''} onChange={(nota) => cambiar({ nota })} placeholder="Compañía, teléfono de asistencia…" />
      <Button title="Guardar" onPress={guardar} />
      {existente && (
        <Button
          title="Borrar documento"
          variant="secondary"
          onPress={() =>
            confirmar('Borrar documento', `Se borrará «${existente.nombre}».`, () => {
              store.borrarDocumento(existente.id);
              router.replace('/cartera');
            })
          }
        />
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  etiqueta: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
});
