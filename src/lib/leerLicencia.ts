import type { TipoLicencia } from '@/data/types';

/** Una fila de la tabla del reverso: tipo de licencia, válida desde y válida hasta. */
export interface FilaLicencia {
  tipo?: TipoLicencia; // sin tipo si el OCR no ha leído la letra
  desde: string; // ISO
  hasta: string; // ISO
  dudosa?: boolean; // la letra se ha deducido por el orden de la tarjeta
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

/** Orden de las filas en la tabla del reverso de la tarjeta. */
const ORDEN: TipoLicencia[] = ['E', 'F', 'D'];

/**
 * Pone una letra distinta a cada fila. Si el OCR ha leído letras repetidas (una E leída como F)
 * o no ha leído alguna, se reparten siguiendo el orden de la tarjeta (E, F, D) respetando las
 * letras que sí cuadran. Las filas cuya letra se ha deducido quedan marcadas como dudosas.
 */
export function repartirTipos(filas: FilaLicencia[]): FilaLicencia[] {
  const leidas = filas.map((f) => f.tipo);
  const unicas = leidas.every((t, i) => t && leidas.indexOf(t) === i);
  if (unicas || filas.length > ORDEN.length) return filas;
  // Todas las formas de elegir letras en orden para estas filas; gana la que más letras leídas respeta.
  const opciones: TipoLicencia[][] = [];
  const elegir = (desde: number, actual: TipoLicencia[]) => {
    if (actual.length === filas.length) return void opciones.push(actual);
    for (let i = desde; i < ORDEN.length; i++) elegir(i + 1, [...actual, ORDEN[i]]);
  };
  elegir(0, []);
  const aciertos = (o: TipoLicencia[]) => o.filter((t, i) => t === leidas[i]).length;
  const mejor = opciones.reduce((a, b) => (aciertos(b) > aciertos(a) ? b : a));
  return filas.map((f, i) => (mejor[i] === f.tipo ? f : { ...f, tipo: mejor[i], dudosa: true }));
}

/**
 * Filas de la tabla del reverso (como en el carné de conducir): «E 11-05-2022 11-05-2027».
 * Cada línea con dos fechas separadas por unos 5 años es una licencia: la primera fecha es
 * «válida desde» y la segunda «válida hasta». La letra (F, D o E) va delante en la misma línea o,
 * si el OCR la ha partido, sola en la línea anterior.
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
    // Una letra repetida no descarta la fila: suele ser otra licencia con la letra mal leída.
    if (creible && !filas.some((x) => x.desde === desde && x.hasta === hasta)) filas.push({ tipo, desde, hasta });
  }
  return repartirTipos(filas);
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
 * Junta varias lecturas de la misma foto: cada dato se toma de la primera que lo tenga.
 * La tabla del reverso parte de la lectura con más filas (y más letras seguras) y se completa
 * con las filas que solo haya visto otra lectura.
 */
export function combinar(lecturas: DatosLeidos[]): DatosLeidos {
  const r: DatosLeidos = { filas: [] };
  const seguras = (d: DatosLeidos) => d.filas.filter((f) => f.tipo && !f.dudosa).length;
  const base = [...lecturas].sort((a, b) => b.filas.length - a.filas.length || seguras(b) - seguras(a))[0];
  if (base) {
    const filas = [...base.filas];
    for (const d of lecturas) {
      for (const f of d.filas) {
        const i = filas.findIndex((x) => x.desde === f.desde && x.hasta === f.hasta);
        // Misma fila: si aquí la letra es dudosa y en la otra lectura es segura, gana la segura.
        if (i >= 0) {
          if (f.tipo && !f.dudosa && filas[i].dudosa) filas[i] = f;
        } else if (!filas.some((x) => x.hasta === f.hasta)) {
          filas.push(f);
        }
      }
    }
    // Si al juntar se repite alguna letra, se vuelven a repartir.
    r.filas = repartirTipos(filas);
  }
  for (const d of lecturas) {
    r.tipo ??= d.tipo;
    r.numero ??= d.numero;
    r.nif ??= d.nif;
    r.categoria ??= d.categoria;
    r.expedicion ??= d.expedicion;
    r.caducidad ??= d.caducidad;
  }
  // Si hay tabla, sus fechas mandan sobre las sueltas.
  if (base?.filas.length) {
    r.tipo = base.tipo ?? r.tipo;
    r.expedicion = base.expedicion;
    r.caducidad = base.caducidad;
  }
  return r;
}
