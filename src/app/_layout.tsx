import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AvisosProgramados } from '@/components/AvisosProgramados';
import { ActivacionApp } from '@/components/Activacion';
import { Bloqueo } from '@/components/Bloqueo';
import { CopiaAutomatica } from '@/components/CopiaAutomatica';
import { StoreProvider } from '@/data/store';
import { colors, temaClaro } from '@/theme';

export default function RootLayout() {
  return (
    <StoreProvider>
      <StatusBar style={temaClaro ? 'dark' : 'light'} />
      <AvisosProgramados />
      <CopiaAutomatica />
      <ActivacionApp>
      <Bloqueo>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="arma/[id]" />
          <Stack.Screen name="pase" options={{ presentation: 'modal' }} />
        </Stack>
      </Bloqueo>
      </ActivacionApp>
    </StoreProvider>
  );
}
