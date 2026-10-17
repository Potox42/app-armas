// Diana ISSF de pistola 25 m precisión / 50 m. Diámetros oficiales en mm:
// 10 = 50, 9 = 100 ... 1 = 500; zona negra (7 a 10) = 200; 10 interior = 25.
// Mismo cálculo que prototipos/deteccion-impactos/diana.py.

export const DIAMETRO_ANILLO_MM: Record<number, number> = {
  10: 50, 9: 100, 8: 150, 7: 200, 6: 250, 5: 300, 4: 350, 3: 400, 2: 450, 1: 500,
};
export const DIAMETRO_NEGRO_MM = 200;
export const DIAMETRO_DIEZ_INTERIOR_MM = 25;
export const CALIBRE_22_MM = 5.6;

/** Puntuación ISSF: si el impacto toca la línea, cuenta el valor superior. */
export function puntuar(x: number, y: number, calibre = CALIBRE_22_MM): number {
  const d = Math.hypot(x, y) - calibre / 2;
  for (let valor = 10; valor >= 1; valor--) {
    if (d <= DIAMETRO_ANILLO_MM[valor] / 2) return valor;
  }
  return 0;
}
