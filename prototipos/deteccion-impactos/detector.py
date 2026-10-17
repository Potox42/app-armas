"""Detección de impactos por diferencia de imágenes.

Idea: el móvil está fijo en el catalejo. Antes de cada disparo guardamos una foto de
referencia; tras el disparo, la nueva foto solo se diferencia en el agujero nuevo.
1. Calibrar: localizar el círculo negro (7-10) y ajustarle una elipse -> escala en mm.
2. Alinear: corregir la vibración entre fotos (ECC, transformación euclídea).
3. Diferencia: la mancha nueva del tamaño de un calibre es el impacto.
4. Puntuar con la geometría oficial de la diana.
"""
from dataclasses import dataclass
import cv2
import numpy as np
from diana import DIAMETRO_NEGRO_MM, CALIBRE_22_MM, puntuar


@dataclass
class Calibracion:
    centro: tuple  # píxeles
    ejes: tuple    # semiejes de la elipse del negro, píxeles
    angulo: float  # grados

    def a_mm(self, x, y):
        """Píxel -> mm sobre la diana (aproximación afín a partir de la elipse del negro)."""
        cx, cy = self.centro
        a = np.deg2rad(self.angulo)
        dx, dy = x - cx, y - cy
        u = dx * np.cos(a) + dy * np.sin(a)
        v = -dx * np.sin(a) + dy * np.cos(a)
        radio = DIAMETRO_NEGRO_MM / 2
        u_mm, v_mm = u / self.ejes[0] * radio, v / self.ejes[1] * radio
        # deshacer la rotación para que "arriba" siga siendo arriba
        return (u_mm * np.cos(a) - v_mm * np.sin(a), u_mm * np.sin(a) + v_mm * np.cos(a))

    def px_por_mm(self):
        return (self.ejes[0] + self.ejes[1]) / DIAMETRO_NEGRO_MM


def calibrar(img):
    g = cv2.GaussianBlur(img, (0, 0), 3)
    # umbral local: el viñeteado del ocular hace inútil un umbral global
    bin_ = cv2.adaptiveThreshold(g, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 151, 25)
    bin_ = cv2.morphologyEx(bin_, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    contornos, _ = cv2.findContours(bin_, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    mejor, mejor_puntos = None, 0
    for c in contornos:
        if len(c) < 50:
            continue
        area = cv2.contourArea(c)
        per = cv2.arcLength(c, True)
        circularidad = 4 * np.pi * area / (per * per)
        if circularidad > 0.75 and area > mejor_puntos:
            mejor, mejor_puntos = c, area
    if mejor is None:
        raise ValueError('No encuentro el círculo negro de la diana')
    (cx, cy), (ma, mb), ang = cv2.fitEllipse(mejor)
    return Calibracion((cx, cy), (ma / 2, mb / 2), ang)


def alinear(ref, img):
    """Devuelve img alineada sobre ref (corrige pequeños movimientos del soporte)."""
    escala = 0.5
    r = cv2.resize(ref, None, fx=escala, fy=escala).astype(np.float32)
    m = cv2.resize(img, None, fx=escala, fy=escala).astype(np.float32)
    W = np.eye(2, 3, dtype=np.float32)
    criterio = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 100, 1e-5)
    _, W = cv2.findTransformECC(r, m, W, cv2.MOTION_EUCLIDEAN, criterio, None, 5)
    W[:, 2] /= escala
    return cv2.warpAffine(img, W, (ref.shape[1], ref.shape[0]),
                          flags=cv2.INTER_LINEAR + cv2.WARP_INVERSE_MAP, borderValue=235)


@dataclass
class Impacto:
    x_px: float
    y_px: float
    x_mm: float
    y_mm: float
    valor: int


def detalle(img):
    f = cv2.GaussianBlur(img, (0, 0), 1.5).astype(np.float32)
    fondo = cv2.GaussianBlur(f, (0, 0), 12)
    return np.clip(np.abs(f - fondo) * 1.0, 0, 255).astype(np.uint8)


def detectar(ref, nueva, cal: Calibracion):
    alineada = alinear(ref, nueva)
    # Paso alto: quita la luz y el viñeteado (cambian entre fotos) y deja los detalles pequeños.
    dif = cv2.absdiff(detalle(ref), detalle(alineada))
    h, w = dif.shape
    yy, xx = np.mgrid[0:h, 0:w]
    mascara = np.hypot(xx - w / 2, yy - h / 2) < 0.45 * min(h, w)  # fuera del ocular no miramos
    dif[~mascara] = 0
    _, bin_ = cv2.threshold(dif, 28, 255, cv2.THRESH_BINARY)
    bin_ = cv2.morphologyEx(bin_, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    radio_px = CALIBRE_22_MM / 2 * cal.px_por_mm()
    area_esperada = np.pi * radio_px**2
    n, etiquetas, stats, centros = cv2.connectedComponentsWithStats(bin_)
    candidatos = [i for i in range(1, n) if 0.3 * area_esperada < stats[i, cv2.CC_STAT_AREA] < 3 * area_esperada]
    if not candidatos:
        return None, alineada
    i = max(candidatos, key=lambda k: stats[k, cv2.CC_STAT_AREA])
    x, y = centros[i]
    xm, ym = cal.a_mm(x, y)
    return Impacto(x, y, xm, ym, puntuar(xm, ym)), alineada
