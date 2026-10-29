import type { Arma, Disparo, Serie } from '@/data/types';
import { puntuar, type ModeloDiana } from './diana';

// Medidas y lectura de un grupo de impactos (una diana o una sesión). Todo en mm, x a la derecha e y hacia abajo.
// Medidas: las de las dianas electrónicas (docs.kongsbergtargets.com, «Understanding Series Statistics»).
// Posibles causas: zonatactica.es, «Análisis de los impactos en el blanco» I y II. Son orientación, no un diagnóstico.

export const MIN_IMPACTOS = 5; // por debajo, las medidas cambian demasiado de un disparo a otro

export interface Medidas {
  n: number;
  cx: number; // centro de impactos
  cy: number;
  radioMedio: number; // distancia media de cada impacto al centro
  cep50: number; // radio del círculo (con centro en el grupo) donde cae la mitad de los impactos
  dispersion: number; // mayor distancia entre dos impactos (de centro a centro)
  par: [Disparo, Disparo]; // los dos impactos más separados
  ancho: number; // del impacto más a la izquierda al más a la derecha
  alto: number;
}

export function medidas(todos: Disparo[]): Medidas | null {
  const d = todos.filter((x) => !x.sinPosicion);
  if (d.length < 2) return null;
  const cx = d.reduce((t, x) => t + x.x, 0) / d.length;
  const cy = d.reduce((t, x) => t + x.y, 0) / d.length;
  const dist = d.map((x) => Math.hypot(x.x - cx, x.y - cy)).sort((a, b) => a - b);
  const m = Math.floor(dist.length / 2);
  let par: [Disparo, Disparo] = [d[0], d[1]];
  let dispersion = 0;
  for (let i = 0; i < d.length; i++) {
    for (let j = i + 1; j < d.length; j++) {
      const v = Math.hypot(d[i].x - d[j].x, d[i].y - d[j].y);
      if (v > dispersion) { dispersion = v; par = [d[i], d[j]]; }
    }
  }
  const xs = d.map((x) => x.x), ys = d.map((x) => x.y);
  return {
    n: d.length, cx, cy,
    radioMedio: dist.reduce((t, v) => t + v, 0) / d.length,
    cep50: dist.length % 2 ? dist[m] : (dist[m - 1] + dist[m]) / 2,
    dispersion, par,
    ancho: Math.max(...xs) - Math.min(...xs),
    alto: Math.max(...ys) - Math.min(...ys),
  };
}

/** El anillo más pequeño en el que cabe un círculo del tamaño dado (diámetro en mm), o null si no cabe ni en el 1. */
export function anilloDondeCabe(diametro: number, diana: ModeloDiana): number | null {
  for (let v = 10; v >= 1; v--) {
    const a = diana.anillos[v];
    if (a !== undefined && a >= diametro) return v;
  }
  return null;
}

export type Forma = 'redondo' | 'vertical' | 'horizontal' | 'oblicuo';

/** Si el grupo es redondo o alargado (y hacia dónde), con la dispersión en cada dirección. */
export function forma(todos: Disparo[]): { forma: Forma; proporcion: number } {
  const d = todos.filter((x) => !x.sinPosicion);
  if (d.length < MIN_IMPACTOS) return { forma: 'redondo', proporcion: 1 };
  const cx = d.reduce((t, x) => t + x.x, 0) / d.length;
  const cy = d.reduce((t, x) => t + x.y, 0) / d.length;
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of d) {
    sxx += (p.x - cx) ** 2;
    syy += (p.y - cy) ** 2;
    sxy += (p.x - cx) * (p.y - cy);
  }
  // Ejes de la elipse que mejor envuelve el grupo.
  const tr = sxx + syy, det = sxx * syy - sxy * sxy;
  const raiz = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  const mayor = tr / 2 + raiz, menor = Math.max(1e-9, tr / 2 - raiz);
  const proporcion = Math.sqrt(mayor / menor);
  if (proporcion < 1.8) return { forma: 'redondo', proporcion };
  const angulo = Math.abs((Math.atan2(2 * sxy, sxx - syy) / 2) * (180 / Math.PI)); // 0 = horizontal, 90 = vertical
  return { forma: angulo < 30 ? 'horizontal' : angulo > 60 ? 'vertical' : 'oblicuo', proporcion };
}

/** Impacto suelto: muy lejos del resto del grupo. Cada uno con su posición dentro de la serie. */
export interface Suelto { disparo: Disparo; serie: number; enSerie: number; deSerie: number }

export function sueltos(series: Serie[]): Suelto[] {
  const lista = series.flatMap((s, i) => {
    const conSitio = s.disparos.filter((d) => !d.sinPosicion);
    return conSitio.map((d, j) => ({ disparo: d, serie: i, enSerie: j, deSerie: conSitio.length }));
  });
  if (lista.length < 6) return [];
  const fuera = lista.filter((x) => {
    const resto = lista.filter((y) => y !== x).map((y) => y.disparo);
    const cx = resto.reduce((t, p) => t + p.x, 0) / resto.length;
    const cy = resto.reduce((t, p) => t + p.y, 0) / resto.length;
    const rm = resto.reduce((t, p) => t + Math.hypot(p.x - cx, p.y - cy), 0) / resto.length;
    // Más de 3,5 veces el radio medio: en un grupo normal pasa menos de 1 vez de cada 10.000.
    return Math.hypot(x.disparo.x - cx, x.disparo.y - cy) > 3.5 * Math.max(rm, 1);
  });
  // Si hay muchos «sueltos» no son sueltos: el grupo entero está abierto.
  return fuera.length <= Math.max(1, Math.floor(lista.length / 10)) ? fuera : [];
}

