import type { Arma, Mano, Modalidad, Sesion } from '@/data/types';
import { conclusion, NOMBRE_FALLO, type TipoFallo } from './conclusion';
import { MIN_IMPACTOS } from './grupo';
import { agrupacion, conPosicion, media, sumaSerie, todosLosDisparos, totalSesion } from './sesiones';
import { aISO, deISO } from './fechas';

// Herramientas para cuando hay muchos entrenamientos: filtros, resumen por meses, récords,
// fallos que se repiten, comparar periodos y exportar a Excel.

const conDisparos = (s: Sesion) => s.terminada && todosLosDisparos(s).length > 0;

/** Radio medio del grupo en mm, o null si no hay bastantes impactos marcados en la diana. */
export function grupoDe(s: Sesion): number | null {
  const d = todosLosDisparos(s);
  return conPosicion(d).length >= MIN_IMPACTOS ? agrupacion(d).radio : null;
}

// ---------- Filtros ----------

export interface Filtro {
  distancia?: number;
  modalidad?: Modalidad;
  municion?: string; // en minúsculas
  tipo?: 'entreno' | 'competicion';
}

export const claveMunicion = (m: string) => m.trim().toLowerCase();

export function filtrar(sesiones: Sesion[], f: Filtro): Sesion[] {
  return sesiones.filter((s) =>
    (f.distancia === undefined || s.distancia === f.distancia)
    && (f.modalidad === undefined || s.modalidad === f.modalidad)
    && (f.municion === undefined || claveMunicion(s.municion) === f.municion)
    && (f.tipo === undefined || (f.tipo === 'competicion') === !!s.competicion));
}

/** Qué valores hay para filtrar (solo tiene sentido mostrar un filtro si hay más de uno). */
export function opcionesFiltro(sesiones: Sesion[]) {
  const unicos = <T,>(xs: T[]) => [...new Set(xs)];
  const municiones = new Map<string, string>();
  for (const s of sesiones) if (s.municion.trim()) municiones.set(claveMunicion(s.municion), s.municion.trim());
  return {
    distancias: unicos(sesiones.map((s) => s.distancia)).sort((a, b) => a - b),
    modalidades: unicos(sesiones.map((s) => s.modalidad)),
    municiones: [...municiones].map(([clave, nombre]) => ({ clave, nombre })),
    competiciones: sesiones.some((s) => s.competicion) && sesiones.some((s) => !s.competicion),
  };
}

