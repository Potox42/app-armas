import type { Datos, Licencia } from '@/data/types';

/**
 * Armas de concurso que autoriza la licencia F según su clase (art. 132 del Reglamento de Armas,
 * RD 137/1993): 3ª clase, un arma corta o una larga de concurso; 2ª, hasta seis; 1ª, hasta diez.
 * Cada arma más allá de la primera necesita autorización especial previa.
 */
export const ARMAS_POR_CLASE: Record<string, number> = { '1': 10, '2': 6, '3': 1 };

export interface CupoArmasF {
  licencia: Licencia;
  armas: number;
  maximo: number | null; // null: falta la clase
}

/** Cuántas armas tienes con la licencia F frente a las que permite su clase. */
export function cupoArmasF(datos: Datos): CupoArmasF | null {
  const licencia = datos.permiso.licencias.find((l) => l.tipo === 'F');
  if (!licencia) return null;
  return {
    licencia,
    armas: datos.armas.filter((a) => a.licenciaId === licencia.id).length,
    maximo: licencia.categoria ? ARMAS_POR_CLASE[licencia.categoria] ?? null : null,
  };
}

/**
 * Licencia E (art. 101 del Reglamento de Armas; Ministerio del Interior, «Licencias y pruebas de
 * capacitación»): hasta seis escopetas y hasta seis armas largas rayadas para tiro deportivo, y
 * nunca más de doce armas en total.
 */
export const LIMITES_E = { escopetas: 6, rayadas: 6, total: 12 };

export interface CupoArmasE {
  licencia: Licencia;
  escopetas: number;
  rayadas: number; // el resto de armas con la E (carabinas, rifles…)
  total: number;
}

/** Cuántas armas tienes con la licencia E, separando escopetas y armas largas rayadas. */
export function cupoArmasE(datos: Datos): CupoArmasE | null {
  const licencia = datos.permiso.licencias.find((l) => l.tipo === 'E');
  if (!licencia) return null;
  const armas = datos.armas.filter((a) => a.licenciaId === licencia.id);
  const escopetas = armas.filter((a) => a.tipo === 'Escopeta').length;
  return { licencia, escopetas, rayadas: armas.length - escopetas, total: armas.length };
}

/** Licencia D: hasta cinco armas largas rayadas para caza mayor (categoría 2.ª, 2). */
export const MAXIMO_D = 5;

/** Cuántas armas tienes con la licencia D. */
export function cupoArmasD(datos: Datos): { licencia: Licencia; armas: number } | null {
  const licencia = datos.permiso.licencias.find((l) => l.tipo === 'D');
  if (!licencia) return null;
  return { licencia, armas: datos.armas.filter((a) => a.licenciaId === licencia.id).length };
}