/** Dos grupos separados en la misma diana (por ejemplo, al cambiar de postura a mitad). */
export function dosGrupos(todos: Disparo[]): [Disparo[], Disparo[]] | null {
  const d = todos.filter((x) => !x.sinPosicion);
  if (d.length < 8) return null;
  const m = medidas(d)!;
  let a = { x: m.par[0].x, y: m.par[0].y }, b = { x: m.par[1].x, y: m.par[1].y };
  let ga: Disparo[] = [], gb: Disparo[] = [];
  for (let k = 0; k < 10; k++) {
    ga = d.filter((p) => Math.hypot(p.x - a.x, p.y - a.y) <= Math.hypot(p.x - b.x, p.y - b.y));
    gb = d.filter((p) => !ga.includes(p));
    if (!ga.length || !gb.length) return null;
    a = centro(ga);
    b = centro(gb);
  }
  if (ga.length < 3 || gb.length < 3) return null;
  const rm = (g: Disparo[], c: { x: number; y: number }) => g.reduce((t, p) => t + Math.hypot(p.x - c.x, p.y - c.y), 0) / g.length;
  const separados = Math.hypot(a.x - b.x, a.y - b.y) > 3 * Math.max(rm(ga, a), rm(gb, b), 1);
  return separados ? [ga, gb] : null;
}

const centro = (g: Disparo[]) => ({ x: g.reduce((t, p) => t + p.x, 0) / g.length, y: g.reduce((t, p) => t + p.y, 0) / g.length });

/** Centro de cada serie (con al menos 3 impactos marcados) y si se mueve más de lo normal de una a otra. */
export function centrosSeries(series: Serie[]): { centros: { serie: number; x: number; y: number }[]; seMueve: boolean } {
  const centros = series
    .map((s, i) => ({ serie: i, d: s.disparos.filter((x) => !x.sinPosicion) }))
    .filter((s) => s.d.length >= 3)
    .map((s) => ({ serie: s.serie, ...centro(s.d), n: s.d.length }));
  if (centros.length < 3) return { centros, seMueve: false };
  const todos = series.flatMap((s) => s.disparos.filter((x) => !x.sinPosicion));
  const m = medidas(todos)!;
  const nMedio = centros.reduce((t, c) => t + c.n, 0) / centros.length;
  const separacion = centros.reduce((t, c) => t + Math.hypot(c.x - m.cx, c.y - m.cy), 0) / centros.length;
  // Por azar, el centro de una serie de n disparos se separa del total alrededor de radioMedio / √n.
  return { centros, seMueve: separacion > 1.8 * (m.radioMedio / Math.sqrt(nMedio)) };
}

/** ¿El centro está lejos del centro de la diana? Algo más de un tercio de anillo y más de lo que da el azar. */
export function desplazado(m: Medidas, diana: ModeloDiana): boolean {
  const anillo = (diana.anillos[8] - diana.anillos[9]) / 2;
  return Math.hypot(m.cx, m.cy) > Math.max(anillo * 0.35, (2 * m.radioMedio) / Math.sqrt(m.n));
}

/** Puntos que habrías sumado con el mismo grupo, pero centrado. */
export function puntosSiCentrado(todos: Disparo[], m: Medidas, calibre: number, diana: ModeloDiana): number {
  const d = todos.filter((x) => !x.sinPosicion);
  return d.reduce((t, p) => t + puntuar(p.x - m.cx, p.y - m.cy, calibre, diana) - p.valor, 0);
}

/** Cuánto hay que mover los impactos (mm, MOA, MIL y clics del visor si los sabemos) para llevarlos al centro. */
export interface Correccion {
  mm: number; // positivo: hacia la derecha / hacia arriba
  moa: number;
  mil: number;
  clics?: number;
}

const MOA_MM_POR_M = 0.290888; // 1 MOA = 1/60 de grado: 29,09 mm a 100 m
// 1 MIL (milirradián) = 1 mm por cada metro de distancia.

export function correccion(cx: number, cy: number, distancia: number, clic?: Arma['clic']): { horizontal: Correccion; vertical: Correccion } {
  const una = (mm: number): Correccion => {
    const moa = mm / (MOA_MM_POR_M * distancia);
    const mil = mm / distancia;
    const clics = clic && clic.valor > 0 ? (clic.unidad === 'MOA' ? moa : mil) / clic.valor : undefined;
    return { mm, moa, mil, clics };
  };
  // Para llevar el grupo al centro hay que moverlo al revés de donde está.
  return { horizontal: una(-cx), vertical: una(cy) };
}

const dos = (n: number) => n.toFixed(Math.abs(n) < 10 ? 1 : 0).replace('.', ',');

/** «3 clics (0,8 MOA) arriba», «12 mm a la derecha»… */
export function textoCorreccion(c: Correccion, eje: 'h' | 'v', clic?: Arma['clic']): string {
  const lado = eje === 'h' ? (c.mm > 0 ? 'a la derecha' : 'a la izquierda') : c.mm > 0 ? 'arriba' : 'abajo';
  const mm = `${Math.round(Math.abs(c.mm))} mm`;
  if (c.clics !== undefined && clic) {
    const n = Math.round(Math.abs(c.clics));
    return `${n} ${n === 1 ? 'clic' : 'clics'} ${lado} (${mm}, ${dos(Math.abs(clic.unidad === 'MOA' ? c.moa : c.mil))} ${clic.unidad})`;
  }
  return `${mm} ${lado} (${dos(Math.abs(c.moa))} MOA · ${dos(Math.abs(c.mil))} MIL)`;
}
