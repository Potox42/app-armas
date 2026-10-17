"""Prueba con fotos simuladas: 6 series de 10 disparos con movimientos y luz distintos."""
import sys
import cv2
import numpy as np
from diana import puntuar
from sintetico import Escena, agujero, dibujar_diana
from detector import calibrar, detectar

salida = sys.argv[1] if len(sys.argv) > 1 else '.'
errores, aciertos, total, fallos = [], 0, 0, 0
for serie in range(6):
    rng = np.random.default_rng(100 + serie)
    escena = Escena(semilla=serie)
    plano = dibujar_diana()
    ref = escena.foto(plano)
    cal = calibrar(ref)
    marcados = []
    for disparo in range(10):
        x, y = rng.normal(0, 38, 2)  # agrupación de un tirador de nivel medio
        agujero(plano, x, y)
        nueva = escena.foto(plano)
        imp, alineada = detectar(ref, nueva, cal)
        total += 1
        real = puntuar(x, y)
        if imp is None:
            fallos += 1
        else:
            # la puntuación solo depende de la distancia al centro
            errores.append(abs(np.hypot(imp.x_mm, imp.y_mm) - np.hypot(x, y)))
            if imp.valor != real:
                print(f'serie {serie + 1} disparo {disparo + 1}: distancia real {np.hypot(x, y):.1f} mm ({real}), '
                      f'detectada {np.hypot(imp.x_mm, imp.y_mm):.1f} mm ({imp.valor})')
            aciertos += imp.valor == real
            marcados.append(imp)
        ref = alineada  # la foto tras el disparo, ya alineada, es la nueva referencia
    if serie == 0:
        vista = cv2.cvtColor(ref, cv2.COLOR_GRAY2BGR)
        for k, imp in enumerate(marcados, 1):
            p = (int(imp.x_px), int(imp.y_px))
            cv2.circle(vista, p, 9, (0, 200, 0), 2)
            cv2.putText(vista, f'{k}:{imp.valor}', (p[0] + 10, p[1] - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 220, 255), 2)
        cv2.ellipse(vista, ((cal.centro[0], cal.centro[1]), (2 * cal.ejes[0], 2 * cal.ejes[1]), cal.angulo), (255, 120, 0), 2)
        cv2.imwrite(f'{salida}/resultado_serie1.png', vista)

e = np.array(errores)
print(f'Disparos: {total}  detectados: {total - fallos}  puntuación correcta: {aciertos}/{total}')
print(f'Error en la distancia al centro: media {e.mean():.1f} mm, máximo {e.max():.1f} mm')
