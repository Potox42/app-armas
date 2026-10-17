import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AvisosProgramados } from '@/components/AvisosProgramados';
import { Bloqueo } from '@/components/Bloqueo';
import { StoreProvider } from '@/data/store';
import { colors } from '@/theme';

// En la web, Expo Router da márgenes de pantalla a cero: en el iPhone la cabecera quedaba bajo la hora
// y la batería (sin poder tocar «Volver» ni «+») y la barra de pestañas, bajo la raya de inicio.
// Este proveedor mide los márgenes reales del navegador.
const MargenesWeb = ({ children }: { children: ReactNode }) =>
  Platform.OS === 'web' ? <SafeAreaProvider>{children}</SafeAreaProvider> : children;

export default function RootLayout() {
  return (
    <MargenesWeb>
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
    </MargenesWeb>
  );
}
