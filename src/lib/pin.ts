import { sha256 } from '@noble/hashes/sha2.js';

// PIN de la versión web (en el navegador no hay Face ID). Se guarda solo su huella SHA-256 con
// una sal aleatoria, dentro de los datos cifrados. Es un bloqueo de pantalla: impide ver los datos
// a quien coja el móvil desbloqueado.

export const LARGO_MIN = 4;
export const LARGO_MAX = 6;

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

function huella(sal: string, pin: string): string {
  return hex(sha256(new TextEncoder().encode(`${sal}:${pin}`)));
}

export function pinValido(pin: string): boolean {
  return new RegExp(`^\\d{${LARGO_MIN},${LARGO_MAX}}$`).test(pin);
}

export function crearPin(pin: string): { sal: string; hash: string; largo: number } {
  const sal = hex(crypto.getRandomValues(new Uint8Array(16)));
  return { sal, hash: huella(sal, pin), largo: pin.length };
}

export function comprobarPin(guardado: { sal: string; hash: string }, pin: string): boolean {
  return huella(guardado.sal, pin) === guardado.hash;
}
