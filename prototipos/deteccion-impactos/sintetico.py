"""Genera fotos de prueba simuladas: diana vista a través de un catalejo con el móvil.

Simula perspectiva (soporte algo inclinado), viñeteado circular del ocular, desenfoque,
ruido de sensor, cambios de luz y pequeños movimientos de la cámara entre disparo y disparo.
"""
import cv2
import numpy as np
from diana import DIAMETRO_ANILLO_MM, DIAMETRO_NEGRO_MM, DIAMETRO_DIEZ_INTERIOR_MM, CALIBRE_22_MM

PX_MM = 4  # resolución del dibujo de la diana plana


def dibujar_diana(lado_mm=550):
    n = lado_mm * PX_MM
    img = np.full((n, n), 235, np.uint8)  # papel
    c = n // 2
    cv2.circle(img, (c, c), DIAMETRO_NEGRO_MM * PX_MM // 2, 25, -1, cv2.LINE_AA)
    for valor, d in DIAMETRO_ANILLO_MM.items():
        color = 235 if d <= DIAMETRO_NEGRO_MM else 25
        cv2.circle(img, (c, c), d * PX_MM // 2, color, max(1, int(0.4 * PX_MM)), cv2.LINE_AA)
    cv2.circle(img, (c, c), DIAMETRO_DIEZ_INTERIOR_MM * PX_MM // 2, 235, 1, cv2.LINE_AA)
    return img


def agujero(img, x_mm, y_mm):
    n = img.shape[0]
    c = n // 2
    p = (int(c + x_mm * PX_MM), int(c + y_mm * PX_MM))
    r = int(CALIBRE_22_MM * PX_MM / 2)
    # En negro el agujero se ve gris claro (luz del fondo); en blanco, gris oscuro con borde.
    dentro_negro = (x_mm**2 + y_mm**2) ** 0.5 < DIAMETRO_NEGRO_MM / 2
    cv2.circle(img, p, r, 150 if dentro_negro else 70, -1, cv2.LINE_AA)
    cv2.circle(img, p, r, 110 if dentro_negro else 40, 1, cv2.LINE_AA)


class Escena:
    """Cámara fija con ligeras vibraciones: devuelve la foto que vería el móvil."""

    def __init__(self, semilla=1, salida=900):
        self.rng = np.random.default_rng(semilla)
        self.salida = salida
        n = 550 * PX_MM
        # Un catalejo es un teleobjetivo: a 25 m la imagen es casi afín (giro, leve inclinación
        # y algo de perspectiva residual si el tubo no apunta perpendicular a la diana).
        src = np.float32([[0, 0], [n, 0], [n, n], [0, n]])
        k = self.rng.uniform(0.003, 0.012) * n
        dst = np.float32([[k, 0], [n - k * 0.3, k * 0.5], [n, n], [0, n - k * 0.4]])
        escala = salida * 1.35 / n
        S = np.diag([escala, escala, 1]).astype(np.float32)
        T = np.array([[1, 0, -salida * 0.18], [0, 1, -salida * 0.18], [0, 0, 1]], np.float32)
        self.H = T @ S @ cv2.getPerspectiveTransform(src, dst)

    def foto(self, plano):
        # vibración entre fotos: unos píxeles y una décima de grado
        ang = self.rng.normal(0, 0.15)
        dx, dy = self.rng.normal(0, 2.0, 2)
        R = cv2.getRotationMatrix2D((self.salida / 2, self.salida / 2), ang, 1.0)
        J = np.vstack([R, [0, 0, 1]]).astype(np.float32)
        J[0, 2] += dx
        J[1, 2] += dy
        img = cv2.warpPerspective(plano, J @ self.H, (self.salida, self.salida), borderValue=235)
        img = cv2.GaussianBlur(img, (0, 0), 1.2)
        # luz desigual + viñeteado circular del ocular
        yy, xx = np.mgrid[0:self.salida, 0:self.salida].astype(np.float32)
        c = self.salida / 2
        r = np.hypot(xx - c, yy - c) / c
        luz = self.rng.uniform(0.85, 1.05) * (1 - 0.15 * (xx / self.salida))
        vin = np.clip(1.25 - 0.9 * r**2, 0, 1)
        img = img.astype(np.float32) * luz * vin
        img += self.rng.normal(0, 4, img.shape)
        return np.clip(img, 0, 255).astype(np.uint8)
