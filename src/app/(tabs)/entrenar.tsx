import { Text, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Card, Screen, s } from '@/components/ui';
import { colors, space } from '@/theme';

export default function Entrenar() {
  return (
    <Screen title="Entrenar">
      <Card style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xl }}>
        <Icon name="target" size={56} color={colors.accent} />
        <Text style={s.h2}>Diario del tirador</Text>
        <Text style={[s.muted, { textAlign: 'center' }]}>
          Llega en la fase 2: sesiones, asistente de diana, series, puntuaciones y evolución.
        </Text>
      </Card>
      <View style={{ gap: space.sm }}>
        {['Nueva sesión: arma, modalidad, distancia y munición', 'Asistente de diana disparo a disparo',
          'Resumen del entrenamiento', 'Estadísticas de evolución'].map((t) => (
          <Card key={t}><Text style={s.text}>{t}</Text></Card>
        ))}
      </View>
    </Screen>
  );
}
