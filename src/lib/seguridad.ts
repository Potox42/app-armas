import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

/** null si se puede usar; si no, el motivo. */
export async function motivoSinBloqueo(): Promise<string | null> {
  if (Platform.OS === 'web') return 'El bloqueo solo funciona en la app instalada en el móvil.';
  if (!(await LocalAuthentication.hasHardwareAsync())) return 'Este móvil no tiene Face ID ni huella.';
  if (!(await LocalAuthentication.isEnrolledAsync())) return 'Configura Face ID en los Ajustes del iPhone.';
  return null;
}

export async function autenticar(): Promise<boolean> {
  const r = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Desbloquear Tirador Deportivo',
    cancelLabel: 'Cancelar',
  });
  return r.success;
}
