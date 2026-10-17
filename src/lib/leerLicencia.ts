import type { TipoLicencia } from '@/data/types';

export interface DatosLeidos {
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
  for (const m of t.matchAll(/\b(\d{1,2})\s?[/.\-\s]\s?(\d{1,2})\s?[/.\-\s]\s?(\d{4})\b/g)) {
    const f = iso(+m[1], +m[2], +m[3]);
    if (f) res.push(f);
  }
  for (const m of t.matchAll(/\b(\d{1,2})[\s.\-/]*(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|SET|OCT|NOV|DIC)[A-Z]*[\s.\-/]*(\d{4})\b/g)) {
    const f = iso(+m[1], MESES[m[2]], +m[3]);
    if (f) res.push(f);
  }
  return [...new Set(res)].sort();
}

/**
 * Intenta sacar los datos de una licencia de armas del texto leído por OCR.
 * No conocemos todos los modelos de tarjeta, así que se buscan patrones generales
 * y la persona revisa siempre el resultado antes de guardar.
 */
export function leerLicencia(texto: string, hoy = new Date().toISOString().slice(0, 10)): DatosLeidos {
  const t = normalizar(texto);
  const r: DatosLeidos = {};

  const tipo = t.match(/\b(?:TIPO|CLASE|LICENCIA(?:\s+DE\s+ARMAS)?)\s*[:.\-]?\s*["'«]?([FDE])\b/);
  if (tipo) r.tipo = tipo[1] as TipoLicencia;

  const fechas = fechasDe(texto);
  if (fechas.length >= 2) {
    r.expedicion = fechas[0];
    r.caducidad = fechas[fechas.length - 1];
    // Las fechas anteriores a 1990 suelen ser la de nacimiento: se descartan.
    const utiles = fechas.filter((f) => f >= '1990-01-01');
    if (utiles.length >= 2) {
      r.expedicion = utiles[0];
      r.caducidad = utiles[utiles.length - 1];
    } else if (utiles.length === 1) {
      r.expedicion = undefined;
      r.caducidad = undefined;
      if (utiles[0] > hoy) r.caducidad = utiles[0];
      else r.expedicion = utiles[0];
    }
  } else if (fechas.length === 1) {
    if (fechas[0] > hoy) r.caducidad = fechas[0];
    else r.expedicion = fechas[0];
  }

  // Número: primero el que va detrás de «Nº», «NUM.» o «NÚMERO»; si no, una cifra larga
  // que no sea una fecha ni tenga forma de DNI/NIE.
  // Se quitan también el NIF/NIE del titular (05285531-Q, X1234567-L), que no es el número de licencia.
  const sinFechas = t
    .replace(/\b\d{1,2}\s?[/.\-]\s?\d{1,2}\s?[/.\-]\s?\d{4}\b/g, ' ')
    .replace(/\b[XYZ0-9]\d{7}\s?-?\s?[A-Z]\b/g, ' ');
  const etiquetado = sinFechas.match(/\b(?:N[º°O]\.?|NUM\.?|N[ÚU]MERO)\s*(?:DE\s+LICENCIA)?\s*[:.]?\s*([A-Z]{0,3}[\s-]?\d[\d\s.\-/]{4,}[A-Z]?)\b/);
  if (etiquetado) {
    r.numero = etiquetado[1].replace(/[\s.]/g, '');
  } else {
    const candidato = sinFechas.match(/\b[A-Z]{0,3}-?\d{6,}[A-Z]?\b/);
    if (candidato) r.numero = candidato[0];
  }
  return r;
}
