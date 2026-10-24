import { useEffect, useState } from 'react';
import { Alert, Platform, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Avatar } from '@/components/Avatar';
import { Campo } from '@/components/Formulario';
import { Icon } from '@/components/Icon';
import { RecomendarApp } from '@/components/InstalarApp';
import { Button, Card, Screen, Segmented, s } from '@/components/ui';
import { useStore } from '@/data/store';
import { confirmar } from '@/lib/confirmar';
import { avisoDePrueba, avisosDisponibles, pedirPermisoAvisos } from '@/lib/notificaciones';
import { comprobarPin, crearPin, LARGO_MAX, LARGO_MIN, pinValido } from '@/lib/pin';
import { autenticar, motivoSinBloqueo } from '@/lib/seguridad';
import { guardarPreferenciaTema, leerPreferenciaTema, type PreferenciaTema } from '@/lib/tema';
import { colors, space } from '@/theme';


function avisar(titulo: string, texto: string) {
  if (Platform.OS === 'web') window.alert(`${titulo}\n\n${texto}`);
  else Alert.alert(titulo, texto);
}

function Ajuste({ titulo, detalle, valor, onChange }: {
  titulo: string; detalle: string; valor: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <View style={{ flex: 1 }}>
        <Text style={s.text}>{titulo}</Text>
        <Text style={s.muted}>{detalle}</Text>
      </View>
      <Switch value={valor} onValueChange={onChange} trackColor={{ true: colors.accent, false: colors.border }} />
    </View>
  );
}

export default function Perfil() {
  const store = useStore();
  const { datos, ajustes } = store;
  const [sinBloqueo, setSinBloqueo] = useState<string | null>(null);
  useEffect(() => {
    motivoSinBloqueo().then(setSinBloqueo).catch(() => setSinBloqueo('No se pudo comprobar Face ID.'));
  }, []);

  const cambiarBloqueo = async (activar: boolean) => {
    if (activar && sinBloqueo) return avisar('Bloqueo con Face ID', sinBloqueo);
    // Tanto para activarlo como para quitarlo se comprueba que eres tú.
    if (await autenticar()) store.guardarAjustes({ bloqueo: activar });
  };

  const cambiarAvisos = async (activar: boolean) => {
    if (!activar) return store.guardarAjustes({ avisos: false });
    if (!avisosDisponibles) return avisar('Avisos', 'Los avisos solo funcionan en la app instalada en el móvil.');
    if (!(await pedirPermisoAvisos())) {
      return avisar('Avisos', 'Permite las notificaciones de Tirador 360 en Ajustes del iPhone > Notificaciones.');
    }
    store.guardarAjustes({ avisos: true });
  };
  return (
    <Screen title="Perfil">
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Avatar nombre={datos.nombre} tamano={56} />
        <View>
          <Text style={s.h2}>{datos.nombre || 'Tu perfil'}</Text>
          {datos.federacion.numeroFederado ? (
            <Text style={s.muted}>Federado nº {datos.federacion.numeroFederado}</Text>
          ) : null}
        </View>
      </Card>
      <Card style={{ gap: space.lg }}>
        {Platform.OS === 'web' ? (
          <AjustePin />
        ) : (
          <Ajuste
            titulo="Bloqueo con Face ID"
            detalle={sinBloqueo ?? 'Pide Face ID al abrir la app y al volver a ella.'}
            valor={ajustes.bloqueo}
            onChange={cambiarBloqueo}
          />
        )}
        <Ajuste
          titulo="Avisos en el móvil"
          detalle={store.esEjemplo
            ? 'Se programarán cuando empieces con tus datos.'
            : 'Te avisa 3 meses, 1 mes, 1 semana y el mismo día de cada caducidad y revista.'}
          valor={ajustes.avisos}
          onChange={cambiarAvisos}
        />
        {ajustes.avisos && avisosDisponibles && (
          <Button title="Enviar un aviso de prueba" variant="secondary" onPress={() => { avisoDePrueba().catch(() => {}); }} />
        )}
      </Card>
      <Apariencia />
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }} onPress={() => router.push('/copia')}>
        <Icon name="doc" color={colors.accent} />
        <View style={{ flex: 1 }}>
          <Text style={s.text}>Copia de seguridad cifrada</Text>
          <Text style={s.muted}>Guarda o recupera tus datos con contraseña</Text>
        </View>
        <Icon name="chevron" color={colors.textMuted} />
      </Card>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }} onPress={() => router.push('/informe')}>
        <Icon name="share" color={colors.accent} />
        <View style={{ flex: 1 }}>
          <Text style={s.text}>Exportar a PDF</Text>
          <Text style={s.muted}>Papeles, inventario de armas e historial</Text>
        </View>
        <Icon name="chevron" color={colors.textMuted} />
      </Card>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }} onPress={() => router.push('/datos')}>
        <Icon name="shield" color={colors.accent} />
        <View style={{ flex: 1 }}>
          <Text style={s.text}>Tus datos</Text>
          <Text style={s.muted}>Dónde se guardan y cómo se protegen</Text>
        </View>
        <Icon name="chevron" color={colors.textMuted} />
      </Card>
      <RecomendarApp />
      {store.esEjemplo && (
        <Card style={{ gap: space.md, borderColor: colors.orange }}>
          <Text style={s.text}>Estás viendo datos de ejemplo.</Text>
          <Text style={s.muted}>
            Cuando quieras usar la app de verdad, bórralos y añade tus licencias, armas y carnet.
          </Text>
          <Button
            title="Borrar el ejemplo y empezar con mis datos"
            onPress={() => confirmar(
              'Empezar con tus datos',
              'Se borrarán las armas, licencias y entrenamientos de ejemplo.',
              store.empezarDeCero,
              'Borrar ejemplo',
            )}
          />
        </Card>
      )}
    </Screen>
  );
}

