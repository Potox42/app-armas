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