// ---------- Resumen por meses ----------

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** «octubre 2026» a partir de «2026-10». */
export const nombreMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`;

export interface Mes {
  mes: string; // aaaa-mm
  sesiones: Sesion[]; // la más reciente primero
  disparos: number;
  media: number;
  grupo: number | null; // radio medio de los entrenamientos con impactos marcados
}

export function porMes(sesiones: Sesion[]): Mes[] {
  const grupos = new Map<string, Sesion[]>();
  for (const s of sesiones) {
    const k = diaDe(s.fecha).slice(0, 7);
    grupos.set(k, [...(grupos.get(k) ?? []), s]);
  }
  return [...grupos].sort((a, b) => b[0].localeCompare(a[0])).map(([mes, lista]) => {
    const ordenadas = [...lista].sort((a, b) => b.fecha.localeCompare(a.fecha));
    const disparos = ordenadas.flatMap(todosLosDisparos);
    const grupos = ordenadas.map(grupoDe).filter((g): g is number => g !== null);
    return {
      mes, sesiones: ordenadas, disparos: disparos.length, media: media(disparos),
      grupo: grupos.length ? grupos.reduce((t, g) => t + g, 0) / grupos.length : null,
    };
  });
}

// ---------- Resumen por días ----------

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Día (aaaa-mm-dd) del entrenamiento en la hora del móvil: la fecha se guarda en UTC y un entreno a las 00:30 sería del día anterior. */
export function diaDe(fecha: string): string {
  const d = new Date(fecha);
  return Number.isNaN(d.getTime()) ? fecha.slice(0, 10) : aISO(d);
}

/** Hora del entrenamiento («10:14»), en la hora del móvil. */
export function horaDe(fecha: string): string {
  const d = new Date(fecha);
  return Number.isNaN(d.getTime()) || fecha.length <= 10 ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** «Sábado 31 de octubre» (con el año si no es el actual). */
export function nombreDia(dia: string): string {
  const d = deISO(dia);
  const texto = `${DIAS_SEMANA[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ` de ${d.getFullYear()}` : ''}`;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export interface Dia {
  dia: string; // aaaa-mm-dd
  sesiones: Sesion[]; // la más reciente primero
  disparos: number;
  media: number;
}

/** Entrenamientos agrupados por día, el más reciente primero. */
export function porDia(sesiones: Sesion[]): Dia[] {
  const grupos = new Map<string, Sesion[]>();
  for (const s of sesiones) {
    const k = diaDe(s.fecha);
    grupos.set(k, [...(grupos.get(k) ?? []), s]);
  }
  return [...grupos].sort((a, b) => b[0].localeCompare(a[0])).map(([dia, lista]) => {
    const ordenadas = [...lista].sort((a, b) => b.fecha.localeCompare(a.fecha));
    const disparos = ordenadas.flatMap(todosLosDisparos);
    return { dia, sesiones: ordenadas, disparos: disparos.length, media: media(disparos) };
  });
}

// ---------- Récords ----------

export interface Marca { valor: number; sesion: Sesion; detalle?: string }

export interface Records {
  distancia: number;
  media?: Marca; // mejor media por disparo (entrenamientos de 20 disparos o más)
  serie?: Marca; // mejor serie, en puntos (series de 10 disparos; si no hay, de 5)
  grupo?: Marca; // grupo más cerrado (radio medio, con 10 impactos marcados o más)
}

const MIN_DISPAROS_RECORD = 20;

function recordsDe(sesiones: Sesion[]): Omit<Records, 'distancia'> {
  const r: Omit<Records, 'distancia'> = {};
  for (const s of sesiones) {
    const d = todosLosDisparos(s);
    if (d.length >= MIN_DISPAROS_RECORD) {
      const m = media(d);
      if (!r.media || m > r.media.valor) r.media = { valor: m, sesion: s, detalle: `${totalSesion(s)} de ${d.length * 10}` };
    }
    if (conPosicion(d).length >= 10) {
      const g = agrupacion(d).radio;
      if (!r.grupo || g < r.grupo.valor) r.grupo = { valor: g, sesion: s };
    }
  }
  // La mejor serie, con series del mismo número de disparos para que se puedan comparar.
  for (const n of [10, 5]) {
    for (const s of sesiones) {
      for (const serie of s.series) {
        if (serie.disparos.length !== n) continue;
        const v = sumaSerie(serie);
        if (!r.serie || v > r.serie.valor) r.serie = { valor: v, sesion: s, detalle: `de ${n * 10}` };
      }
    }
    if (r.serie) break;
  }
  return r;
}

/** Récords de un arma, uno por distancia. */
export function records(sesiones: Sesion[]): Records[] {
  const validas = sesiones.filter(conDisparos);
  const distancias = [...new Set(validas.map((s) => s.distancia))].sort((a, b) => a - b);
  return distancias.map((distancia) => ({ distancia, ...recordsDe(validas.filter((s) => s.distancia === distancia)) }));
}

/**
 * Récords que bate esta sesión frente a las anteriores con la misma arma y distancia.
 * Solo a partir de 3 entrenamientos previos, para que los primeros días no sean todo récords.
 */
export function recordsBatidos(sesion: Sesion, todas: Sesion[]): string[] {
  const previas = todas.filter((s) => conDisparos(s) && s.id !== sesion.id && s.armaId === sesion.armaId
    && s.distancia === sesion.distancia && s.fecha < sesion.fecha);
  if (previas.length < 3) return [];
  const antes = recordsDe(previas);
  const ahora = recordsDe([sesion]);
  const batidos: string[] = [];
  if (ahora.media && (!antes.media || ahora.media.valor > antes.media.valor + 1e-9)) {
    batidos.push(`Tu mejor media a ${sesion.distancia} m: ${ahora.media.valor.toFixed(2).replace('.', ',')} por disparo`);
  }
  if (ahora.serie && ahora.serie.detalle === antes.serie?.detalle && ahora.serie.valor > antes.serie!.valor) {
    batidos.push(`Tu mejor serie: ${ahora.serie.valor} ${ahora.serie.detalle}`);
  }
  if (ahora.grupo && antes.grupo && ahora.grupo.valor < antes.grupo.valor) {
    batidos.push(`Tu grupo más cerrado: ${Math.round(ahora.grupo.valor)} mm de radio medio`);
  }
  return batidos;
}

// ---------- Fallos que se repiten ----------

export interface FalloRepetido {
  tipo: TipoFallo;
  nombre: string;
  veces: number; // en cuántos entrenamientos sale
  recientes?: number; // en la mitad más reciente
  anteriores?: number; // en la mitad más antigua
  hacer: string; // el consejo de la última vez que salió
}

/**
 * Qué fallos salen en «Lo que tienes que corregir» y cuántas veces, en los últimos `cuantos`
 * entrenamientos. Con 10 o más, compara la mitad reciente con la antigua para ver si mejoras.
 */
export function fallosRepetidos(sesiones: Sesion[], armas: Arma[], mano?: Mano, cuantos = 20) {
  const ultimas = sesiones.filter(conDisparos).sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, cuantos);
  const conSitio = ultimas.filter((s) => conPosicion(todosLosDisparos(s)).length >= MIN_IMPACTOS).length;
  const mitad = Math.floor(ultimas.length / 2);
  const cuenta = new Map<TipoFallo, FalloRepetido>();
  ultimas.forEach((s, i) => {
    const c = conclusion(s, armas.find((a) => a.id === s.armaId), mano);
    for (const m of new Map(c.mejorar.map((x) => [x.tipo, x])).values()) {
      const f = cuenta.get(m.tipo) ?? { tipo: m.tipo, nombre: NOMBRE_FALLO[m.tipo], veces: 0, recientes: 0, anteriores: 0, hacer: m.hacer };
      f.veces++;
      if (i < mitad) f.recientes!++;
      else if (i >= ultimas.length - mitad) f.anteriores!++;
      cuenta.set(m.tipo, f);
    }
  });
  const fallos = [...cuenta.values()]
    .map((f) => (ultimas.length >= 10 ? f : { ...f, recientes: undefined, anteriores: undefined }))
    .sort((a, b) => b.veces - a.veces);
  return { entrenos: ultimas.length, conSitio, fallos };
}

// ---------- Comparar periodos ----------

export type Periodo = 'mes' | 'trimestre' | 'año';

export interface Resumen { entrenos: number; disparos: number; media: number | null; grupo: number | null }

function resumen(sesiones: Sesion[]): Resumen {
  const d = sesiones.flatMap(todosLosDisparos);
  const grupos = sesiones.map(grupoDe).filter((g): g is number => g !== null);
  return {
    entrenos: sesiones.length, disparos: d.length, media: d.length ? media(d) : null,
    grupo: grupos.length ? grupos.reduce((t, g) => t + g, 0) / grupos.length : null,
  };
}

/** El periodo en curso (este mes, este trimestre, este año) frente al anterior completo. */
export function comparar(sesiones: Sesion[], periodo: Periodo, hoy = new Date()) {
  const meses = periodo === 'mes' ? 1 : periodo === 'trimestre' ? 3 : 12;
  const inicio = periodo === 'año' ? new Date(hoy.getFullYear(), 0, 1)
    : new Date(hoy.getFullYear(), hoy.getMonth() - (periodo === 'trimestre' ? hoy.getMonth() % 3 : 0), 1);
  const antes = new Date(inicio.getFullYear(), inicio.getMonth() - meses, 1);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  const validas = sesiones.filter(conDisparos);
  const actual = validas.filter((s) => s.fecha.slice(0, 10) >= iso(inicio));
  const anterior = validas.filter((s) => s.fecha.slice(0, 10) >= iso(antes) && s.fecha.slice(0, 10) < iso(inicio));
  const nombres: Record<Periodo, [string, string]> = {
    mes: ['Este mes', 'El mes pasado'],
    trimestre: ['Este trimestre', 'El trimestre pasado'],
    año: ['Este año', 'El año pasado'],
  };
  return { actual: resumen(actual), anterior: resumen(anterior), nombres: nombres[periodo] };
}

// ---------- Exportar a Excel ----------

/**
 * Una fila por entrenamiento, separada por «;» y con coma decimal, que es como la abre Excel en español.
 * Empieza con la marca BOM para que Excel lea bien las tildes.
 */
export function aCsv(sesiones: Sesion[], armas: Arma[]): string {
  const num = (n: number | null | undefined, dec = 1) => (n === null || n === undefined ? '' : n.toFixed(dec).replace('.', ','));
  const texto = (t: string) => (/[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t);
  const cabecera = ['Fecha', 'Hora', 'Arma', 'Tipo', 'Modalidad', 'Distancia (m)', 'Munición', 'Disparos', 'Puntos', 'Máximo',
    'Media', 'Dieces', 'Mejor serie', 'Peor serie', 'Grupo radio medio (mm)', 'Centro horizontal (mm, + derecha)',
    'Centro vertical (mm, + abajo)'];
  const filas = [...sesiones].filter(conDisparos).sort((a, b) => a.fecha.localeCompare(b.fecha)).map((s) => {
    const d = todosLosDisparos(s);
    const arma = armas.find((a) => a.id === s.armaId);
    const sumas = s.series.filter((x) => x.disparos.length).map(sumaSerie);
    const g = grupoDe(s);
    const c = g !== null ? agrupacion(d) : null;
    return [
      s.fecha.slice(0, 10).split('-').reverse().join('/'), s.fecha.slice(11, 16),
      texto(arma ? `${arma.marca} ${arma.modelo}`.trim() : 'Arma borrada'), s.competicion ? 'Competición' : 'Entreno',
      s.modalidad, String(s.distancia), texto(s.municion.trim()), String(d.length), String(totalSesion(s)), String(d.length * 10),
      num(media(d), 2), String(d.filter((x) => x.valor === 10).length), String(Math.max(...sumas)), String(Math.min(...sumas)),
      num(g), num(c?.cx ?? null), num(c?.cy ?? null),
    ].join(';');
  });
  return `﻿${[cabecera.join(';'), ...filas].join('\r\n')}\r\n`;
}
