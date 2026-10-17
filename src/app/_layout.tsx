import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AvisosProgramados } from '@/components/AvisosProgramados';
import { Bloqueo } from '@/components/Bloqueo';
import { StoreProvider } from '@/data/store';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <StoreProvider>
      <StatusBar style="light" />
      <AvisosProgramados />
      <Bloqueo>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="arma/[id]" />
          <Stack.Screen name="pase" options={{ presentation: 'modal' }} />
        </Stack>
      </Bloqueo>
    </StoreProvider>
  );
}
