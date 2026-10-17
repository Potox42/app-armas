import { useEffect, useState } from 'react';
import { Alert, Platform, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Icon, type IconName } from '@/components/Icon';
import { Button, Card, Screen, s } from '@/components/ui';
import { useStore } from '@/data/store';
import { confirmar } from '@/lib/confirmar';
import { avisoDePrueba, avisosDisponibles, pedirPermisoAvisos } from '@/lib/notificaciones';
import { autenticar, motivoSinBloqueo } from '@/lib/seguridad';
import { colors, space } from '@/theme';

const PENDIENTE: { icon: IconName; titulo: string; detalle: string }[] = [
  { icon: 'shield', titulo: 'Datos cifrados en el móvil', detalle: 'Nada sale del teléfono' },
];

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
      return avisar('Avisos', 'Permite las notificaciones de Tirador Deportivo en Ajustes del iPhone > Notificaciones.');
    }
    store.guardarAjustes({ avisos: true });
  };
  return (
    <Screen title="Perfil">
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Icon name="user" size={36} color={colors.textMuted} />
        <View>
          <Text style={s.h2}>{datos.nombre}</Text>
          {datos.federacion.numeroFederado ? (
            <Text style={s.muted}>Federado nº {datos.federacion.numeroFederado}</Text>
          ) : null}
        </View>
      </Card>
      <Card style={{ gap: space.lg }}>
        <Ajuste
          titulo="Bloqueo con Face ID"
          detalle={sinBloqueo ?? 'Pide Face ID al abrir la app y al volver a ella.'}
          valor={ajustes.bloqueo}
          onChange={cambiarBloqueo}
        />
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
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }} onPress={() => router.push('/copia')}>
        <Icon name="doc" color={colors.accent} />
        <View style={{ flex: 1 }}>
          <Text style={s.text}>Copia de seguridad cifrada</Text>
          <Text style={s.muted}>Guarda o recupera tus datos con contraseña</Text>
        </View>
        <Icon name="chevron" color={colors.textMuted} />
      </Card>
      {PENDIENTE.map((p) => (
        <Card key={p.titulo} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Icon name={p.icon} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={s.text}>{p.titulo}</Text>
            <Text style={s.muted}>{p.detalle}</Text>
          </View>
        </Card>
      ))}
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
