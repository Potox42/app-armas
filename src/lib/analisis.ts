import type { Arma, Sesion } from '@/data/types';
import { geometria } from './diana';
import { agrupacion, conPosicion, media, sumaSerie, todosLosDisparos } from './sesiones';

// Análisis de varios entrenamientos. Solo describe lo que dicen tus datos; si no hay bastantes,
// lo dice en lugar de sacar conclusiones.

const terminadas = (sesiones: Sesion[]) => sesiones.filter((s) => s.terminada && todosLosDisparos(s).length > 0);

export interface Desvio {
  sesiones: number; // entrenamientos con impactos marcados en la diana
  disparos: number;
  x: number; // centro medio en «radios del negro» (1 = borde del negro), positivo a la derecha
  y: number; // positivo hacia abajo
  centros: { x: number; y: number }[]; // centro de cada entrenamiento, en la misma escala
  constante: number; // entrenamientos con el centro hacia el mismo lado que la media (0 a 1)
  texto: string | null; // «abajo a la izquierda»; null si no hay un desvío claro
  mm: { x: number; y: number; distancia: number; sesiones: number } | null; // centro medio en mm a la distancia más usada
}

const MIN_SESIONES_DESVIO = 3;
const UMBRAL_DESVIO = 0.12; // 12 % del radio del negro

/**
 * Hacia dónde tienden a ir tus grupos. Cada entrenamiento se pasa a la escala de su diana (radio del
 * negro = 1) para poder juntar dianas distintas.
 */
export function desvio(sesiones: Sesion[]): Desvio | null {
  const centros: { x: number; y: number; n: number; mmx: number; mmy: number; distancia: number }[] = [];
  for (const s of terminadas(sesiones)) {
    const d = conPosicion(todosLosDisparos(s));
    if (d.length < 5) continue;
    const g = agrupacion(d);
    const r = geometria(s).diana.negro / 2;
    centros.push({ x: g.cx / r, y: g.cy / r, n: d.length, mmx: g.cx, mmy: g.cy, distancia: s.distancia });
  }
  if (centros.length < MIN_SESIONES_DESVIO) return null;
  const total = centros.reduce((t, c) => t + c.n, 0);
  const x = centros.reduce((t, c) => t + c.x * c.n, 0) / total;
  const y = centros.reduce((t, c) => t + c.y * c.n, 0) / total;
  const largo = Math.hypot(x, y);
  // Mismo lado: el centro de la sesión apunta en la dirección del desvío medio.
  const constante = largo ? centros.filter((c) => c.x * x + c.y * y > 0).length / centros.length : 0;
  const claro = largo >= UMBRAL_DESVIO && constante >= 0.6;
  // Para corregir miras hace falta la misma distancia: se usa la más repetida (con 3 entrenamientos o más).
  const veces = new Map<number, number>();
  for (const c of centros) veces.set(c.distancia, (veces.get(c.distancia) ?? 0) + 1);
  const [distancia, cuantas] = [...veces].sort((a, b) => b[1] - a[1])[0];
  const misma = centros.filter((c) => c.distancia === distancia);
  const nm = misma.reduce((t, c) => t + c.n, 0);
  return {
    sesiones: centros.length, disparos: total, x, y,
    centros: centros.map(({ x, y }) => ({ x, y })),
    constante,
    texto: claro ? direccion(x, y) : null,
    mm: claro && cuantas >= MIN_SESIONES_DESVIO
      ? { x: misma.reduce((t, c) => t + c.mmx * c.n, 0) / nm, y: misma.reduce((t, c) => t + c.mmy * c.n, 0) / nm, distancia, sesiones: cuantas }
      : null,
  };
}

/** «arriba», «abajo a la izquierda»… (solo los ejes que pesan). */
export function direccion(x: number, y: number): string {
  const a = Math.abs(x), b = Math.abs(y);
  const v = y > 0 ? 'abajo' : 'arriba';
  const h = x > 0 ? 'a la derecha' : 'a la izquierda';
  if (a < b * 0.4) return v;
  if (b < a * 0.4) return h;
  return `${v} ${h}`;
}

