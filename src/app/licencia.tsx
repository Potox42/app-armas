import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Chips } from '@/components/Chips';
import { Campo, CampoFecha } from '@/components/Formulario';
import { Button, Screen, s } from '@/components/ui';
import { nuevoId, useStore } from '@/data/store';
import type { Licencia, TipoLicencia } from '@/data/types';
import { confirmar } from '@/lib/confirmar';
import { formatear, sumarAnios } from '@/lib/fechas';
import { colors } from '@/theme';

export default function EditarLicencia() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const store = useStore();
  const existente = store.datos.permiso.licencias.find((l) => l.id === id);
  const [l, setL] = useState<Licencia>(existente ?? { id: nuevoId('lic'), tipo: 'F', numero: '', expedicion: '', caducidad: '' });
  const [intentado, setIntentado] = useState(false);
  const armas = store.datos.armas.filter((a) => a.licenciaId === l.id);

  // Las licencias F, D y E tienen 5 años de validez (Ministerio del Interior).
  const sugerida = l.expedicion ? sumarAnios(l.expedicion, 5) : '';
  const caducidad = l.caducidad || sugerida;
  const valida = !!l.numero.trim() && !!l.expedicion && !!caducidad;

  const guardar = () => {
    setIntentado(true);
    if (!valida) return;
    store.guardarLicencia({ ...l, numero: l.numero.trim(), caducidad });
    router.back();
  };

  return (
    <Screen title={existente ? `Licencia ${l.tipo}` : 'Nueva licencia'} back>
      <Text style={st.etiqueta}>Tipo</Text>
      <Chips
        opciones={(['F', 'D', 'E'] as TipoLicencia[]).map((t) => ({ value: t, label: `Licencia ${t}` }))}
        valor={l.tipo}
        onChange={(tipo) => setL({ ...l, tipo })}
      />
      <Campo etiqueta="Número" valor={l.numero} onChange={(numero) => setL({ ...l, numero })} />
      <CampoFecha etiqueta="Fecha de expedición" valor={l.expedicion} obligatorio={intentado} onChange={(expedicion) => setL({ ...l, expedicion })} />
      <CampoFecha etiqueta="Fecha de caducidad (si la dejas vacía, 5 años)" valor={l.caducidad} onChange={(c) => setL({ ...l, caducidad: c })} />
      {!l.caducidad && sugerida && <Text style={s.muted}>Caducará el {formatear(sugerida)}.</Text>}
      {intentado && !valida && <Text style={{ color: colors.red }}>Faltan el número o la fecha de expedición.</Text>}
      <Button title="Guardar" onPress={guardar} />
      {existente && (
        <Button
          title="Borrar licencia"
          variant="secondary"
          onPress={() => confirmar(
            'Borrar licencia',
            armas.length
              ? `Hay ${armas.length} arma(s) asociadas a esta licencia. Tendrás que asignarles otra.`
              : 'Se borrará esta licencia.',
            () => {
              store.borrarLicencia(l.id);
              router.back();
            },
          )}
        />
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  etiqueta: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
});
