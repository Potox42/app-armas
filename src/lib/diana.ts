import type { Modalidad, TipoArma } from '@/data/types';

// Dianas ISSF a escala real (diámetros en mm). Fuentes:
// - Pistola 25 m precisión / 50 m: hoja de dianas ISSF de zielsport.at (Scheiben-FP.pdf).
// - Pistola tiro rápido 25 m: regla ISSF 6.3.4.4 citada en targettalk.org (10 = 100 mm, +80 mm por anillo,
//   negro del 5 al 10 = 500 mm, 10 interior = 50 mm).
// - Pistola aire 10 m: 10 = 11,5 mm y 9 = 27,5 mm (all4shooters.com), negro 59,5 mm (Krüger, frankonia-b2b.com);
//   el resto de anillos sigue el mismo paso de 16 mm.
// - Carabina aire 10 m: zielsport.at (Scheiben-LG.pdf): 10 = punto de 0,5 mm, +5 mm por anillo, negro 30,5 mm.
// Mismo cálculo que prototipos/deteccion-impactos/diana.py (que solo tiene la de precisión).

export type IdDiana = 'precision' | 'rapido' | 'airePistola' | 'aireCarabina';

export interface ModeloDiana {
  id: IdDiana;
  nombre: string;
  anillos: Record<number, number>; // valor → diámetro
  negro: number; // diámetro de la zona negra
  diezInterior: number; // 0 si no tiene
  visible: number; // diámetro que se dibuja en pantalla
  calibre: number; // calibre por defecto de la modalidad
}

const anillos = (diez: number, paso: number, hasta = 1) => {
  const r: Record<number, number> = {};
  for (let v = 10; v >= hasta; v--) r[v] = Math.round((diez + (10 - v) * paso) * 10) / 10;
  return r;
};

export const CALIBRE_22_MM = 5.6;
export const CALIBRE_AIRE_MM = 4.5;

export const DIANAS: Record<IdDiana, ModeloDiana> = {
  precision: {
    id: 'precision', nombre: 'Pistola precisión 25 m / 50 m', anillos: anillos(50, 50), negro: 200, diezInterior: 25,
    visible: 360, calibre: CALIBRE_22_MM,
  },
  rapido: {
    id: 'rapido', nombre: 'Pistola tiro rápido 25 m', anillos: anillos(100, 80, 5), negro: 500, diezInterior: 50,
    visible: 540, calibre: CALIBRE_22_MM,
  },
  airePistola: {
    id: 'airePistola', nombre: 'Pistola aire 10 m', anillos: anillos(11.5, 16), negro: 59.5, diezInterior: 5,
    visible: 110, calibre: CALIBRE_AIRE_MM,
  },
  aireCarabina: {
    id: 'aireCarabina', nombre: 'Carabina aire 10 m', anillos: anillos(0.5, 5), negro: 30.5, diezInterior: 0,
    visible: 40, calibre: CALIBRE_AIRE_MM,
  },
};

// Compatibilidad: la diana de siempre (pistola 25 m precisión).
export const DIAMETRO_ANILLO_MM = DIANAS.precision.anillos;
export const DIAMETRO_NEGRO_MM = DIANAS.precision.negro;
export const DIAMETRO_DIEZ_INTERIOR_MM = DIANAS.precision.diezInterior;

/** La diana que corresponde a una sesión según modalidad, distancia y arma. */
export function dianaPara(modalidad: Modalidad, distancia: number, tipoArma?: TipoArma): IdDiana {
  if (distancia === 10) return tipoArma === 'Carabina' || tipoArma === 'Rifle' ? 'aireCarabina' : 'airePistola';
  if (modalidad === 'Tiro rápido') return 'rapido';
  return 'precision';
}

/**
 * Diámetro de la bala a partir del calibre escrito en el arma: «9 mm», «.22 LR», «.32 S&W»…
 * Las pulgadas se pasan a mm (× 25,4). Si no se entiende, el de la modalidad.
 */
export function calibreEnMm(texto: string | undefined, porDefecto: number): number {
  const t = (texto ?? '').toLowerCase().replace(',', '.');
  const mm = t.match(/(\d+(?:\.\d+)?)\s*(?:mm|x)/);
  if (mm) {
    const v = Number(mm[1]);
    if (v >= 4 && v <= 13) return v;
  }
  const pulgadas = t.match(/(?:^|[^\d])\.(\d{2,3})/);
  if (pulgadas) {
    const v = Number(`0.${pulgadas[1]}`) * 25.4;
    if (v >= 4 && v <= 13) return Math.round(v * 10) / 10;
  }
  return porDefecto;
}

/** Puntuación ISSF: si el impacto toca la línea, cuenta el valor superior. */
export function puntuar(x: number, y: number, calibre = CALIBRE_22_MM, diana: ModeloDiana = DIANAS.precision): number {
  const d = Math.hypot(x, y) - calibre / 2;
  for (let valor = 10; valor >= 1; valor--) {
    const diametro = diana.anillos[valor];
    if (diametro !== undefined && d <= diametro / 2) return valor;
  }
  return 0;
}

/** Diana y calibre con los que se puntúa una sesión (las antiguas no lo guardaban: precisión y .22). */
export function geometria(s: { diana?: IdDiana; calibreMm?: number }): { diana: ModeloDiana; calibre: number } {
  const diana = DIANAS[s.diana ?? 'precision'];
  return { diana, calibre: s.calibreMm ?? diana.calibre };
}
