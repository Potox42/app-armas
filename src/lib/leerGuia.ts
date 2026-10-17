import type { TipoArma, TipoLicencia } from '@/data/types';

export interface GuiaLeida {
  marca?: string;
  modelo?: string;
  calibre?: string;
  numeroSerie?: string;
  numeroGuia?: string;
  fechaGuia?: string; // ISO
  tipo?: TipoArma;
  licencia?: TipoLicencia;
}

const TIPOS: [RegExp, TipoArma][] = [
  [/\bPISTOLA\b/, 'Pistola'],
  [/\bREV[OÓ]LVER\b/, 'Revólver'],
  [/\bCARABINA\b/, 'Carabina'],
  [/\bRIFLE\b/, 'Rifle'],
  [/\bESCOPETA\b/, 'Escopeta'],
];

// Etiquetas que suelen llevar las guías. Si el valor no va en la misma línea, va en la siguiente.
const ETIQUETAS = {
  marca: /\bMARCA\b/,
  modelo: /\bMODELO\b/,
  calibre: /\bCALIBRE\b/,
  numeroSerie: /\bN(?:[ºª°O]|[ÚU]MERO|UM\.?)\s*(?:DE\s+)?(?:SERIE|FABRICACI[OÓ]N|ARMA|DEL\s+ARMA)\b|\bSERIE\b/,
  numeroGuia: /\bGU[IÍ]A\s*(?:DE\s+PERTENENCIA\s*)?N[ºª°O]?\.?|\bN(?:[ºª°O]|[ÚU]MERO)\s*(?:DE\s+)?GU[IÍ]A\b/,
  fecha: /\bFECHA\s*(?:DE\s+)?(?:EXPEDICI[OÓ]N|EMISI[OÓ]N|ALTA)?\b/,
};
const CUALQUIER_ETIQUETA = new RegExp(Object.values(ETIQUETAS).map((r) => r.source).join('|'));

function iso(d: number, m: number, y: number): string | null {
  const f = new Date(y, m - 1, d);
  if (f.getFullYear() !== y || f.getMonth() !== m - 1 || f.getDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function fecha(texto: string): string | undefined {
  const m = texto.match(/\b(\d{1,2})\s?[/.\-]\s?(\d{1,2})\s?[/.\-]\s?(\d{4})\b/);
  return (m && iso(+m[1], +m[2], +m[3])) || undefined;
}

/** Lo que va detrás de la etiqueta en la misma línea o, si no hay nada, la línea siguiente. */
function valorDe(lineas: string[], etiqueta: RegExp): string | undefined {
  for (let i = 0; i < lineas.length; i++) {
    const m = lineas[i].match(etiqueta);
    if (!m) continue;
    const resto = lineas[i].slice((m.index ?? 0) + m[0].length).replace(/^[\s:.\-|]+/, '');
    // Si en la misma línea viene otra etiqueta (p. ej. «MARCA: X  MODELO: Y»), se corta ahí.
    const corte = resto.search(CUALQUIER_ETIQUETA);
    const propio = (corte > 0 ? resto.slice(0, corte) : corte === 0 ? '' : resto).trim();
    if (propio) return propio;
    const siguiente = lineas[i + 1]?.trim();
    if (siguiente && !CUALQUIER_ETIQUETA.test(siguiente)) return siguiente;
  }
  return undefined;
}

const limpiar = (v?: string) => v?.replace(/[|_«»"']/g, '').replace(/\s{2,}/g, ' ').trim() || undefined;
const titulo = (v?: string) => v && v.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase());

/** Calibre en la forma habitual: «.22 LR», «9 mm», «9x19». */
function calibre(v?: string): string | undefined {
  if (!v) return undefined;
  const t = v.replace(/,/g, '.').replace(/\s+/g, ' ').trim();
  const lr = t.match(/^\.?\s?22\s?(L\.?R\.?|LONG RIFLE)/);
  if (lr) return '.22 LR';
  const x = t.match(/^(\d{1,2}(?:[.,]\d{1,2})?)\s?[X×]\s?(\d{2})/);
  if (x) return `${x[1]}x${x[2]}`;
  const mm = t.match(/^(\d{1,2}(?:\.\d{1,2})?)\s?MM\b/);
  if (mm) return `${mm[1]} mm`;
  return t.split(' ').slice(0, 3).join(' ');
}

/**
 * Datos de una guía de pertenencia leídos por OCR. No conocemos todos los modelos de guía,
 * así que se buscan las etiquetas habituales; la persona revisa siempre el resultado.
 */
export function leerGuia(texto: string, hoy = new Date().toISOString().slice(0, 10)): GuiaLeida {
  const t = texto.toUpperCase();
  const lineas = t.split('\n').map((l) => l.trim()).filter(Boolean);
  const r: GuiaLeida = {};

  r.marca = titulo(limpiar(valorDe(lineas, ETIQUETAS.marca))?.split(' ').slice(0, 3).join(' '));
  r.modelo = limpiar(valorDe(lineas, ETIQUETAS.modelo))?.split(' ').slice(0, 4).join(' ');
  r.calibre = calibre(limpiar(valorDe(lineas, ETIQUETAS.calibre)));
  // Admite un prefijo de letras separado: «W 98765» → «W98765».
  r.numeroSerie = limpiar(valorDe(lineas, ETIQUETAS.numeroSerie))?.match(/^[A-Z]{0,3}\s?[0-9A-Z\-/]+/)?.[0].replace(/\s/g, '');
  r.numeroGuia = limpiar(valorDe(lineas, ETIQUETAS.numeroGuia))?.match(/[A-Z0-9][A-Z0-9/\-.]{3,}/)?.[0];

  const conEtiqueta = fecha(valorDe(lineas, ETIQUETAS.fecha) ?? '');
  const sueltas = [...t.matchAll(/\b(\d{1,2})\s?[/.\-]\s?(\d{1,2})\s?[/.\-]\s?(\d{4})\b/g)]
    .map((m) => iso(+m[1], +m[2], +m[3]))
    .filter((f): f is string => !!f && f >= '1990-01-01' && f <= hoy)
    .sort();
  r.fechaGuia = conEtiqueta && conEtiqueta <= hoy ? conEtiqueta : sueltas[sueltas.length - 1];

  const zonaTipo = valorDe(lineas, /\b(?:CLASE|TIPO)\s*(?:DE\s+ARMA)?\b/) ?? t;
  r.tipo = TIPOS.find(([re]) => re.test(zonaTipo))?.[1] ?? TIPOS.find(([re]) => re.test(t))?.[1];
  const lic = t.match(/\bLICENCIA\s*(?:TIPO\s*)?[:.\-]?\s*["'«]?([FDE])\b/);
  if (lic) r.licencia = lic[1] as TipoLicencia;

  for (const k of Object.keys(r) as (keyof GuiaLeida)[]) if (r[k] === undefined) delete r[k];
  return r;
}

/** Junta varias lecturas de la misma foto: cada dato, de la primera que lo tenga. */
export function combinarGuia(lecturas: GuiaLeida[]): GuiaLeida {
  const r: GuiaLeida = {};
  for (const d of lecturas) {
    for (const k of Object.keys(d) as (keyof GuiaLeida)[]) {
      if (r[k] === undefined) (r as Record<string, unknown>)[k] = d[k];
    }
  }
  return r;
}
