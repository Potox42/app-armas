import { useEffect, useRef, useState } from 'react';
import { SoloPro, useLicenciaApp } from '@/components/Activacion';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Speech from 'expo-speech';
import { Chips } from '@/components/Chips';
import { Campo } from '@/components/Formulario';
import { Button, Card, Screen, Segmented, s } from '@/components/ui';
import { useStore } from '@/data/store';
import { pitar, prepararPitidos } from '@/lib/pitidos';
import { pasoEn, plan, PROGRAMAS, type Idioma, type Paso, type Programa } from '@/lib/simulador';
import { colors, radius, space } from '@/theme';

/**
 * Simulador de tirada: el móvil hace de juez y de luces. Dice las órdenes en voz alta y la
 * pantalla se pone en rojo o en verde con la cuenta atrás, para entrenar los tiempos sin campo.
 */
export default function Simulador() {
  const { esPro } = useLicenciaApp();
  if (!esPro) {
    return (
      <Screen title="Simulador de tirada" kicker="Entrenar" back="/entrenar">
        <SoloPro que="El simulador de tirada" />
      </Screen>
    );
  }
  return <SimuladorPro />;
}

function SimuladorPro() {
  const [programa, setPrograma] = useState<Programa>(PROGRAMAS[0]);
  const [series, setSeries] = useState(String(PROGRAMAS[0].series));
  const [idioma, setIdioma] = useState<Idioma>('es');
  const [sonido, setSonido] = useState<Sonido>('ambos');
  const [pasos, setPasos] = useState<Paso[] | null>(null);

  if (pasos) return <EnMarcha pasos={pasos} idioma={idioma} sonido={sonido} disparos={5 * Number(series)} onFin={() => setPasos(null)} />;

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
      {Platform.OS === 'web' && (
        <>
          <Text style={st.etiqueta}>Sonido</Text>
          <Segmented
            value={sonido}
            onChange={setSonido}
            options={[{ value: 'ambos', label: 'Voz y pitidos' }, { value: 'voz', label: 'Solo voz' }, { value: 'pitidos', label: 'Solo pitidos' }]}
          />
          <Text style={[s.muted, { fontSize: 12 }]}>
            Pitido largo agudo: fuego. Dos pitidos graves: alto. Pip cada segundo: faltan 3 s para acabar la preparación o la
            pausa. Tres pips rápidos: quedan 30 s de la serie (solo en 150 s y precisión).
          </Text>
        </>
      )}
      <Button
        title="Empezar"
        onPress={() => {
          // En el iPhone la voz y el audio tienen que arrancar con un toque: se preparan aquí.
          prepararPitidos();
          if (sonido !== 'pitidos') Speech.speak(idioma === 'es' ? 'Empezamos.' : 'Starting.', { language: idioma === 'es' ? 'es-ES' : 'en-GB' });
          else pitar('cuenta');
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

type Sonido = 'ambos' | 'voz' | 'pitidos';

function EnMarcha({ pasos, idioma, sonido, disparos, onFin }: { pasos: Paso[]; idioma: Idioma; sonido: Sonido; disparos: number; onFin: () => void }) {
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
  const [parado, setParado] = useState(false); // «Parar»: también se pregunta por los disparos
  const dicho = useRef(-1);
  const pitado = useRef('');

  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 100);
    return () => {
      clearInterval(t);
      Speech.stop().catch(() => {});
    };
  }, []);

  const t = ahora - comienzo;
  const i = pasoEn(pasos, t);

  const voz = sonido !== 'pitidos';
  const pitidos = sonido !== 'voz';

  useEffect(() => {
    // El último paso dura 1 ms y casi nunca coincide con el reloj: al terminar se anuncia igual.
    if (parado) return;
    const k = i ?? pasos.length - 1;
    if (k === dicho.current) return;
    dicho.current = k;
    const orden = pasos[k].orden;
    if (voz && orden) Speech.speak(orden[idioma], { language: idioma === 'es' ? 'es-ES' : 'en-GB' });
    if (pitidos) {
      if (pasos[k].luz === 'verde') pitar('fuego');
      else if (pasos[k - 1]?.luz === 'verde') pitar('alto');
    }
  }, [i, pasos, idioma, voz, pitidos, parado]);

  // Avisos de tiempo: cuenta atrás de 3 s antes de acabar la preparación o la pausa, y aviso a
  // falta de 30 s en las series largas.
  const restante = i === null ? 0 : Math.ceil((pasos[i].fin - t) / 1000);
  useEffect(() => {
    if (i === null || !pitidos || parado) return;
    const p = pasos[i];
    const clave = `${i}:${restante}`;
    if (clave === pitado.current) return;
    pitado.current = clave;
    if (p.luz === 'nada' && p.saltable && restante >= 1 && restante <= 3) pitar('cuenta');
    else if (p.luz === 'verde' && p.fin - p.inicio >= 60_000 && restante === 30) pitar('aviso');
  }, [i, restante, pasos, pitidos, parado]);

  if (i === null || parado) {
    return (
      <Screen title={parado ? 'Tirada parada' : 'Tirada terminada'} kicker="Simulador" back="/entrenar">
        <Text style={s.muted}>Buen trabajo. Apunta tus puntos en un entrenamiento si quieres guardarlos.</Text>
        <ApuntarDisparos previstos={disparos} />
        <Button title="Otra tirada" onPress={onFin} />
      </Screen>
    );
  }

  const paso = pasos[i];
  const quedan = restante;
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
        <Pressable
          style={st.boton}
          onPress={() => {
            Speech.stop().catch(() => {});
            setParado(true);
          }}
        >
          <Text style={st.botonTexto}>Parar</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Al acabar la tirada: si se ha tirado con munición (no en seco), los disparos se suman al arma
 * (para el aviso de limpieza) y, si los cartuchos eran de casa, se restan de su munición. Igual que
 * al terminar un entrenamiento; nada se apunta sin que el tirador lo diga.
 */
function ApuntarDisparos({ previstos }: { previstos: number }) {
  const store = useStore();
  const { armas, sesiones } = store.datos;
  // Por defecto, el arma del último entrenamiento.
  const ultima = [...sesiones].sort((a, b) => b.fecha.localeCompare(a.fecha))[0]?.armaId;
  const [fuego, setFuego] = useState<'seco' | 'si' | undefined>(undefined);
  const [armaId, setArmaId] = useState<string | undefined>(armas.find((a) => a.id === ultima)?.id ?? armas[0]?.id);
  const [cuantos, setCuantos] = useState(String(previstos));
  const [origen, setOrigen] = useState<'club' | 'casa'>('club');
  const [hecho, setHecho] = useState<{ armaId: string; n: number; casa: boolean; fecha: string } | null>(null);
  const arma = armas.find((a) => a.id === (hecho?.armaId ?? armaId));
  const nombre = arma ? `${arma.marca} ${arma.modelo}`.trim() : '';
  const n = Math.max(0, Math.round(Number(cuantos.replace(',', '.')) || 0));
  const NOTA = 'Simulador de tirada';

  if (hecho) {
    return (
      <Card style={{ gap: space.sm }}>
        <Text style={s.text}>
          Apuntados {hecho.n} disparos a {nombre}{hecho.casa ? ' y restados de la munición de casa' : ''}.
        </Text>
        <Pressable
          hitSlop={10}
          onPress={() => {
            store.sumarDisparos(hecho.armaId, -hecho.n);
            if (hecho.casa) {
              const m = store.arma(hecho.armaId)?.municion?.find((x) => x.tipo === 'gasto' && x.nota === NOTA && x.cartuchos === hecho.n && x.fecha === hecho.fecha);
              if (m) store.borrarMunicion(hecho.armaId, m.id);
            }
            setHecho(null);
          }}
        >
          <Text style={{ color: colors.accent, fontWeight: '700' }}>Deshacer</Text>
        </Pressable>
      </Card>
    );
  }
  if (!armas.length) return null;
  return (
    <Card style={{ gap: space.md, borderColor: colors.accent }}>
      <Text style={s.text}>¿Has disparado con munición? Si es así, los disparos cuentan para la limpieza del arma.</Text>
      <Segmented
        value={fuego ?? ('' as 'seco')}
        onChange={setFuego}
        options={[{ value: 'seco', label: 'No, en seco' }, { value: 'si', label: 'Sí, con munición' }]}
      />
      {fuego === 'seco' && <Text style={s.muted}>No se apunta nada.</Text>}
      {fuego === 'si' && (
        <>
          <Text style={st.etiqueta}>Arma</Text>
          <Chips opciones={armas.map((a) => ({ value: a.id, label: `${a.marca} ${a.modelo}`.trim() }))} valor={armaId} onChange={setArmaId} />
          <Campo etiqueta="Disparos" valor={cuantos} onChange={setCuantos} teclado="number-pad" />
          <Text style={st.etiqueta}>Munición</Text>
          <Segmented value={origen} onChange={setOrigen} options={[{ value: 'club', label: 'Del club' }, { value: 'casa', label: 'De casa (restar)' }]} />
          <Button
            title={`Apuntar ${n} disparos`}
            onPress={() => {
              if (!armaId || !n) return;
              const h = new Date();
              const fecha = `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
              store.sumarDisparos(armaId, n);
              if (origen === 'casa') store.anadirMunicion(armaId, { fecha, tipo: 'gasto', cartuchos: n, nota: NOTA });
              setHecho({ armaId, n, casa: origen === 'casa', fecha });
            }}
          />
        </>
      )}
    </Card>
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
