"""Geometría y puntuación de la diana ISSF de pistola a 25 m precisión / 50 m.

Medidas oficiales (diámetro en mm): 10 = 50, 9 = 100 ... 1 = 500; negro (7-10) = 200;
10 interior = 25. Fuente: hoja de dianas ISSF publicada por zielsport.at (Scheiben-FP.pdf).
"""
import math

DIAMETRO_ANILLO_MM = {10: 50, 9: 100, 8: 150, 7: 200, 6: 250, 5: 300, 4: 350, 3: 400, 2: 450, 1: 500}
DIAMETRO_NEGRO_MM = 200
DIAMETRO_DIEZ_INTERIOR_MM = 25
CALIBRE_22_MM = 5.6


def puntuar(x_mm: float, y_mm: float, calibre_mm: float = CALIBRE_22_MM) -> int:
    """Puntuación entera ISSF: un impacto que toca la línea cuenta el valor superior."""
    d = math.hypot(x_mm, y_mm) - calibre_mm / 2  # borde del impacto más cercano al centro
    for valor in range(10, 0, -1):
        if d <= DIAMETRO_ANILLO_MM[valor] / 2:
            return valor
    return 0

