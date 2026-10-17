import type { TipoLicencia } from '@/data/types';

/** Una fila de la tabla del reverso: tipo de licencia, válida desde y válida hasta. */
export interface FilaLicencia {
  tipo?: TipoLicencia; // sin tipo si el OCR no ha leído la letra
  desde: string; // ISO
  hasta: string; // ISO
}

export interface DatosLeidos {
  filas: FilaLicencia[];
  nif?: string; // NIF/NIE del titular (anverso), solo si la letra de control cuadra
  categoria?: string; // «LICENCIA F CATEGORÍA 3»
  tipo?: TipoLicencia;
  numero?: string;
  expedicion?: string; // ISO
  caducidad?: string; // ISO
}

const MESES: Record<string, number> = {
  ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6, JUL: 7, AGO: 8, SEP: 9, SET: 9, OCT: 10, NOV: 11, DIC: 12,
};

function iso(d: number, m: number, y: number): string | null {
  if (y < 100) y += 2000;
  const f = new Date(y, m - 1, d);
  if (f.getFullYear() !== y || f.getMonth() !== m - 1 || f.getDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Mayúsculas y la letra O que el OCR confunde con un cero junto a cifras. */
function normalizar(texto: string): string {
  return texto.toUpperCase().replace(/O(?=\d)/g, '0').replace(/(\d)O/g, (_, d: string) => `${d}0`);
}

/** Fechas en el texto: 15/03/2023, 15-03-2023, 15.03.2023, 15 03 2023 o 15 MAR 2023. */
export function fechasDe(texto: string): string[] {
  const t = normalizar(texto);
  const res: string[] = [];
  for (const m of t.matchAll(/\b(\d{1,2})\s?[/.\-\s]\s?(\d{1,2}|\d{2}(?=\d{4}))\s?[/.\-\s]?\s?(\d{4})\b/g)) {
    const f = iso(+m[1], +m[2], +m[3]);
    if (f) res.push(f);
  }
  for (const m of t.matchAll(/\b(\d{1,2})[\s.\-/]*(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|SET|OCT|NOV|DIC)[A-Z]*[\s.\-/]*(\d{4})\b/g)) {
    const f = iso(+m[1], MESES[m[2]], +m[3]);
    if (f) res.push(f);
  }
  return [...new Set(res)].sort();
}

const LETRAS_NIF = 'TRWAGMYFPDXBNJZSQVHLCKE';

/** NIF o NIE con la letra de control correcta, como «12345678-Z»; null si no cuadra. */
export function nifValido(cifras: string, letra: string): string | null {
  const n = cifras.replace(/^X/, '0').replace(/^Y/, '1').replace(/^Z/, '2');
  if (!/^\d{8}$/.test(n)) return null;
  return LETRAS_NIF[+n % 23] === letra ? `${cifras}-${letra}` : null;
}

function masAnios(isoFecha: string, n: number): string {
  return `${+isoFecha.slice(0, 4) + n}${isoFecha.slice(4)}`;
}

const FECHA = /\b(\d{1,2})\s?[/.\-]\s?(\d{1,2}|\d{2}(?=\d{4}))\s?[/.\-]?\s?(\d{4})\b/g;
const LETRA = /(?:^|[^A-Z])([FDE])(?:[^A-Z]|$)/;

/**
 * Filas de la tabla del reverso (como en el carné de conducir): «E 11-05-2022 11-05-2027».
 * Cada línea con dos fechas separadas por unos 5 años es una licencia: la primera fecha es
 * «válida desde» y la segunda «válida hasta». La letra (F, D o E) va delante en la misma línea o,
 * si el OCR la ha partido, sola en la línea anterior. Si no se lee la letra, la fila queda sin tipo.
 */
export function filasDe(texto: string): FilaLicencia[] {
  const filas: FilaLicencia[] = [];
  let letraSuelta: TipoLicencia | undefined;
  for (const linea of normalizar(texto).replace(/[€É]/g, 'E').split('\n')) {
    const fechas = [...linea.matchAll(FECHA)].map((m) => iso(+m[1], +m[2], +m[3])).filter((f): f is string => !!f);
    const antes = linea.slice(0, linea.search(FECHA) >= 0 ? linea.search(FECHA) : undefined);
    const letra = antes.match(LETRA)?.[1] as TipoLicencia | undefined;
    if (fechas.length < 2) {
      letraSuelta = fechas.length === 0 && antes.replace(/[^A-Z0-9]/g, '').length <= 2 ? letra : undefined;
      continue;
    }
    const [desde, hasta] = fechas;
    const tipo = letra ?? letraSuelta;
    letraSuelta = undefined;
    // Creíble: posterior a 1990 y con una validez de hasta 5 años (con algo de margen).
    const creible = desde >= '1990-01-01' && hasta > masAnios(desde, 1) && hasta <= masAnios(desde, 6);
    if (creible && !filas.some((x) => (tipo && x.tipo === tipo) || x.hasta === hasta)) filas.push({ tipo, desde, hasta });
  }
  return filas;
}

/**
 * Intenta sacar los datos de una licencia de armas del texto leído por OCR (anverso o reverso).
 * No conocemos todos los modelos de tarjeta, así que se buscan patrones generales
 * y la persona revisa siempre el resultado antes de guardar.
 */
export function leerLicencia(
  texto: string,
  hoy = new Date().toISOString().slice(0, 10),
  preferido?: TipoLicencia, // si el reverso trae varias licencias, la que se está rellenando
): DatosLeidos {
  const t = normalizar(texto);
  const r: DatosLeidos = { filas: filasDe(texto) };

  const tipo = t.match(/\b(?:TIPO|CLASE|LICENCIA(?:\s+DE\s+ARMAS)?)\s*[:.\-]?\s*["'«]?([FDE])\b/);
  if (tipo) r.tipo = tipo[1] as TipoLicencia;

  // Fechas que pueden ser de la licencia: las anteriores a 1990 suelen ser la de nacimiento, y una licencia
  // dura 5 años, así que una fecha a más de 10 años vista es un error de lectura.
  const tope = masAnios(hoy, 10);
  const fechas = fechasDe(texto).filter((f) => f >= '1990-01-01' && f <= tope);
  if (fechas.length >= 2) {
    r.expedicion = fechas[0];
    r.caducidad = fechas[fechas.length - 1];
  } else if (fechas.length === 1) {
    if (fechas[0] > hoy) r.caducidad = fechas[0];
    else r.expedicion = fechas[0];
  }

  for (const m of t.matchAll(/\b([XYZ]?\d{7,8})\s?-?\s?([A-Z])\b/g)) {
    const cifras = m[1].length === 7 && !/^[XYZ]/.test(m[1]) ? `0${m[1]}` : m[1];
    const nif = nifValido(cifras, m[2]);
    if (nif) {
      r.nif = nif;
      break;
    }
  }
  const categoria = t.match(/LICENCIA\s+F\s+CATEGOR[IÍ]A\s*([123])\b/);
  if (categoria) r.categoria = categoria[1];

  // Si hay tabla de licencias (reverso), manda: la del tipo pedido o, si no está, la que caduca más tarde.
  if (r.filas.length) {
    const fila = r.filas.find((x) => x.tipo === preferido) ?? [...r.filas].sort((a, b) => b.hasta.localeCompare(a.hasta))[0];
    if (fila.tipo) r.tipo = fila.tipo;
    r.expedicion = fila.desde;
    r.caducidad = fila.hasta;
  }

  // Número: el que va detrás de «Nº» (que el OCR a veces lee «N9» o «N0»), «NUM.» o «NÚMERO».
  // Se quitan también el NIF/NIE del titular (05285531-Q, X1234567-L), que no es el número de licencia.
  const sinFechas = t
    .replace(/\b\d{1,2}\s?[/.\-]\s?\d{1,2}\s?[/.\-]\s?\d{4}\b/g, ' ')
    .replace(/\b[XYZ0-9]\d{7}\s?-?\s?[A-Z]\b/g, ' ');
  const etiquetado = sinFechas.match(/\b(?:N\s?[º°ª9O0]\.?|NUM\.?|N[ÚU]MERO)\s*(?:DE\s+LICENCIA)?\s*[:.]?\s*([A-Z]{0,3}[\s-]?\d[\d\s.\-/]{4,}[A-Z]?)\b/);
  // Sin etiqueta no se adivina: una cifra suelta suele ser otra cosa (o un error de lectura).
  if (etiquetado) r.numero = etiquetado[1].replace(/[\s.]/g, '');
  return r;
}

/**
 * Junta varias lecturas de la misma foto: cada dato se toma de la primera que lo tenga,
 * y la tabla del reverso, de la que más filas haya leído.
 */
export function combinar(lecturas: DatosLeidos[]): DatosLeidos {
  const r: DatosLeidos = { filas: [] };
  for (const d of lecturas) {
    if (d.filas.length > r.filas.length) r.filas = d.filas;
    r.tipo ??= d.tipo;
    r.numero ??= d.numero;
    r.nif ??= d.nif;
    r.categoria ??= d.categoria;
    r.expedicion ??= d.expedicion;
    r.caducidad ??= d.caducidad;
  }
  // Si hay tabla, sus fechas mandan sobre las sueltas.
  const conTabla = lecturas.find((d) => d.filas === r.filas && d.filas.length);
  if (conTabla) {
    r.tipo = conTabla.tipo ?? r.tipo;
    r.expedicion = conTabla.expedicion;
    r.caducidad = conTabla.caducidad;
  }
  return r;
}
