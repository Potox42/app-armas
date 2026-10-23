import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import type { Anteriores, Datos } from './types';

// Base de datos cifrada con SQLCipher (activado en app.json, plugin expo-sqlite).
// La clave es aleatoria, se genera en el primer arranque y vive en el llavero del iPhone.
// THIS_DEVICE_ONLY: la clave no viaja en copias de iCloud, así que la base de datos
// solo se puede abrir en este móvil. Para cambiar de móvil hará falta la exportación cifrada.

const NOMBRE_BD = 'tirador.db';
const CLAVE_LLAVERO = 'tirador.bd.clave';

let abierta: Promise<SQLite.SQLiteDatabase> | null = null;

async function obtenerClave(): Promise<string> {
  const opciones = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
  const guardada = await SecureStore.getItemAsync(CLAVE_LLAVERO, opciones);
  if (guardada) return guardada;
  const bytes = await Crypto.getRandomBytesAsync(32);
  const clave = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync(CLAVE_LLAVERO, clave, opciones);
  return clave;
}

async function abrir(): Promise<SQLite.SQLiteDatabase> {
  const clave = await obtenerClave();
  const db = await SQLite.openDatabaseAsync(NOMBRE_BD);
  // Clave en bruto (64 caracteres hex): solo contiene [0-9a-f], así que es seguro interpolarla.
  await db.execAsync(`PRAGMA key = "x'${clave}'";`);
  // Falla aquí si la clave no es la correcta.
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS documento (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      json TEXT NOT NULL,
      actualizado TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS anterior (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS foto (
      id TEXT PRIMARY KEY NOT NULL,
      datos TEXT NOT NULL
    );
  `);
  return db;
}

function bd(): Promise<SQLite.SQLiteDatabase> {
  if (!abierta) {
    abierta = abrir().catch((e) => {
      abierta = null;
      throw e;
    });
  }
  return abierta;
}

export async function cargarDatos(): Promise<Datos | null> {
  const fila = await (await bd()).getFirstAsync<{ json: string }>('SELECT json FROM documento WHERE id = 1');
  return fila ? (JSON.parse(fila.json) as Datos) : null;
}

export async function guardarDatos(datos: Datos): Promise<void> {
  await (await bd()).runAsync(
    `INSERT INTO documento (id, json, actualizado) VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET json = excluded.json, actualizado = excluded.actualizado`,
    JSON.stringify(datos),
    new Date().toISOString(),
  );
}

// Copia de los datos de antes de borrarlos o sustituirlos por una copia, por si fue un error.
export async function guardarAnteriores(a: Anteriores): Promise<void> {
  await (await bd()).runAsync('INSERT OR REPLACE INTO anterior (id, json) VALUES (1, ?)', JSON.stringify(a));
}

export async function leerAnteriores(): Promise<Anteriores | null> {
  const fila = await (await bd()).getFirstAsync<{ json: string }>('SELECT json FROM anterior WHERE id = 1');
  return fila ? (JSON.parse(fila.json) as Anteriores) : null;
}

// Las fotos van en su propia tabla (también cifrada) para no reescribirlas en cada cambio.

export async function guardarFoto(id: string, dataUri: string): Promise<void> {
  await (await bd()).runAsync('INSERT OR REPLACE INTO foto (id, datos) VALUES (?, ?)', id, dataUri);
}

export async function leerFoto(id: string): Promise<string | null> {
  const fila = await (await bd()).getFirstAsync<{ datos: string }>('SELECT datos FROM foto WHERE id = ?', id);
  return fila?.datos ?? null;
}

export async function borrarFoto(id: string): Promise<void> {
  await (await bd()).runAsync('DELETE FROM foto WHERE id = ?', id);
}