/** Modo oscuro, claro o el del iPhone. Los colores se aplican al volver a abrir la app. */
function Apariencia() {
  const [tema, setTema] = useState<PreferenciaTema>(leerPreferenciaTema);
  const [aviso, setAviso] = useState(false);
  return (
    <Card style={{ gap: space.md }}>
      <Text style={s.text}>Apariencia</Text>
      <Segmented
        value={tema}
        onChange={(v) => {
          setTema(v);
          if (!guardarPreferenciaTema(v).recargado) setAviso(true);
        }}
        options={[{ value: 'oscuro', label: 'Oscuro' }, { value: 'claro', label: 'Claro' }, { value: 'auto', label: 'Como el iPhone' }]}
      />
      <Text style={[s.muted, { fontSize: 13 }]}>
        {aviso ? 'Cierra la app y vuelve a abrirla para ver el cambio.' : 'El modo claro se lee mejor a pleno sol en el campo.'}
      </Text>
    </Card>
  );
}

/** Versión web: en el navegador no hay Face ID, así que la app se bloquea con un PIN propio. */
function AjustePin() {
  const store = useStore();
  const activo = !!store.ajustes.pin;
  const [abierto, setAbierto] = useState(false);
  const [uno, setUno] = useState('');
  const [dos, setDos] = useState('');
  const [error, setError] = useState<string | null>(null);

  const cerrar = () => {
    setAbierto(false);
    setUno('');
    setDos('');
    setError(null);
  };

  const guardar = () => {
    if (!activo) {
      if (!pinValido(uno)) return setError(`El PIN tiene que tener de ${LARGO_MIN} a ${LARGO_MAX} números.`);
      if (uno !== dos) return setError('Los dos PIN no coinciden.');
      store.guardarAjustes({ pin: crearPin(uno) });
    } else {
      if (!comprobarPin(store.ajustes.pin!, uno)) return setError('PIN incorrecto.');
      store.guardarAjustes({ pin: undefined });
    }
    cerrar();
  };

  return (
    <View style={{ gap: space.md }}>
      <Ajuste
        titulo="Bloqueo con PIN"
        detalle={activo
          ? 'Pide el PIN al abrir la app y al volver a ella.'
          : 'En la app web no hay Face ID: protege tus datos con un PIN de 4 a 6 números.'}
        valor={activo || abierto}
        onChange={(v) => (v === activo ? cerrar() : setAbierto(true))}
      />
      {abierto && (
        <View style={{ gap: space.sm }}>
          <Campo etiqueta={activo ? 'Escribe tu PIN para quitarlo' : 'Nuevo PIN'} valor={uno} onChange={setUno} teclado="number-pad" secreto />
          {!activo && <Campo etiqueta="Repite el PIN" valor={dos} onChange={setDos} teclado="number-pad" secreto />}
          {!activo && (
            <Text style={[s.muted, { fontSize: 12 }]}>
              Si lo olvidas, para entrar habrá que borrar los datos de este móvil y recuperar tu copia de seguridad. Haz una copia antes.
            </Text>
          )}
          {error && <Text style={{ color: colors.red }}>{error}</Text>}
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}><Button title="Cancelar" variant="secondary" onPress={cerrar} /></View>
            <View style={{ flex: 1 }}><Button title={activo ? 'Quitar PIN' : 'Guardar PIN'} onPress={guardar} /></View>
          </View>
        </View>
      )}
    </View>
  );
}
