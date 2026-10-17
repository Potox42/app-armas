import { Text, View } from 'react-native';
import { Icon, type IconName } from '@/components/Icon';
import { Button, Card, Screen, s } from '@/components/ui';
import { useStore } from '@/data/store';
import { confirmar } from '@/lib/confirmar';
import { colors, space } from '@/theme';

const PENDIENTE: { icon: IconName; titulo: string; detalle: string }[] = [
  { icon: 'lock', titulo: 'Bloqueo con Face ID', detalle: 'Se activa en la versión instalada en el iPhone' },
  { icon: 'shield', titulo: 'Datos cifrados en el móvil', detalle: 'Nada sale del teléfono' },
  { icon: 'doc', titulo: 'Copia de seguridad cifrada', detalle: 'Exportar e importar tus datos' },
];

export default function Perfil() {
  const store = useStore();
  const { datos } = store;
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
