import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { WEB_VENTA } from '@/components/InstalarApp';
import { activar, comprobar, liberar, type Activacion, type Edicion } from '@/lib/activacion';
import { confirmar } from '@/lib/confirmar';
import { colors, radius, space } from '@/theme';
import { Logo } from './Logo';
import { Button } from './ui';

interface Ctx {
  activacion: Activacion;
  edicion: Edicion;
  esPro: boolean;
  /** Quita la licencia de este móvil y vuelve a la pantalla de activar. */
  liberarLicencia: () => Promise<string | null>;
}

const Contexto = createContext<Ctx | null>(null);

/** Edición de la app que tiene este móvil (Básica o Pro). */
export function useLicenciaApp(): Ctx {
  const c = useContext(Contexto);
  if (!c) throw new Error('useLicenciaApp fuera de <ActivacionApp>');
  return c;
}

/** Tapa la app hasta que se activa un código de compra válido en este móvil. */
export function ActivacionApp({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<'cargando' | 'pedir' | 'lista'>('cargando');
  const [activacion, setActivacion] = useState<Activacion | null>(null);
  const [aviso, setAviso] = useState<string | undefined>();

  useEffect(() => {
    comprobar()
      .then((r) => {
        setActivacion(r.activacion);
        setAviso(r.aviso);
        setEstado(r.activacion ? 'lista' : 'pedir');
      })
      .catch(() => setEstado('pedir'));
  }, []);

  const liberarLicencia = useCallback(async () => {
    const r = await liberar();
    if (!r.ok) return r.mensaje;
    setActivacion(null);
    setAviso('Licencia liberada. Ya puedes activarla en tu otro móvil.');
    setEstado('pedir');
    return null;
  }, []);

  if (estado === 'cargando') {
    return (
      <View style={st.tapa}>
        <Logo size={72} />
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (estado === 'pedir' || !activacion) {
    return <PedirCodigo aviso={aviso} alActivar={(a) => { setActivacion(a); setAviso(undefined); setEstado('lista'); }} />;
  }
  return (
    <Contexto.Provider value={{ activacion, edicion: activacion.edicion, esPro: activacion.edicion === 'pro', liberarLicencia }}>
      {children}
    </Contexto.Provider>
  );
}

function PedirCodigo({ aviso, alActivar }: { aviso?: string; alActivar: (a: Activacion) => void }) {
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [puedeMover, setPuedeMover] = useState(false);

  const enviar = async (mover = false) => {
    setEnviando(true);
    setError(null);
    const r = await activar(codigo, mover);
    setEnviando(false);
    if (r.ok) return alActivar(r.activacion);
    setError(r.mensaje);
    setPuedeMover(!!r.puedeMover);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={st.pantalla} keyboardShouldPersistTaps="handled">
        <Logo size={80} />
        <Text style={st.titulo}>Activa Tirador 360</Text>
        <Text style={st.texto}>Escribe el código de licencia que te llegó por correo al comprar la app.</Text>
        {aviso && <Text style={st.aviso}>{aviso}</Text>}
        <TextInput
          value={codigo}
          onChangeText={(t) => { setCodigo(t.toUpperCase()); setError(null); setPuedeMover(false); }}
          placeholder="T360P-XXXX-XXXX-XXXX"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          style={st.campo}
          onSubmitEditing={() => enviar()}
        />
        {error && <Text style={st.error}>{error}</Text>}
        {enviando ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <View style={{ alignSelf: 'stretch', gap: space.sm }}>
            <Button title="Activar" onPress={() => enviar()} />
            {puedeMover && (
              <Button
                title="Usarla en este móvil"
                variant="secondary"
                onPress={() => confirmar(
                  'Cambiar de móvil',
                  'La licencia dejará de funcionar en el otro móvil. Haz antes una copia de seguridad allí si quieres pasar tus datos.',
                  () => { enviar(true); },
                  'Usar aquí',
                )}
              />
            )}
          </View>
        )}
        <Text style={st.nota}>Cada licencia vale para un solo móvil. Si cambias de móvil, libérala antes en Perfil › Tu licencia.</Text>
        <Pressable onPress={() => Linking.openURL(WEB_VENTA).catch(() => {})}>
          <Text style={st.enlace}>¿Aún no la tienes? Cómprala en la web</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Aviso que sustituye a una función Pro cuando la licencia es Básica. */
export function SoloPro({ que }: { que: string }) {
  return (
    <View style={st.soloPro}>
      <Text style={st.soloProTitulo}>{que} es de la versión Pro</Text>
      <Text style={st.texto}>Con tu código Básica puedes pasar a Pro por 10 € en la web. Te llegará un código nuevo para activar aquí.</Text>
      <Button title="Pasar a Pro" onPress={() => Linking.openURL(WEB_VENTA).catch(() => {})} />
    </View>
  );
}

const st = StyleSheet.create({
  tapa: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: space.lg },
  pantalla: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
  titulo: { color: colors.text, fontSize: 24, fontWeight: '700', marginTop: space.sm },
  texto: { color: colors.textMuted, fontSize: 15, textAlign: 'center' },
  aviso: { color: colors.orange, fontSize: 14, textAlign: 'center' },
  campo: {
    alignSelf: 'stretch', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.md,
    color: colors.text, fontSize: 18, letterSpacing: 1, textAlign: 'center', backgroundColor: colors.card,
  },
  error: { color: colors.red, fontSize: 14, textAlign: 'center' },
  nota: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: space.md },
  enlace: { color: colors.accent, fontSize: 15, fontWeight: '600', marginTop: space.sm },
  soloPro: { gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.card },
  soloProTitulo: { color: colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center' },
});
