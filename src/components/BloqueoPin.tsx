import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, AppState, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { guardarFoto } from '@/data/db';
import { useStore } from '@/data/store';
import { elegirArchivo } from '@/lib/archivo';
import { abrirCopia, ErrorCopia } from '@/lib/copia';
import { bajarCopia, ErrorServidor } from '@/lib/nube';
import { comprobarPin } from '@/lib/pin';
import { colors, radius, space } from '@/theme';
import { Campo } from './Formulario';
import { Logo } from './Logo';
import { Button } from './ui';

const INTENTOS = 5; // fallos seguidos antes de esperar
const ESPERA_S = 30;

/** Versión web: si hay PIN, tapa la app al abrirla y al volver a ella hasta escribirlo. */
export function BloqueoPin() {
  const store = useStore();
  const pin = store.ajustes.pin;
  const [bloqueada, setBloqueada] = useState(!!pin);
  const [texto, setTexto] = useState('');
  const [fallos, setFallos] = useState(0);
  const [espera, setEspera] = useState(0);
  const [olvidado, setOlvidado] = useState(false);
  const campo = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    if (!pin) return;
    const sub = AppState.addEventListener('change', (e) => {
      if (e === 'background') {
        setBloqueada(true);
        setTexto('');
        setOlvidado(false);
      }
    });
    return () => sub.remove();
  }, [pin]);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  if (!pin || !bloqueada) return null;

  const escribir = (t: string) => {
    const limpio = t.replace(/\D/g, '').slice(0, pin.largo);
    setTexto(limpio);
    if (limpio.length < pin.largo) return;
    if (comprobarPin(pin, limpio)) {
      setBloqueada(false);
      setFallos(0);
      setTexto('');
      return;
    }
    const n = fallos + 1;
    setFallos(n);
    setTexto('');
    if (n % INTENTOS === 0) setEspera(ESPERA_S);
  };

  const entrar = () => {
    setBloqueada(false);
    setOlvidado(false);
    setFallos(0);
    setTexto('');
  };

  if (olvidado) return <PinOlvidado onVolver={() => setOlvidado(false)} onEntrar={entrar} />;

  return (
    <View style={st.tapa}>
      <Logo size={72} />
      <Text style={st.titulo}>Tirador Deportivo</Text>
      <Text style={st.texto}>{espera > 0 ? `Demasiados intentos. Espera ${espera} s.` : 'Escribe tu PIN'}</Text>
      <View style={st.puntos}>
        {Array.from({ length: pin.largo }, (_, i) => (
          <View key={i} style={[st.punto, i < texto.length && st.lleno]} />
        ))}
      </View>
      <TextInput
        ref={campo}
        value={texto}
        onChangeText={escribir}
        editable={espera <= 0}
        autoFocus
        keyboardType="number-pad"
        secureTextEntry
        maxLength={pin.largo}
        accessibilityLabel="PIN"
        style={st.campo}
      />
      {fallos > 0 && espera <= 0 && <Text style={{ color: colors.red }}>PIN incorrecto</Text>}
      <View style={{ alignSelf: 'stretch', gap: space.sm, marginTop: space.lg }}>
        <Button title="Escribir el PIN" variant="secondary" onPress={() => campo.current?.focus()} />
        <Button title="He olvidado el PIN" variant="secondary" onPress={() => setOlvidado(true)} />
      </View>
    </View>
  );
}

/**
 * PIN olvidado: se entra recuperando una copia de seguridad (archivo .tirador o tu servidor) con su
 * contraseña. Borrar todo solo se hace escribiendo BORRAR, y aun así los datos se apartan antes: si
 * más tarde recuerdas el PIN, se recuperan en Perfil › Copia de seguridad.
 */
