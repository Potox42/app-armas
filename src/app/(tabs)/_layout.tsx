import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router/tabs';
import { Icon, type IconName } from '@/components/Icon';
import { colors } from '@/theme';

const tab = (title: string, icon: IconName) => ({
  title,
  tabBarIcon: ({ color }: { color: ColorValue }) => <Icon name={icon} color={String(color)} size={24} />,
});

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
      <Tabs.Screen name="entrenar" options={tab('Entrenar', 'target')} />
      <Tabs.Screen name="armas" options={tab('Armas', 'gun')} />
      <Tabs.Screen name="cartera" options={tab('Cartera', 'wallet')} />
      <Tabs.Screen name="perfil" options={tab('Perfil', 'user')} />
    </Tabs>
  );
}
