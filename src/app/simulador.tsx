import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Speech from 'expo-speech';
import { Button, Card, Screen, Segmented, s } from '@/components/ui';
import { pasoEn, plan, PROGRAMAS, type Idioma, type Paso, type Programa } from '@/lib/simulador';
import { colors, radius, space } from '@/theme';

/**
 * Simulador de tirada: el móvil hace de juez y de luces. Dice las órdenes en voz alta y la
 * pantalla se pone en rojo o en verde con la cuenta atrás, para entrenar los tiempos sin campo.
 */
export default function Simulador() {
  const [programa, setPrograma] = useState<Programa>(PROGRAMAS[0]);
  const [series, setSeries] = useState(String(PROGRAMAS[0].series));
  const [idioma, setIdioma] = useState<Idioma>('es');
  const [pasos, setPasos] = useState<Paso[] | null>(null);

  if (pasos) return <EnMarcha pasos={pasos} idioma={idioma} onFin={() => setPasos(null)} />;

  return (
    <Screen title="Simulador de tirada" kicker="Entrenar" back="/entrenar">
      <Text style={s.muted}>
        El móvil da las órdenes en voz alta y hace de luces: rojo para esperar y verde para disparar. Sirve para entrenar los
        tiempos en casa (en seco) o en el campo.
      </Text>
      {PROGRAMAS.map((p) => (
        <Card
          key={p.id}
          onPress={() => {
            setPrograma(p);
            setSeries(String(p.series));
          }}
          style={[st.programa, p.id === programa.id && st.elegido]}
        >
          <Text style={s.text}>{p.nombre}</Text>
          <Text style={[s.muted, { fontSize: 13 }]}>{p.detalle}</Text>
        </Card>
      ))}
      <Text style={st.etiqueta}>Series</Text>
      <Segmented value={series} onChange={setSeries} options={['1', '2', '4', '6'].map((n) => ({ value: n, label: n }))} />
      <Text style={st.etiqueta}>Órdenes</Text>
      <Segmented value={idioma} onChange={setIdioma} options={[{ value: 'es', label: 'En español' }, { value: 'en', label: 'En inglés' }]} />
      <Button
        title="Empezar"
        onPress={() => {
          // En el iPhone la voz tiene que arrancar con un toque: se dice algo ya.
          Speech.speak(idioma === 'es' ? 'Empezamos.' : 'Starting.', { language: idioma === 'es' ? 'es-ES' : 'en-GB' });
          setPasos(plan(programa, Number(series)));
        }}
      />
      <Text style={[s.muted, { fontSize: 12 }]}>
        Quita el modo silencio del iPhone para oír las órdenes. Los tiempos siguen el reglamento de pistola ISSF (1 minuto para
        cargar, 7 segundos de luz roja en tiro rápido, 1 minuto entre series). El reglamento da las órdenes en inglés; en
        español son una traducción. Respeta siempre las normas de seguridad de tu campo.
      </Text>
    </Screen>
  );
}

function EnMarcha({ pasos, idioma, onFin }: { pasos: Paso[]; idioma: Idioma; onFin: () => void }) {
  // Pantalla siempre encendida mientras dura la tirada (en la web, solo si Safari lo permite).
  useEffect(() => {
    let activa = false;
    activateKeepAwakeAsync('simulador').then(() => { activa = true; }).catch(() => {});
    return () => {
      if (activa) deactivateKeepAwake('simulador').catch(() => {});
    };
  }, []);
  const [comienzo, setComienzo] = useState(() => Date.now());
  const [ahora, setAhora] = useState(() => Date.now());
  const dicho = useRef(-1);

  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 100);
    return () => {
      clearInterval(t);
      Speech.stop().catch(() => {});
    };
  }, []);

  const t = ahora - comienzo;
  const i = pasoEn(pasos, t);

  useEffect(() => {
    if (i === null || i === dicho.current) return;
    dicho.current = i;
    const orden = pasos[i].orden;
    if (orden) Speech.speak(orden[idioma], { language: idioma === 'es' ? 'es-ES' : 'en-GB' });
  }, [i, pasos, idioma]);

  if (i === null) {
    return (
      <Screen title="Tirada terminada" kicker="Simulador" back="/entrenar">
        <Text style={s.muted}>Buen trabajo. Apunta tus puntos en un entrenamiento si quieres guardarlos.</Text>
        <Button title="Otra tirada" onPress={onFin} />
      </Screen>
    );
  }

  const paso = pasos[i];
  const quedan = Math.ceil((paso.fin - t) / 1000);
  const siguiente = pasos[i + 1];
  const fondo = paso.luz === 'verde' ? '#0E8A4A' : paso.luz === 'roja' ? '#B3202E' : colors.bg;

  return (
    <View style={[st.marcha, { backgroundColor: fondo }]}>
      <Text style={st.rotulo}>{paso.rotulo}</Text>
      <Text style={st.cuenta}>{quedan}</Text>
      <Text style={st.siguiente}>{siguiente ? `Después: ${siguiente.rotulo}` : ''}</Text>
      <View style={st.botones}>
        {paso.saltable && (
          <Pressable style={[st.boton, st.listo]} onPress={() => setComienzo((c) => c - (paso.fin - t))}>
            <Text style={st.botonTexto}>Listo</Text>
          </Pressable>
        )}
        <Pressable style={st.boton} onPress={onFin}>
          <Text style={st.botonTexto}>Parar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  etiqueta: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  programa: { gap: 2, paddingVertical: space.md },
  elegido: { borderColor: colors.accent, borderWidth: 2 },
  marcha: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.lg },
  rotulo: { color: '#fff', fontSize: 26, fontWeight: '800', textAlign: 'center' },
  cuenta: { color: '#fff', fontSize: 140, fontWeight: '900', fontVariant: ['tabular-nums'], lineHeight: 150 },
  siguiente: { color: 'rgba(255,255,255,0.75)', fontSize: 15, textAlign: 'center', minHeight: 20 },
  botones: { flexDirection: 'row', gap: space.md, marginTop: space.xl },
  boton: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: radius.lg, backgroundColor: 'rgba(0,0,0,0.35)' },
  listo: { backgroundColor: 'rgba(255,255,255,0.22)' },
  botonTexto: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
