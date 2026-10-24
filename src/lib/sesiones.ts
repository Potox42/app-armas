import type { Disparo, Serie, Sesion } from '@/data/types';

export const sumaSerie = (s: Serie) => s.disparos.reduce((t, d) => t + d.valor, 0);
export const todosLosDisparos = (s: Sesion): Disparo[] => s.series.flatMap((x) => x.disparos);
export const totalSesion = (s: Sesion) => todosLosDisparos(s).reduce((t, d) => t + d.valor, 0);

export function media(disparos: Disparo[]): number {
  return disparos.length ? disparos.reduce((t, d) => t + d.valor, 0) / disparos.length : 0;
}

/** Disparos marcados en la diana (los del teclado de puntuación no tienen posición). */
export const conPosicion = (disparos: Disparo[]) => disparos.filter((d) => !d.sinPosicion);

/** Centro medio de los impactos (mm) y radio medio de agrupación respecto a ese centro. */
export function agrupacion(todos: Disparo[]) {
  const disparos = conPosicion(todos);
  if (disparos.length === 0) return { cx: 0, cy: 0, radio: 0 };
  const cx = disparos.reduce((t, d) => t + d.x, 0) / disparos.length;
  const cy = disparos.reduce((t, d) => t + d.y, 0) / disparos.length;
  const radio = disparos.reduce((t, d) => t + Math.hypot(d.x - cx, d.y - cy), 0) / disparos.length;
  return { cx, cy, radio };
}

/**
 * Diámetro del grupo: distancia entre los centros de los dos impactos más alejados (mm), la medida
 * habitual de agrupación. Para medirlo de borde a borde en el papel, súmale un calibre.
 */
export function diametroGrupo(todos: Disparo[]): number {
  const d = conPosicion(todos);
  let max = 0;
  for (let i = 0; i < d.length; i++) {
    for (let j = i + 1; j < d.length; j++) max = Math.max(max, Math.hypot(d[i].x - d[j].x, d[i].y - d[j].y));
  }
  return max;
}

/** Mejor y peor serie (índice y puntos) y diferencia entre ellas. */
export function extremos(s: Sesion) {
  const sumas = s.series.map(sumaSerie);
  const mejor = sumas.indexOf(Math.max(...sumas));
  const peor = sumas.indexOf(Math.min(...sumas));
  return { sumas, mejor, peor, diferencia: sumas[mejor] - sumas[peor] };
}

/** Número de diana (desde 0) de una serie. Las sesiones de versiones anteriores son de una sola diana. */
export const numDiana = (s: Serie) => s.diana ?? 0;

/** Las dianas de la sesión, en orden, con sus series (solo las que tienen disparos). */
export function dianasDe(s: Sesion): { n: number; series: Serie[]; disparos: Disparo[] }[] {
  const grupos: { n: number; series: Serie[]; disparos: Disparo[] }[] = [];
  for (const serie of s.series) {
    if (serie.disparos.length === 0) continue;
    const n = numDiana(serie);
    let g = grupos.find((x) => x.n === n);
    if (!g) grupos.push((g = { n, series: [], disparos: [] }));
    g.series.push(serie);
    g.disparos.push(...serie.disparos);
  }
  return grupos;
}

/** La sesión vista solo con las series de una diana (para reutilizar los mismos cálculos). */
export const soloDiana = (s: Sesion, n: number): Sesion => ({ ...s, series: s.series.filter((x) => numDiana(x) === n) });

export const formatoMedia = (n: number) => n.toFixed(1).replace('.', ',');
