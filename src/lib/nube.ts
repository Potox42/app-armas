import type { CopiaServidor, Datos } from '@/data/types';
import { crearCopia } from './copia';

// Copia automática en el hosting del tirador (servidor/copia.php). La copia sale ya cifrada del
// móvil con la contraseña: el servidor solo guarda un archivo ilegible.

export class ErrorServidor extends Error {}

async function pedir(nube: Pick<CopiaServidor, 'url' | 'clave'>, init: RequestInit & { accion?: string } = {}) {
  const url = nube.url.trim() + (init.accion ? `?accion=${init.accion}` : '');
  let r: Response;
  try {
    r = await fetch(url, { ...init, headers: { 'X-Clave': nube.clave.trim(), ...(init.headers ?? {}) }, cache: 'no-store' });
  } catch {
    throw new ErrorServidor('No se puede conectar con tu servidor. Revisa la dirección o la conexión.');
  }
  if (r.status === 403) throw new ErrorServidor('La clave del servidor no es correcta.');
  if (r.status === 404 && !init.accion) throw new ErrorServidor('No encuentro copia.php en esa dirección.');
  return r;
}

async function mensaje(r: Response, porDefecto: string): Promise<string> {
  try {
    const j = await r.json();
    return typeof j?.error === 'string' ? j.error : porDefecto;
  } catch {
    return porDefecto;
  }
}

/** Fecha de la última copia guardada en el servidor (o null si aún no hay). Sirve para probar la conexión. */
export async function infoServidor(nube: Pick<CopiaServidor, 'url' | 'clave'>): Promise<{ fecha: string | null; bytes: number }> {
  const r = await pedir(nube, { accion: 'info' });
  if (!r.ok) throw new ErrorServidor(await mensaje(r, 'El servidor no responde bien.'));
  const j = await r.json().catch(() => null);
  if (!j || !('copias' in j)) throw new ErrorServidor('En esa dirección no está copia.php.');
  return { fecha: j.fecha ?? null, bytes: j.bytes ?? 0 };
}

export async function subirCopia(datos: Datos, nube: CopiaServidor): Promise<string> {
  const texto = await crearCopia(datos, nube.contrasena);
  const r = await pedir(nube, { method: 'POST', body: texto, headers: { 'Content-Type': 'application/octet-stream' } });
  if (!r.ok) throw new ErrorServidor(await mensaje(r, 'El servidor no ha guardado la copia.'));
  return new Date().toISOString();
}

/** El archivo de la última copia del servidor (cifrado: se abre con abrirCopia y la contraseña). */
export async function bajarCopia(nube: Pick<CopiaServidor, 'url' | 'clave'>): Promise<string> {
  const r = await pedir(nube, { accion: 'bajar' });
  if (!r.ok) throw new ErrorServidor(await mensaje(r, 'No se pudo descargar la copia.'));
  return r.text();
}

/** Huella de los datos (sin los ajustes de este móvil) para saber si han cambiado desde la última copia. */
export function huella(datos: Datos): string {
  const { ajustes: _a, ...resto } = datos;
  const t = JSON.stringify(resto);
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 0x01000193);
  return `${t.length}-${(h >>> 0).toString(36)}`;
}
