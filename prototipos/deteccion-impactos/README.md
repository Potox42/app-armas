# Prototipo: detección de impactos con el móvil en el catalejo

Prueba de concepto en Python + OpenCV, antes de llevarlo a la app.

## Cómo funciona

1. **Calibrar:** con la diana limpia, localiza el círculo negro (anillos 7-10, 200 mm) y le ajusta una elipse. Así sabe dónde está el centro y cuántos píxeles mide un milímetro.
2. **Alinear:** cada foto nueva se alinea con la anterior para corregir pequeños movimientos del soporte.
3. **Comparar:** resta la foto anterior a la nueva tras un filtro paso alto que elimina cambios de luz y viñeteado. Lo único que cambia es el agujero nuevo.
4. **Puntuar:** convierte la posición a milímetros y aplica la regla ISSF (si el impacto toca la línea, vale el valor superior) con la geometría oficial de la diana de pistola 25 m precisión / 50 m.

## Probarlo

```bash
python3 -m pip install opencv-python-headless numpy
python3 probar.py /ruta/de/salida
```

Genera 6 series de 10 disparos simulados (perspectiva leve, viñeteado del ocular, ruido, cambios de luz y vibración) y compara con la posición real.

Resultado con fotos simuladas: 60 de 60 impactos detectados, 58 de 60 puntuaciones correctas, error medio de 0,4 mm en la distancia al centro. Los dos fallos son disparos a menos de 1 mm de la línea.

## Lo que falta comprobar con fotos reales

- Imagen real del catalejo: enfoque, aumento, temblor del aire, luz del campo.
- Impactos que caen encima de otro agujero.
- Que se mueva la diana (viento) o se cambie de diana.
