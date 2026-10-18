import { useState } from 'react';
import { Platform, Switch, Text, View } from 'react-native';
import { Button, Card, Screen, Segmented, s } from '@/components/ui';
import { useStore } from '@/data/store';
import { exportarPdf } from '@/lib/imprimir';
import { haceUnAnio, informeHtml } from '@/lib/informe';
import { colors, space } from '@/theme';

/** Exportar a PDF: papeles e inventario de armas, y el historial de competiciones y entrenamientos. */
export default function Informe() {
  const { datos } = useStore();
  const [papeles, setPapeles] = useState(true);
  const [deportivo, setDeportivo] = useState(true);
  const [periodo, setPeriodo] = useState<'anio' | 'todo'>('anio');
  const [ocultarNumeros, setOcultarNumeros] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const crear = () => {
    setError(null);
    const html = informeHtml(datos, { papeles, deportivo, desde: periodo === 'anio' ? haceUnAnio() : null, ocultarNumeros });
    exportarPdf(html).catch((e) => {
      console.error('No se pudo crear el PDF', e);
      setError('No se ha podido crear el PDF. Inténtalo de nuevo.');
    });
  };

  return (
    <Screen title="Exportar a PDF" kicker="Informe" back="/perfil">
      <Card style={{ gap: space.lg }}>
        <Opcion titulo="Papeles e inventario" detalle="Licencias, otros papeles, armas con su guía, disparos y munición." valor={papeles} onChange={setPapeles} />
        <Opcion titulo="Historial deportivo" detalle="Competiciones en las que participaste y entrenamientos." valor={deportivo} onChange={setDeportivo} />
        {deportivo && (
          <Segmented value={periodo} onChange={setPeriodo} options={[{ value: 'anio', label: 'Último año' }, { value: 'todo', label: 'Todo' }]} />
        )}
        <Opcion
          titulo="Ocultar NIF y números"
          detalle="El NIF, los números de guía y de identificación y las pólizas salen tapados salvo las últimas cifras. Quítalo solo si el PDF es para ti."
          valor={ocultarNumeros}
          onChange={setOcultarNumeros}
        />
      </Card>
      <Button title="Crear PDF" onPress={crear} />
      {error && <Text style={{ color: colors.red }}>{error}</Text>}
      <Text style={[s.muted, { fontSize: 13 }]}>
        {Platform.OS === 'web'
          ? 'Se abre el menú de imprimir. Para guardarlo como PDF en el iPhone, toca el botón Compartir de arriba y elige «Guardar en Archivos».'
          : 'Se abre el menú de compartir: guárdalo en Archivos, mándalo por correo o imprímelo.'}
      </Text>
      <Text style={[s.muted, { fontSize: 12 }]}>El PDF recoge lo que has apuntado en la app; no es un documento oficial.</Text>
    </Screen>
  );
}

function Opcion({ titulo, detalle, valor, onChange }: { titulo: string; detalle: string; valor: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.text}>{titulo}</Text>
        <Text style={[s.muted, { fontSize: 13 }]}>{detalle}</Text>
      </View>
      <Switch value={valor} onValueChange={onChange} trackColor={{ true: colors.accent, false: colors.border }} />
    </View>
  );
}
