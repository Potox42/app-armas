import type { Disparo, Serie, Sesion } from '@/data/types';

export const sumaSerie = (s: Serie) => s.disparos.reduce((t, d) => t + d.valor, 0);
export const todosLosDisparos = (s: Sesion): Disparo[] => s.series.flatMap((x) => x.disparos);
export const totalSesion = (s: Sesion) => todosLosDisparos(s).reduce((t, d) => t + d.valor, 0);

export function media(disparos: Disparo[]): number {
  return disparos.length ? disparos.reduce((t, d) => t + d.valor, 0) / disparos.length : 0;
}

/** Centro medio de los impactos (mm) y radio medio de agrupación respecto a ese centro. */
export function agrupacion(disparos: Disparo[]) {
  if (disparos.length === 0) return { cx: 0, cy: 0, radio: 0 };
  const cx = disparos.reduce((t, d) => t + d.x, 0) / disparos.length;
  const cy = disparos.reduce((t, d) => t + d.y, 0) / disparos.length;
  const radio = disparos.reduce((t, d) => t + Math.hypot(d.x - cx, d.y - cy), 0) / disparos.length;
  return { cx, cy, radio };
}

export const formatoMedia = (n: number) => n.toFixed(1).replace('.', ',');