export interface Fatiga {
  sesiones: number; // entrenamientos con 4 series o más
  primeras: number; // media por disparo en la primera mitad de las series
  ultimas: number; // media por disparo en la segunda mitad
  bajan: number; // entrenamientos en los que la segunda mitad es peor
  porDisparo: { n: number; media: number; disparos: number }[]; // media según el nº de disparo dentro de la serie
}

/** Cómo aguantas: primera mitad de las series frente a la segunda, y media según el disparo de la serie. */
export function fatiga(sesiones: Sesion[]): Fatiga | null {
  const largas = terminadas(sesiones).filter((s) => s.series.filter((x) => x.disparos.length).length >= 4);
  if (largas.length < 2) return null;
  let p = 0, np = 0, u = 0, nu = 0, bajan = 0;
  for (const s of largas) {
    const series = s.series.filter((x) => x.disparos.length);
    const mitad = Math.floor(series.length / 2);
    const a = series.slice(0, mitad), b = series.slice(series.length - mitad);
    const da = a.reduce((t, x) => t + x.disparos.length, 0), db = b.reduce((t, x) => t + x.disparos.length, 0);
    const sa = a.reduce((t, x) => t + sumaSerie(x), 0), sb = b.reduce((t, x) => t + sumaSerie(x), 0);
    p += sa; np += da; u += sb; nu += db;
    if (sb / db < sa / da) bajan++;
  }
  const porDisparo: Fatiga['porDisparo'] = [];
  for (const s of terminadas(sesiones)) {
    for (const serie of s.series) {
      serie.disparos.forEach((d, i) => {
        const fila = porDisparo[i] ?? (porDisparo[i] = { n: i + 1, media: 0, disparos: 0 });
        fila.media += d.valor;
        fila.disparos++;
      });
    }
  }
  return {
    sesiones: largas.length,
    primeras: p / np,
    ultimas: u / nu,
    bajan,
    porDisparo: porDisparo.filter(Boolean).map((f) => ({ ...f, media: f.media / f.disparos })),
  };
}

export interface FilaMunicion {
  arma: string;
  armaId: string;
  municion: string;
  distancia: number;
  sesiones: number;
  disparos: number;
  media: number;
  agrupacion: number | null; // radio medio en mm (solo con impactos marcados)
}

const MIN_SESIONES_MUNICION = 2;

/**
 * Media y agrupación con cada munición. Solo se comparan entrenamientos con la misma arma y a la
 * misma distancia; las municiones con menos de 2 entrenamientos no se muestran.
 */
export function porMunicion(sesiones: Sesion[], armas: Arma[]): FilaMunicion[] {
  const grupos = new Map<string, Sesion[]>();
  for (const s of terminadas(sesiones)) {
    const m = s.municion.trim();
    if (!m) continue;
    const k = `${s.armaId}|${s.distancia}|${m.toLowerCase()}`;
    grupos.set(k, [...(grupos.get(k) ?? []), s]);
  }
  const filas: FilaMunicion[] = [];
  for (const lista of grupos.values()) {
    if (lista.length < MIN_SESIONES_MUNICION) continue;
    const s0 = lista[0];
    const arma = armas.find((a) => a.id === s0.armaId);
    const disparos = lista.flatMap(todosLosDisparos);
    const conSitio = lista.filter((s) => conPosicion(todosLosDisparos(s)).length >= 5);
    filas.push({
      arma: arma ? `${arma.marca} ${arma.modelo}` : 'Arma',
      armaId: s0.armaId,
      municion: s0.municion.trim(),
      distancia: s0.distancia,
      sesiones: lista.length,
      disparos: disparos.length,
      media: media(disparos),
      agrupacion: conSitio.length ? conSitio.reduce((t, s) => t + agrupacion(todosLosDisparos(s)).radio, 0) / conSitio.length : null,
    });
  }
  return filas.sort((a, b) => a.arma.localeCompare(b.arma) || a.distancia - b.distancia || b.media - a.media);
}
