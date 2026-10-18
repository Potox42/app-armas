import type { Arma, TipoArma } from '@/data/types';
import { hoyISO } from './fechas';

export type ClaseMunicion = 'corta' | 'larga' | 'caza';

/**
 * Límites para particulares según el Reglamento de artículos pirotécnicos y cartuchería
 * (RD 989/2015), tal como los recogen licenciaf.com y tirofato.com: arma corta 100 cartuchos al
 * año y 150 guardados; arma larga rayada 1.000 al año y 200 guardados; cartuchos de caza no
 * metálicos sin límite de compra y 5.000 guardados. Lo que se compra y se gasta dentro de las
 * instalaciones de la federación o del club no cuenta. Con autorización de la Guardia Civil el
 * cupo puede ser mayor: se cambia en cada arma.
 */
export const LIMITES: Record<ClaseMunicion, { anual: number | null; deposito: number; nombre: string }> = {
  corta: { anual: 100, deposito: 150, nombre: 'arma corta' },
  larga: { anual: 1000, deposito: 200, nombre: 'arma larga rayada' },
  caza: { anual: null, deposito: 5000, nombre: 'cartuchos de caza' },
};

export function claseDe(tipo: TipoArma): ClaseMunicion {
  if (tipo === 'Pistola' || tipo === 'Revólver') return 'corta';
  if (tipo === 'Escopeta') return 'caza';
  return 'larga';
}

export interface EstadoMunicion {
  clase: ClaseMunicion;
  cupo: number | null; // cartuchos al año (null: sin límite)
  comprados: number; // este año, sin contar los del club
  quedan: number | null;
  enCasa: number;
  maxDeposito: number;
}

/** Cupo del año natural (del 1 de enero al 31 de diciembre) y cartuchos guardados en casa. */
export function estadoMunicion(arma: Arma, hoy = hoyISO()): EstadoMunicion {
  const clase = claseDe(arma.tipo);
  const limite = LIMITES[clase];
  const cupo = arma.cupoAnual ?? limite.anual;
  const anio = hoy.slice(0, 4);
  const movs = arma.municion ?? [];
  const comprados = movs
    .filter((m) => m.tipo === 'compra' && !m.enRecinto && m.fecha.startsWith(anio))
    .reduce((t, m) => t + m.cartuchos, 0);
  const entradas = movs.filter((m) => m.tipo === 'compra' && !m.enRecinto).reduce((t, m) => t + m.cartuchos, 0);
  const gastos = movs.filter((m) => m.tipo === 'gasto').reduce((t, m) => t + m.cartuchos, 0);
  return {
    clase,
    cupo,
    comprados,
    quedan: cupo === null ? null : Math.max(0, cupo - comprados),
    enCasa: Math.max(0, entradas - gastos),
    maxDeposito: arma.maxDeposito ?? limite.deposito,
  };
}
