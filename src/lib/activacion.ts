import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { WEB_VENTA } from '@/components/InstalarApp';

// Licencia de compra de Tirador 360 (no confundir con la licencia de armas).
// El código T360B-… (Básica) o T360P-… (Pro) se compra en la web y vale para UN solo móvil.
// La web (plugin «Tirador 360 · Licencias» en WordPress) guarda a qué móvil está unido cada código.

export type Edicion = 'basica' | 'pro';

export interface Activacion {
  codigo: string;
  edicion: Edicion;
  /** Código AMIGO-XXXXX del pedido, para recomendar la app. */
  amigo?: string;
  /** Última vez que la web confirmó la licencia (ISO). */
  comprobada: string;
}

/** Dirección del servidor de licencias: la misma web de venta. */
const API = `${WEB_VENTA.replace(/\/$/, '')}/wp-json/t360/v1`;
const CLAVE_ACTIVACION = 't360.activacion';
const CLAVE_DISPOSITIVO = 't360.dispositivo';
/** Sin cobertura en el campo la app sigue funcionando: se vuelve a comprobar como mucho una vez al día… */
const COMPROBAR_CADA_MS = 24 * 3600 * 1000;
/** …y si pasan 30 días sin poder comprobarla, se pide conexión. */
const SIN_CONEXION_MAX_MS = 30 * 24 * 3600 * 1000;

export const FORMATO_CODIGO = /^T360[BP]-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export function limpiarCodigo(texto: string): string {
  return texto.toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

async function leer(clave: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(clave) ?? null;
    return await SecureStore.getItemAsync(clave);
  } catch {
    return null;
  }
}

async function escribir(clave: string, valor: string | null): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (valor === null) localStorage.removeItem(clave);
      else localStorage.setItem(clave, valor);
    } else if (valor === null) {
      await SecureStore.deleteItemAsync(clave);
    } else {
      await SecureStore.setItemAsync(clave, valor);
    }
  } catch { /* sin almacenamiento: habrá que activarla otra vez */ }
}

/** Identificador aleatorio de este móvil (no contiene datos personales). */
export async function dispositivo(): Promise<string> {
  const guardado = await leer(CLAVE_DISPOSITIVO);
  if (guardado) return guardado;
  const nuevo = Crypto.randomUUID();
  await escribir(CLAVE_DISPOSITIVO, nuevo);
  return nuevo;
}

export async function leerActivacion(): Promise<Activacion | null> {
  const t = await leer(CLAVE_ACTIVACION);
  if (!t) return null;
  try {
    const a = JSON.parse(t) as Activacion;
    return a.codigo && (a.edicion === 'basica' || a.edicion === 'pro') ? a : null;
  } catch {
    return null;
  }
}

async function guardar(a: Activacion | null) {
  await escribir(CLAVE_ACTIVACION, a ? JSON.stringify(a) : null);
  // El código de recomendado se rellena solo en la tarjeta «Recomiéndala».
  if (a?.amigo) {
    try { if (Platform.OS === 'web' && !localStorage.getItem('codigoAmigo')) localStorage.setItem('codigoAmigo', a.amigo); } catch { /* nada */ }
  }
}

export type Resultado =
  | { ok: true; activacion: Activacion }
  | { ok: false; motivo: 'no_existe' | 'desactivada' | 'en_uso' | 'otro_movil' | 'sin_conexion' | 'demasiados' | 'error'; mensaje: string; puedeMover?: boolean };

const MENSAJES: Record<string, string> = {
  no_existe: 'Ese código no existe. Revisa que lo has copiado bien del correo de compra.',
  desactivada: 'Ese código ya no está activo (por ejemplo, porque pasaste de Básica a Pro: usa el código nuevo).',
  en_uso: 'Ese código ya se está usando en otro móvil.',
  otro_movil: 'Este código se ha pasado a otro móvil. Si es tuyo, vuelve a activarlo aquí.',
  demasiados: 'Demasiados intentos. Espera una hora y vuelve a probar.',
  sin_conexion: 'No hay conexión con la web de Tirador 360. Prueba con cobertura o wifi.',
  error: 'No se ha podido comprobar el código. Inténtalo de nuevo en unos minutos.',
};