function PinOlvidado({ onVolver, onEntrar }: { onVolver: () => void; onEntrar: () => void }) {
  const store = useStore();
  const nube = store.ajustes.nube;
  const [archivo, setArchivo] = useState<string | null>(null);
  const [contrasena, setContrasena] = useState('');
  const [borrar, setBorrar] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fallo = (e: unknown, porDefecto: string) =>
    setError(e instanceof ErrorServidor || e instanceof ErrorCopia ? e.message : porDefecto);

  const elegir = async () => {
    setError(null);
    try {
      setArchivo(await elegirArchivo());
    } catch {
      setError('No se pudo leer el archivo.');
    }
  };

  const delServidor = async () => {
    if (!nube) return;
    setError(null);
    setOcupado('Descargando la copia de tu servidor…');
    try {
      setArchivo(await bajarCopia(nube));
    } catch (e) {
      fallo(e, 'No se pudo descargar la copia.');
    } finally {
      setOcupado(null);
    }
  };

  const restaurar = async () => {
    if (!archivo) return;
    setError(null);
    setOcupado('Descifrando la copia…');
    try {
      const { datos, fotos } = await abrirCopia(archivo, contrasena);
      setOcupado('Recuperando tus datos…');
      for (const [id, f] of Object.entries(fotos)) await guardarFoto(id, f);
      await store.restaurar(datos);
      store.guardarAjustes({ pin: undefined });
      onEntrar();
    } catch (e) {
      fallo(e, 'No se pudo abrir la copia.');
    } finally {
      setOcupado(null);
    }
  };

  const borrarTodo = async () => {
    await store.empezarDeCero();
    store.guardarAjustes({ pin: undefined });
    onEntrar();
  };

  return (
    <ScrollView style={st.tapaScroll} contentContainerStyle={st.olvidado} keyboardShouldPersistTaps="handled">
      <Text style={st.titulo}>He olvidado el PIN</Text>
      <Text style={st.texto}>
        Tus datos siguen guardados en este móvil y no se borran. Para entrar sin el PIN, recupera tu copia de seguridad
        con su contraseña.
      </Text>

      {!archivo ? (
        <View style={{ gap: space.sm }}>
          {nube && <Button title="Traer la copia de mi servidor" onPress={delServidor} />}
          <Button title="Elegir archivo .tirador" variant={nube ? 'secondary' : 'primary'} onPress={elegir} />
        </View>
      ) : (
        <View style={{ gap: space.sm }}>
          <Text style={st.texto}>Copia lista. Escribe su contraseña (la que pusiste al crear la copia, no el PIN).</Text>
          <Campo etiqueta="Contraseña de la copia" valor={contrasena} onChange={setContrasena} secreto />
          <Button title="Recuperar y entrar" onPress={restaurar} />
          <Button title="Elegir otra copia" variant="secondary" onPress={() => setArchivo(null)} />
        </View>
      )}

      {ocupado && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <ActivityIndicator color={colors.accent} />
          <Text style={st.texto}>{ocupado}</Text>
        </View>
      )}
      {error && <Text style={{ color: colors.red }}>{error}</Text>}

      <Button title="Volver a escribir el PIN" variant="secondary" onPress={onVolver} />

      <View style={st.peligro}>
        <Text style={[st.texto, { color: colors.text }]}>¿No tienes copia?</Text>
        <Text style={st.texto}>
          Puedes empezar con la app vacía. Tus datos se quedan apartados en este móvil: si recuerdas el PIN, los
          recuperas en Perfil › Copia de seguridad. Escribe BORRAR para confirmarlo.
        </Text>
        <Campo etiqueta="Escribe BORRAR" valor={borrar} onChange={setBorrar} />
        {borrar.trim().toUpperCase() === 'BORRAR' && (
          <Button title="Empezar con la app vacía" variant="secondary" onPress={borrarTodo} />
        )}
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  tapa: {
    ...StyleSheet.absoluteFill, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center',
    gap: space.md, padding: space.xl, zIndex: 100,
  },
  tapaScroll: { ...StyleSheet.absoluteFill, backgroundColor: colors.bg, zIndex: 100 },
  olvidado: { gap: space.md, padding: space.xl, paddingTop: 60 },
  peligro: { gap: space.sm, marginTop: space.lg, paddingTop: space.lg, borderTopWidth: 1, borderColor: colors.border },
  titulo: { color: colors.text, fontSize: 22, fontWeight: '700' },
  texto: { color: colors.textMuted, fontSize: 15 },
  puntos: { flexDirection: 'row', gap: space.md, marginVertical: space.sm },
  punto: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.textMuted },
  lleno: { backgroundColor: colors.accent, borderColor: colors.accent },
  campo: {
    width: 180, textAlign: 'center', fontSize: 24, letterSpacing: 8, color: colors.text,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 10, backgroundColor: colors.card,
  },
});
