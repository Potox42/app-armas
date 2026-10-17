import * as Crypto from 'expo-crypto';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { leerFoto } from '@/data/db';
import type { Datos } from '@/data/types';

// Copia de seguridad: un archivo .tirador con tus datos y fotos cifrados con AES-256-GCM.
// La clave sale de tu contraseña con PBKDF2-SHA256; sin la contraseña no se puede abrir.

const ITERACIONES = 150_000;
export const MIN_CONTRASENA = 8;

interface Archivo {
  app: 'tirador';
  version: 1;
  kdf: { alg: 'pbkdf2-sha256'; iteraciones: number; sal: string };
  cifrado: string; // base64: iv + datos cifrados + etiqueta
}

interface Contenido {
  datos: Datos;
  fotos: Record<string, string>;
}

function aBytes(texto: string): Uint8Array {
  return new TextEncoder().encode(texto);
}

function deBytes(b: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(b);
  // UTF-8 a mano por si el motor no trae TextDecoder.
  let s = '';
  for (let i = 0; i < b.length; ) {
    const c = b[i++];
    let cp = c;
    if (c >= 0xf0) cp = ((c & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    else if (c >= 0xe0) cp = ((c & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    else if (c >= 0xc0) cp = ((c & 31) << 6) | (b[i++] & 63);
    s += String.fromCodePoint(cp);
  }
  return s;
}

function aBase64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

function deBase64(t: string): Uint8Array {
  const s = atob(t);
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}

async function clave(contrasena: string, sal: Uint8Array, iteraciones: number) {
  const bytes = await pbkdf2Async(sha256, aBytes(contrasena.normalize('NFC')), sal, { c: iteraciones, dkLen: 32 });
  return Crypto.AESEncryptionKey.import(bytes);
}

/** Todas las fotos a las que apuntan los datos. */
export function idsDeFotos(d: Datos): string[] {
  const ids = [
    d.permiso.fotoAnverso, d.permiso.fotoReverso, d.federacion.fotoCarnet, d.federacion.fotoQr,
    ...d.permiso.licencias.flatMap((l) => [l.fotoAnverso, l.fotoReverso]),
    ...d.armas.flatMap((a) => [a.foto, a.fotoGuiaAnverso, a.fotoGuiaReverso]),
  ];
  return [...new Set(ids.filter((x): x is string => !!x))];
}

export async function crearCopia(datos: Datos, contrasena: string): Promise<string> {
  const fotos: Record<string, string> = {};
  for (const id of idsDeFotos(datos)) {
    const f = await leerFoto(id);
    if (f) fotos[id] = f;
  }
  const contenido: Contenido = { datos, fotos };
  const sal = Crypto.getRandomBytes(16);
  const sellado = await Crypto.aesEncryptAsync(aBytes(JSON.stringify(contenido)), await clave(contrasena, sal, ITERACIONES));
  const archivo: Archivo = {
    app: 'tirador',
    version: 1,
    kdf: { alg: 'pbkdf2-sha256', iteraciones: ITERACIONES, sal: aBase64(sal) },
    cifrado: await sellado.combined('base64'),
  };
  return JSON.stringify(archivo);
}

export class ErrorCopia extends Error {}

export async function abrirCopia(texto: string, contrasena: string): Promise<Contenido> {
  let archivo: Archivo;
  try {
    archivo = JSON.parse(texto);
  } catch {
    throw new ErrorCopia('Este archivo no es una copia de Tirador Deportivo.');
  }
  if (archivo?.app !== 'tirador' || archivo.version !== 1 || archivo.kdf?.alg !== 'pbkdf2-sha256') {
    throw new ErrorCopia('Este archivo no es una copia de Tirador Deportivo.');
  }
  const k = await clave(contrasena, deBase64(archivo.kdf.sal), archivo.kdf.iteraciones);
  let bytes: Uint8Array;
  try {
    bytes = await Crypto.aesDecryptAsync(Crypto.AESSealedData.fromCombined(archivo.cifrado), k, { output: 'bytes' });
  } catch {
    throw new ErrorCopia('La contraseña no es correcta.');
  }
  return JSON.parse(deBytes(bytes)) as Contenido;
}
