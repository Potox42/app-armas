import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { volver } from '@/lib/volver';
import { Chips } from '@/components/Chips';
import { Campo, CampoFecha, formSt } from '@/components/Formulario';
import { FotoCampo } from '@/components/FotoCampo';
import { Button, Card, Screen, s } from '@/components/ui';
import { nuevoId, useStore } from '@/data/store';
import type { Licencia, TipoLicencia } from '@/data/types';
import { confirmar } from '@/lib/confirmar';
import { formatear, sumarAnios } from '@/lib/fechas';
import { combinar, leerLicencia, type FilaLicencia } from '@/lib/leerLicencia';
import { leerTextos, ocrDisponible } from '@/lib/ocr';
import { colors, space } from '@/theme';

export default function EditarLicencia() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const store = useStore();
  const existente = store.datos.permiso.licencias.find((l) => l.id === id);
  const [l, setL] = useState<Licencia>(existente ?? { id: nuevoId('lic'), tipo: 'F', numero: '', expedicion: '', caducidad: '' });
  const [intentado, setIntentado] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; ok: boolean } | null>(null);
  // Licencias que aparecen en la tabla del reverso, para poder elegir cuál es esta ficha.
  const [filas, setFilas] = useState<FilaLicencia[]>([]);
  // Cambia al rellenar con lo leído, para que los campos de fecha muestren el valor nuevo.
  const [version, setVersion] = useState(0);
  const armas = store.datos.armas.filter((a) => a.licenciaId === l.id);

  // Las licencias F, D y E tienen 5 años de validez (Ministerio del Interior).
  const sugerida = l.expedicion ? sumarAnios(l.expedicion, 5) : '';
  const caducidad = l.caducidad || sugerida;
  const valida = !!l.numero.trim() && !!l.expedicion && !!caducidad;

  const leer = async (foto: string) => {
    if (!ocrDisponible) return;
    setLeyendo(true);
    setAviso(null);
    const textos = await leerTextos(foto);
    setLeyendo(false);
    const d = combinar(textos.map((t) => leerLicencia(t, undefined, l.tipo)));
    const encontrados = [d.tipo && 'tipo', d.numero && 'número', d.expedicion && 'expedición', d.caducidad && 'caducidad']
      .filter(Boolean) as string[];
    if (encontrados.length === 0) {
      setAviso({ ok: false, texto: 'No he podido leer los datos. Escríbelos a mano o repite la foto con más luz y más cerca.' });
      return;
    }
    // Solo se rellena lo que esté vacío, para no pisar lo que ya hayas escrito.
    // La tabla del reverso sí manda en el tipo y la caducidad: es el dato oficial de cada licencia.
    const delReverso = d.filas.length > 0;
    setL((x) => ({
      ...x,
      tipo: d.tipo ?? x.tipo,
      numero: x.numero || d.numero || '',
      expedicion: x.expedicion || d.expedicion || '',
      caducidad: (delReverso ? d.caducidad : undefined) || x.caducidad || d.caducidad || '',
    }));
    setVersion((v) => v + 1);
    setFilas(d.filas.length > 1 ? d.filas : []);
    const varias = d.filas.length > 1
      ? ` Tu tarjeta tiene ${d.filas.length} licencias: he rellenado la ${d.tipo ?? 'que caduca más tarde'}. Si no es esta, elige abajo; las demás puedes darlas de alta aparte.`
      : '';
    setAviso({ ok: true, texto: `He leído: ${encontrados.join(', ')}.${varias} Revisa que esté bien antes de guardar.` });
  };

  const usarFila = (f: FilaLicencia) => {
    setL((x) => ({ ...x, tipo: f.tipo ?? x.tipo, expedicion: f.desde, caducidad: f.hasta }));
    setVersion((v) => v + 1);
    setAviso({ ok: true, texto: `He puesto las fechas de la licencia ${f.tipo ?? `que caduca el ${formatear(f.hasta)}`}. Revisa que esté bien antes de guardar.` });
  };

  const guardar = () => {
    setIntentado(true);
    if (!valida) return;
    store.guardarLicencia({ ...l, numero: l.numero.trim(), caducidad });
    volver('/cartera');
  };

  return (
    <Screen title={existente ? `Licencia ${l.tipo}` : 'Nueva licencia'} back="/cartera">
      <Card style={{ gap: space.sm }}>
        <Text style={st.titulo}>Foto de la licencia</Text>
        <Text style={s.muted}>
          {ocrDisponible
            ? 'Escanea las dos caras y leeré el tipo y las fechas por ti.'
            : 'Escanea las dos caras para tenerlas siempre a mano.'}
        </Text>
        <View style={formSt.fila}>
          <FotoCampo
            etiqueta="Anverso"
            documento
            fotoId={l.fotoAnverso}
            onChange={(fotoAnverso) => setL((x) => ({ ...x, fotoAnverso }))}
            onEscaneado={leer}
          />
          <FotoCampo
            etiqueta="Reverso"
            documento
            fotoId={l.fotoReverso}
            onChange={(fotoReverso) => setL((x) => ({ ...x, fotoReverso }))}
            onEscaneado={leer}
          />
        </View>
        {leyendo && (
          <View style={st.fila}>
            <ActivityIndicator color={colors.accent} />
            <Text style={s.muted}>Leyendo la licencia…</Text>
          </View>
        )}
        {aviso && <Text style={{ color: aviso.ok ? colors.green : colors.orange }}>{aviso.texto}</Text>}
        {filas.length > 1 && (
          <View style={{ gap: space.xs }}>
            {filas.map((f) => (
              <Button
                key={f.hasta}
                title={`Usar licencia ${f.tipo ?? '(letra sin leer)'} · hasta ${formatear(f.hasta)}`}
                variant={f.hasta === l.caducidad ? 'primary' : 'secondary'}
                onPress={() => usarFila(f)}
              />
            ))}
          </View>
        )}
      </Card>

      <Text style={st.etiqueta}>Tipo</Text>
      <Chips
        opciones={(['F', 'D', 'E'] as TipoLicencia[]).map((t) => ({ value: t, label: `Licencia ${t}` }))}
        valor={l.tipo}
        onChange={(tipo) => setL((x) => ({ ...x, tipo }))}
      />
      <Campo etiqueta="Número" valor={l.numero} onChange={(numero) => setL((x) => ({ ...x, numero }))} />
      <CampoFecha
        key={`exp-${version}`}
        etiqueta="Fecha de expedición"
        valor={l.expedicion}
        obligatorio={intentado}
        onChange={(expedicion) => setL((x) => ({ ...x, expedicion }))}
      />
      <CampoFecha
        key={`cad-${version}`}
        etiqueta="Fecha de caducidad (si la dejas vacía, 5 años)"
        valor={l.caducidad}
        onChange={(caducidad) => setL((x) => ({ ...x, caducidad }))}
      />
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
              volver('/cartera');
            },
          )}
        />
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  etiqueta: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  titulo: { color: colors.text, fontSize: 16, fontWeight: '700' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
