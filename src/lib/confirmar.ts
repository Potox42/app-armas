import { Alert, Platform } from 'react-native';

/** Pide confirmación antes de borrar algo. */
export function confirmar(titulo: string, mensaje: string, accion: () => void, boton = 'Borrar') {
  if (Platform.OS === 'web') {
    if (window.confirm(`${titulo}\n\n${mensaje}`)) accion();
    return;
  }
  Alert.alert(titulo, mensaje, [
    { text: 'Cancelar', style: 'cancel' },
    { text: boton, style: 'destructive', onPress: accion },
  ]);
}
