import { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { Diana } from '@/components/Diana';
import { Button, Card, Screen, Segmented, s } from '@/components/ui';
import { DIANAS, type IdDiana } from '@/lib/diana';
import { DISTANCIA_OFICIAL, htmlDianas, planDiana } from '@/lib/dianasImprimir';
import { exportarPdf } from '@/lib/imprimir';
import { colors, space } from '@/theme';

const MODELOS: IdDiana[] = ['precision', 'rapido', 'airePistola', 'aireCarabina'];
const CORTO: Record<IdDiana, string> = {
  precision: 'Precisión 25/50 m',
  rapido: 'Tiro rápido 25 m',
  airePistola: 'Pistola aire 10 m',
  aireCarabina: 'Carabina aire 10 m',
};
// Distancias de práctica que tienen sentido para cada diana (menores que la oficial).
const REDUCIDAS: Record<IdDiana, number[]> = { precision: [10, 15, 20], rapido: [10, 15, 20], airePistola: [5, 7], aireCarabina: [5, 7] };

/** Dianas ISSF para imprimir, a tamaño real o reducidas para tirar a menos distancia, con barra de 10 cm. */
export default function Dianas() {
  const [id, setId] = useState<IdDiana>('precision');
  const [modo, setModo] = useState<'real' | 'reducida'>('real');
  const [distancia, setDistancia] = useState<number>(REDUCIDAS.precision[0]);
  const [copias, setCopias] = useState('1');
  const [error, setError] = useState<string | null>(null);

  const elegirModelo = (v: IdDiana) => {
    setId(v);
    setDistancia(REDUCIDAS[v][0]);
  };
  const dist = modo === 'real' ? DISTANCIA_OFICIAL[id] : distancia;
  const plan = planDiana({ id, distancia: dist, copias: Number(copias) });

  const imprimir = () => {
    setError(null);
    exportarPdf(htmlDianas({ id, distancia: dist, copias: Number(copias) })).catch((e) => {
      console.error('No se pudo crear el PDF de dianas', e);
      setError('No se ha podido crear el PDF. Inténtalo de nuevo.');
    });
  };

  return (
    <Screen title="Dianas para imprimir" kicker="Entrenar" back="/entrenar">
      <Card style={{ gap: space.md }}>
        <Text style={s.text}>Diana</Text>
        <Chips opciones={MODELOS.map((m) => ({ value: m, label: CORTO[m] }))} valor={id} onChange={elegirModelo} />
        <Text style={s.text}>Tamaño</Text>
        <Segmented
          value={modo}
          onChange={setModo}
          options={[{ value: 'real', label: 'Tamaño real' }, { value: 'reducida', label: 'Reducida' }]}
        />
        {modo === 'reducida' && (
          <>
            <Text style={s.muted}>¿A qué distancia vas a tirar? Se reduce en la misma proporción para que la veas del mismo tamaño.</Text>
            <Chips
              opciones={REDUCIDAS[id].map((d) => ({ value: String(d), label: `${d} m` }))}
              valor={String(distancia)}
              onChange={(v) => setDistancia(Number(v))}
            />
          </>
        )}
        <Text style={s.text}>Hojas</Text>
        <Chips opciones={['1', '2', '3', '5', '10'].map((n) => ({ value: n, label: n }))} valor={copias} onChange={setCopias} />
      </Card>

      <View style={{ alignItems: 'center' }}>
        <Diana tamano={200} modelo={DIANAS[id]} disparos={[]} />
      </View>
      <Card style={{ gap: space.sm }}>
        <Text style={s.text}>{plan.texto}</Text>
        <Text style={[s.muted, { fontSize: 13 }]}>
          Diámetro impreso: {Math.round(plan.diametro)} mm. Cada hoja lleva una barra de 10 cm: mídela con una regla para
          comprobar que la impresora no ha cambiado la escala.
        </Text>
      </Card>
      <Button title="Imprimir o guardar PDF" onPress={imprimir} />
      {error && <Text style={{ color: colors.red }}>{error}</Text>}
      <Text style={[s.muted, { fontSize: 13 }]}>
        {Platform.OS === 'web'
          ? 'Se abre el menú de imprimir. Elige escala 100 % (sin «Ajustar a la página»). Para guardarla como PDF en el iPhone, toca Compartir y «Guardar en Archivos».'
          : 'Se abre el menú de compartir: imprímela o guárdala en Archivos. Imprime siempre al 100 %.'}
      </Text>
      <Text style={[s.muted, { fontSize: 12 }]}>Para entrenar. No es una diana homologada para competición.</Text>
    </Screen>
  );
}
