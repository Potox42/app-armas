import { Pressable, StyleSheet, Text, View, type ColorValue, type GestureResponderEvent } from 'react-native';
import { Tabs } from 'expo-router/tabs';
import { Icon, type IconName } from '@/components/Icon';
import { colors } from '@/theme';

const tab = (title: string, icon: IconName) => ({
  title,
  tabBarIcon: ({ color }: { color: ColorValue }) => <Icon name={icon} color={String(color)} size={24} />,
});

/** Botón central de Entrenar: un círculo destacado que sobresale de la barra. */
function BotonEntrenar(props: {
  onPress?: (e: never) => void;
  'aria-selected'?: boolean;
  accessibilityState?: { selected?: boolean };
}) {
  const activo = props['aria-selected'] ?? props.accessibilityState?.selected;
  return (
    // Todo el hueco (círculo y texto) se puede tocar, no solo el círculo.
    <Pressable
      onPress={(e: GestureResponderEvent) => props.onPress?.(e as never)}
      accessibilityRole="tab"
      accessibilityLabel="Entrenar"
      style={st.hueco}
    >
      {({ pressed }) => (
        <>
          <View style={[st.circulo, pressed && { transform: [{ scale: 0.94 }] }]}>
            <Icon name="target" size={30} />
          </View>
          <Text style={[st.texto, activo && { color: colors.accent }]}>Entrenar</Text>
        </>
      )}
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={tab('Inicio', 'home')} />
      <Tabs.Screen name="armas" options={tab('Armas', 'gun')} />
      <Tabs.Screen
        name="entrenar"
        options={{ ...tab('Entrenar', 'target'), tabBarButton: (p) => <BotonEntrenar {...p} /> }}
      />
      <Tabs.Screen name="cartera" options={tab('Cartera', 'wallet')} />
      <Tabs.Screen name="perfil" options={tab('Perfil', 'user')} />
    </Tabs>
  );
}

const st = StyleSheet.create({
  hueco: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 4 },
  circulo: {
    width: 60, height: 60, borderRadius: 30, marginTop: -26, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accent, borderWidth: 4, borderColor: colors.bg,
    shadowColor: colors.accent, shadowOpacity: 0.55, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  texto: { color: colors.textMuted, fontSize: 10, fontWeight: '500', marginTop: 2 },
});
