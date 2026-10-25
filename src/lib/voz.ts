import * as SecureStore from 'expo-secure-store';
import * as Speech from 'expo-speech';

// Puntuación por voz: la app dice en voz alta el valor de cada disparo. Va apagada salvo que el
// tirador la encienda; se recuerda para la próxima sesión.
const CLAVE = 'tirador.voz';

export function leerVoz(): boolean {
  try {
    return SecureStore.getItem(CLAVE) === '1';
  } catch {
    return false;
  }
}

export function guardarVoz(encendida: boolean) {
  try {
    SecureStore.setItem(CLAVE, encendida ? '1' : '0');
  } catch {}
}

export function decir(texto: string) {
  Speech.stop().catch(() => {});
  Speech.speak(texto, { language: 'es-ES' });
}
