import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Chips } from '@/components/Chips';
import { Campo, CampoFecha, formSt } from '@/components/Formulario';
import { Button, Card, Screen, s } from '@/components/ui';
import { nuevoId, useStore } from '@/data/store';
import type { Competicion } from '@/data/types';
import { abrirEnCalendario } from '@/lib/archivo';
import { archivoCalendario, CATEGORIAS, competiciones, deHora, MODALIDADES } from '@/lib/competiciones';
import { confirmar } from '@/lib/confirmar';
import { volver } from '@/lib/volver';
import { colors, space } from '@/theme';

/** Alta y edición de una competición: día, hora, tipo, modalidad, lugar y si te has apuntado. */
export default function EditarCompeticion() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const store = useStore();
  const existente = id ? competiciones(store.datos).find((c) => c.id === id) : undefined;

  const [c, setC] = useState<Competicion>(existente ?? {
    id: nuevoId('competicion'), fecha: '', categoria: 'Preparatoria', modalidad: '', inscrito: true,
  });
  const [horaTexto, setHoraTexto] = useState(existente?.hora ?? '');
  const [intentado, setIntentado] = useState(false);
  const cambiar = (x: Partial<Competicion>) => setC((v) => ({ ...v, ...x }));

  const hora = deHora(horaTexto);
  const errorHora = horaTexto.trim() && !hora ? 'Escribe la hora como 9:30' : undefined;
  const faltan = [!c.fecha && 'día', !c.modalidad.trim() && 'modalidad'].filter(Boolean) as string[];
  const final = (): Competicion => ({
    ...c, modalidad: c.modalidad.trim(), hora: hora ?? undefined,
    lugar: c.lugar?.trim() || undefined, notas: c.notas?.trim() || undefined,
  });

  const guardar = () => {
    setIntentado(true);
    if (faltan.length || errorHora) return;
    store.guardarCompeticion(final());
    volver('/competiciones');
  };

  const alCalendario = () => {
    setIntentado(true);
    if (faltan.length || errorHora) return;
    const lista = final();
    store.guardarCompeticion(lista);
    abrirEnCalendario('competicion.ics', archivoCalendario(lista)).catch((e) => console.error('No se pudo abrir el calendario', e));
  };

  return (
    <Screen title={existente ? 'Competición' : 'Nueva competición'} kicker="Calendario" back="/competiciones">
      <View style={formSt.fila}>
        <View style={{ flex: 1.3 }}>
          <CampoFecha etiqueta="Día" valor={c.fecha} onChange={(fecha) => cambiar({ fecha })} obligatorio={intentado} />
        </View>
        <View style={{ flex: 1 }}>
          <Campo etiqueta="Hora" valor={horaTexto} onChange={setHoraTexto} placeholder="9:00" teclado="numbers-and-punctuation" error={errorHora} />
        </View>
      </View>

      <Text style={st.etiqueta}>Tipo</Text>
      <Chips opciones={CATEGORIAS.map((x) => ({ value: x, label: x }))} valor={c.categoria} onChange={(categoria) => cambiar({ categoria })} />

      <Campo
        etiqueta="Modalidad"
        valor={c.modalidad}
        onChange={(modalidad) => cambiar({ modalidad })}
        placeholder="Pistola 25 m"
        error={intentado && !c.modalidad.trim() ? 'Elige o escribe la modalidad' : undefined}
      />
      <Chips
        opciones={MODALIDADES.map((x) => ({ value: x, label: x }))}
        valor={MODALIDADES.find((m) => m === c.modalidad)}
        onChange={(modalidad) => cambiar({ modalidad })}
      />

      <Campo etiqueta="Lugar (opcional)" valor={c.lugar ?? ''} onChange={(lugar) => cambiar({ lugar })} placeholder="Campo de tiro" />
      <Campo etiqueta="Notas (opcional)" valor={c.notas ?? ''} onChange={(notas) => cambiar({ notas })} placeholder="Dorsal, tanda, puesto…" />

      <Card style={st.apuntado}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.text}>Me he apuntado</Text>
          <Text style={[s.muted, { fontSize: 13 }]}>Las competiciones a las que estás apuntado tienen aviso.</Text>
        </View>
        <Switch
          value={c.inscrito}
          onValueChange={(inscrito) => cambiar({ inscrito })}
          trackColor={{ true: colors.green, false: colors.cardAlt }}
        />
      </Card>

      {intentado && faltan.length > 0 && <Text style={{ color: colors.red }}>Falta: {faltan.join(', ')}.</Text>}
      <Button title="Guardar" onPress={guardar} />
      {c.inscrito && <Button title="Añadir al calendario del iPhone" variant="secondary" onPress={alCalendario} />}
      {c.inscrito && (
        <Text style={[s.muted, { fontSize: 13 }]}>
          Se añade a la app Calendario con dos avisos: el día antes y 2 horas antes de empezar (si no pones hora, el
          mismo día por la mañana).
        </Text>
      )}
      {existente && (
        <Button
          title="Borrar competición"
          variant="secondary"
          onPress={() =>
            confirmar('Borrar competición', `Se borrará ${existente.modalidad} del calendario.`, () => {
              store.borrarCompeticion(existente.id);
              router.replace('/competiciones');
            })
          }
        />
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  etiqueta: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  apuntado: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
