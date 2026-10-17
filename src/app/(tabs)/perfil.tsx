import { Text, View } from 'react-native';
import { Icon, type IconName } from '@/components/Icon';
import { Card, Screen, s } from '@/components/ui';
import { useStore } from '@/data/store';
import { colors, space } from '@/theme';

const PENDIENTE: { icon: IconName; titulo: string; detalle: string }[] = [
  { icon: 'lock', titulo: 'Bloqueo con Face ID', detalle: 'Se activa en la versión instalada en el iPhone' },
  { icon: 'shield', titulo: 'Datos cifrados en el móvil', detalle: 'Nada sale del teléfono' },
  { icon: 'doc', titulo: 'Copia de seguridad cifrada', detalle: 'Exportar e importar tus datos' },
];

export default function Perfil() {
  const { datos } = useStore();
  return (
    <Screen title="Perfil">
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Icon name="user" size={36} color={colors.textMuted} />
        <View>
          <Text style={s.h2}>{datos.nombre}</Text>
          <Text style={s.muted}>Federado nº {datos.federacion.numeroFederado}</Text>
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
      <Text style={[s.muted, { textAlign: 'center' }]}>Vista previa con datos de ejemplo</Text>
    </Screen>
  );
}