async function llamar(accion: 'activar' | 'comprobar' | 'liberar', codigo: string, extra: Record<string, unknown> = {}): Promise<Resultado> {
  let r: Response;
  try {
    r = await fetch(`${API}/${accion}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo, dispositivo: await dispositivo(), ...extra }),
    });
  } catch {
    return { ok: false, motivo: 'sin_conexion', mensaje: MENSAJES.sin_conexion };
  }
  let j: { ok?: boolean; motivo?: string; edicion?: Edicion; amigo?: string; puede_mover?: boolean } = {};
  try { j = await r.json(); } catch { /* respuesta rara */ }
  if (r.status === 429) return { ok: false, motivo: 'demasiados', mensaje: MENSAJES.demasiados };
  if (j.ok && (j.edicion === 'basica' || j.edicion === 'pro')) {
    return { ok: true, activacion: { codigo, edicion: j.edicion, amigo: j.amigo || undefined, comprobada: new Date().toISOString() } };
  }
  if (j.ok && accion === 'liberar') return { ok: true, activacion: { codigo, edicion: 'basica', comprobada: '' } };
  const motivo = (j.motivo && j.motivo in MENSAJES ? j.motivo : 'error') as Exclude<Resultado, { ok: true }>['motivo'];
  return { ok: false, motivo, mensaje: MENSAJES[motivo], puedeMover: !!j.puede_mover };
}

/** Activa el código en este móvil. Con `mover`, lo quita del móvil anterior (máximo unas pocas veces al año). */
export async function activar(texto: string, mover = false): Promise<Resultado> {
  const codigo = limpiarCodigo(texto);
  if (!FORMATO_CODIGO.test(codigo)) {
    return { ok: false, motivo: 'no_existe', mensaje: 'El código tiene este formato: T360B-XXXX-XXXX-XXXX o T360P-XXXX-XXXX-XXXX.' };
  }
  const r = await llamar('activar', codigo, { mover });
  if (r.ok) await guardar(r.activacion);
  return r;
}

/**
 * Al abrir la app: si toca, confirma con la web que la licencia sigue siendo de este móvil.
 * Devuelve la activación válida o null si hay que volver a pedir el código.
 */
export async function comprobar(): Promise<{ activacion: Activacion | null; aviso?: string }> {
  const a = await leerActivacion();
  if (!a) return { activacion: null };
  const desde = Date.now() - new Date(a.comprobada).getTime();
  if (desde < COMPROBAR_CADA_MS) return { activacion: a };
  const r = await llamar('comprobar', a.codigo);
  if (r.ok) {
    const nueva = { ...r.activacion, amigo: r.activacion.amigo ?? a.amigo };
    await guardar(nueva);
    return { activacion: nueva };
  }
  if (r.motivo === 'sin_conexion' || r.motivo === 'error' || r.motivo === 'demasiados') {
    // Sin conexión se sigue usando; solo se bloquea si lleva mucho tiempo sin comprobarse.
    return desde < SIN_CONEXION_MAX_MS
      ? { activacion: a }
      : { activacion: null, aviso: 'Hace más de 30 días que no se comprueba tu licencia. Conéctate a internet y vuelve a abrir la app.' };
  }
  await guardar(null);
  return { activacion: null, aviso: r.mensaje };
}

/** Libera el código de este móvil para poder usarlo en otro. */
export async function liberar(): Promise<Resultado> {
  const a = await leerActivacion();
  if (!a) return { ok: false, motivo: 'error', mensaje: 'No hay ninguna licencia activada en este móvil.' };
  const r = await llamar('liberar', a.codigo);
  if (r.ok) await guardar(null);
  return r;
}
