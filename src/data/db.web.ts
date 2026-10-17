import type { Datos } from './types';

// Versión web (pantalla de inicio del iPhone): los datos se guardan en IndexedDB del navegador,
// cifrados con AES-GCM. La clave se crea en el primer uso, no es exportable (el código de la
// página no puede leerla) y se queda en ese mismo navegador.
// Es menos robusto que la app instalada (llavero del iPhone + SQLCipher): sirve para probar.
// Si el navegador no deja guardar (modo privado, vista previa), todo funciona en memoria.

const BD = 'tirador';
const ALMACEN = 'kv';

interface Cifrado {
  iv: Uint8Array<ArrayBuffer>;
  datos: ArrayBuffer;
}

const memoria = new Map<string, string>();
let abierta: Promise<{ db: IDBDatabase; clave: CryptoKey } | null> | null = null;

function peticion<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((ok, mal) => {
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
}

function almacen(db: IDBDatabase, modo: IDBTransactionMode) {
  return db.transaction(ALMACEN, modo).objectStore(ALMACEN);
}

async function abrir() {
  if (typeof indexedDB === 'undefined' || !globalThis.crypto?.subtle) return null;
  const pet = indexedDB.open(BD, 1);
  pet.onupgradeneeded = () => pet.result.createObjectStore(ALMACEN);
  const db = await peticion(pet);
  let clave = (await peticion(almacen(db, 'readonly').get('clave'))) as CryptoKey | undefined;
  if (!clave) {
    clave = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await peticion(almacen(db, 'readwrite').put(clave, 'clave'));
  }
  return { db, clave };
}

function bd() {
  if (!abierta) {
    abierta = abrir().catch((e) => {
      console.warn('Sin almacenamiento en el navegador; los datos solo duran mientras la página esté abierta.', e);
      return null;
    });
  }
  return abierta;
}

async function escribir(id: string, texto: string): Promise<void> {
  memoria.set(id, texto);
  const b = await bd();
  if (!b) return;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const datos = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, b.clave, new TextEncoder().encode(texto));
  await peticion(almacen(b.db, 'readwrite').put({ iv, datos } satisfies Cifrado, id));
}

async function leer(id: string): Promise<string | null> {
  const b = await bd();
  if (!b) return memoria.get(id) ?? null;
  const c = (await peticion(almacen(b.db, 'readonly').get(id))) as Cifrado | undefined;
  if (!c) return memoria.get(id) ?? null;
  const plano = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: c.iv }, b.clave, c.datos);
  return new TextDecoder().decode(plano);
}

export async function cargarDatos(): Promise<Datos | null> {
  const t = await leer('documento');
  return t ? (JSON.parse(t) as Datos) : null;
}

export async function guardarDatos(datos: Datos): Promise<void> {
  await escribir('documento', JSON.stringify(datos));
}

export async function guardarFoto(id: string, dataUri: string): Promise<void> {
  await escribir(`foto:${id}`, dataUri);
}

export async function leerFoto(id: string): Promise<string | null> {
  return leer(`foto:${id}`);
}

export async function borrarFoto(id: string): Promise<void> {
  memoria.delete(`foto:${id}`);
  const b = await bd();
  if (b) await peticion(almacen(b.db, 'readwrite').delete(`foto:${id}`));
}
