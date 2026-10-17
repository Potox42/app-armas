// Detección de impactos con la cámara en el catalejo (versión de la app del prototipo en
// prototipos/deteccion-impactos). Trabaja con imágenes en gris pequeñas (unos 480 px de ancho):
// 1. Calibrar: localiza el círculo negro de la diana (anillos 7 a 10, 200 mm) → centro y escala.
// 2. Alinear: cada imagen se desplaza para que el negro quede donde estaba (vibración del soporte).
// 3. Comparar: resta la imagen de referencia tras un filtro paso alto (quita cambios de luz).
//    Una mancha nueva del tamaño de un calibre es el impacto.
// 4. Puntuar con la geometría oficial de la diana (lib/diana.ts).
import { CALIBRE_22_MM, DIAMETRO_NEGRO_MM, puntuar } from './diana';

export interface Gris {
  w: number;
  h: number;
  d: Float32Array; // 0 (negro) a 255 (blanco), fila a fila
}

/** Dónde está la diana en la imagen: el negro es una elipse de semiejes rx, ry. */
export interface Calibracion {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface Impacto {
  xPx: number;
  yPx: number;
  x: number; // mm desde el centro, a la derecha
  y: number; // mm desde el centro, hacia abajo
  valor: number;
}

/** Media de cada punto en un cuadrado de lado 2r+1 (con imagen integral: rápido para cualquier r). */
export function desenfocar(g: Gris, r: number): Gris {
  const { w, h, d } = g;
  const I = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let fila = 0;
    for (let x = 0; x < w; x++) {
      fila += d[y * w + x];
      I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + fila;
    }
  }
  const o = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const s = I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0];
      o[y * w + x] = s / ((x1 - x0) * (y1 - y0));
    }
  }
  return { w, h, d: o };
}

function otsu(valores: number[]): number {
  const hist = new Array<number>(256).fill(0);
  for (const v of valores) hist[Math.max(0, Math.min(255, Math.round(v)))]++;
  const total = valores.length;
  let suma = 0;
  for (let i = 0; i < 256; i++) suma += i * hist[i];
  let sumaB = 0, pesoB = 0, mejor = 0, umbral = 128;
  for (let i = 0; i < 256; i++) {
    pesoB += hist[i];
    if (!pesoB) continue;
    const pesoF = total - pesoB;
    if (!pesoF) break;
    sumaB += i * hist[i];
    const v = pesoB * pesoF * (sumaB / pesoB - (suma - sumaB) / pesoF) ** 2;
    if (v > mejor) { mejor = v; umbral = i; }
  }
  return umbral;
}

interface Mancha { area: number; x0: number; y0: number; x1: number; y1: number; sx: number; sy: number }

/** Manchas (componentes conexas, vecindad 4) de una máscara. */
function manchas(m: Uint8Array, w: number, h: number): Mancha[] {
  const visto = new Uint8Array(w * h);
  const pila = new Int32Array(w * h);
  const res: Mancha[] = [];
  for (let i = 0; i < w * h; i++) {
    if (!m[i] || visto[i]) continue;
    let n = 0, top = 0;
    const k: Mancha = { area: 0, x0: w, y0: h, x1: 0, y1: 0, sx: 0, sy: 0 };
    pila[top++] = i;
    visto[i] = 1;
    while (top) {
      const p = pila[--top];
      const x = p % w, y = (p - x) / w;
      n++;
      k.sx += x; k.sy += y;
      if (x < k.x0) k.x0 = x;
      if (x > k.x1) k.x1 = x;
      if (y < k.y0) k.y0 = y;
      if (y > k.y1) k.y1 = y;
      const vecinos = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of vecinos) if (q >= 0 && m[q] && !visto[q]) { visto[q] = 1; pila[top++] = q; }
    }
    k.area = n;
    res.push(k);
  }
  return res;
}

/**
 * Localiza el círculo negro. Solo mira el centro de la imagen (el borde del ocular sale oscuro)
 * y suaviza antes para que las rayas blancas de los anillos no lo partan en trozos.
 */
export function calibrar(g: Gris): Calibracion | null {
  const { w, h } = g;
  const lado = Math.min(w, h);
  const r = Math.max(1, Math.round(lado / 160));
  const s = desenfocar(g, r);
  const cx0 = w / 2, cy0 = h / 2, rMax = 0.48 * lado;
  const dentro = (x: number, y: number) => (x - cx0) ** 2 + (y - cy0) ** 2 < rMax * rMax;
  const valores: number[] = [];
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (dentro(x, y)) valores.push(s.d[y * w + x]);
  const t = otsu(valores);
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (dentro(x, y) && s.d[y * w + x] < t) m[y * w + x] = 1;
  let mejor: Mancha | null = null;
  for (const k of manchas(m, w, h)) {
    const bw = k.x1 - k.x0 + 1, bh = k.y1 - k.y0 + 1;
    if (Math.min(bw, bh) < 0.12 * lado || bw / bh > 1.45 || bh / bw > 1.45) continue;
    // Un disco llena π/4 de su recuadro; con agujeros y rayas, algo menos.
    if (k.area / (bw * bh) < 0.6) continue;
    if (!mejor || k.area > mejor.area) mejor = k;
  }
  if (!mejor) return null;
  return {
    cx: (mejor.x0 + mejor.x1) / 2,
    cy: (mejor.y0 + mejor.y1) / 2,
    rx: (mejor.x1 - mejor.x0 + 1) / 2,
    ry: (mejor.y1 - mejor.y0 + 1) / 2,
  };
}

/** Paso alto: los detalles pequeños (agujeros, rayas) sin la luz general ni el viñeteado. */
export function detalle(g: Gris, cal: Calibracion): Gris {
  const pxMm = (cal.rx + cal.ry) / DIAMETRO_NEGRO_MM;
  const fino = desenfocar(g, Math.max(1, Math.round(pxMm * 0.8)));
  const grueso = desenfocar(g, Math.max(4, Math.round(pxMm * 10)));
  const o = new Float32Array(g.w * g.h);
  for (let i = 0; i < o.length; i++) o[i] = fino.d[i] - grueso.d[i];
  return { w: g.w, h: g.h, d: o };
}

/** Desplaza la imagen (dx, dy) píxeles, con interpolación; lo que queda fuera vale 0. */
export function desplazar(g: Gris, dx: number, dy: number): Gris {
  const { w, h, d } = g;
  const o = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const sy = y - dy, y0 = Math.floor(sy), fy = sy - y0;
    if (y0 < 0 || y0 + 1 >= h) continue;
    for (let x = 0; x < w; x++) {
      const sx = x - dx, x0 = Math.floor(sx), fx = sx - x0;
      if (x0 < 0 || x0 + 1 >= w) continue;
      const i = y0 * w + x0;
      o[y * w + x] = (d[i] * (1 - fx) + d[i + 1] * fx) * (1 - fy) + (d[i + w] * (1 - fx) + d[i + w + 1] * fx) * fy;
    }
  }
  return { w, h, d: o };
}

/** Valor de la imagen en un punto no entero (interpolación bilineal); 0 fuera. */
function muestra(g: Gris, x: number, y: number): number {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  if (x0 < 0 || y0 < 0 || x0 + 1 >= g.w || y0 + 1 >= g.h) return 0;
  const fx = x - x0, fy = y - y0, i = y0 * g.w + x0, d = g.d;
  return (d[i] * (1 - fx) + d[i + 1] * fx) * (1 - fy) + (d[i + g.w] * (1 - fx) + d[i + g.w + 1] * fx) * fy;
}

/**
 * Afina el desplazamiento (dx, dy) que lleva `actual` sobre `ref`: prueba alrededor, en pasos de
 * medio píxel, y se queda con el que menos diferencia deja. El centro del negro da una primera
 * estimación, pero con un error de uno o dos píxeles que haría ver «agujeros» en los bordes.
 */
export function afinar(ref: Gris, actual: Gris, dx: number, dy: number, cal: Calibracion): { dx: number; dy: number } {
  const puntos: number[] = [];
  const r = 1.6 * Math.max(cal.rx, cal.ry);
  for (let y = 6; y < ref.h - 6; y += 3) {
    for (let x = 6; x < ref.w - 6; x += 3) {
      if ((x - cal.cx) ** 2 + (y - cal.cy) ** 2 < r * r) puntos.push(x, y);
    }
  }
  let mejor = { dx, dy }, menor = Infinity;
  for (let oy = -2; oy <= 2; oy += 0.5) {
    for (let ox = -2; ox <= 2; ox += 0.5) {
      let suma = 0;
      for (let k = 0; k < puntos.length; k += 2) {
        const x = puntos[k], y = puntos[k + 1];
        suma += Math.abs(ref.d[y * ref.w + x] - muestra(actual, x - dx - ox, y - dy - oy));
      }
      if (suma < menor) { menor = suma; mejor = { dx: dx + ox, dy: dy + oy }; }
    }
  }
  return mejor;
}

/** Píxeles → mm sobre la diana, con la escala del círculo negro (100 mm de radio). */
export function aMm(cal: Calibracion, x: number, y: number): { x: number; y: number } {
  const radio = DIAMETRO_NEGRO_MM / 2;
  return { x: ((x - cal.cx) / cal.rx) * radio, y: ((y - cal.cy) / cal.ry) * radio };
}

export interface Comparacion {
  impacto: Impacto | null;
  cambio: number; // fracción de la zona vigilada que ha cambiado (mucho = movimiento o luz)
}

/**
 * Compara la imagen actual (ya en paso alto y alineada) con la de referencia y busca
 * una mancha nueva del tamaño de un agujero dentro de la zona de la diana que se ve.
 */
export function comparar(ref: Gris, actual: Gris, cal: Calibracion, calibreMm = CALIBRE_22_MM): Comparacion {
  const { w, h } = ref;
  const pxMm = (cal.rx + cal.ry) / DIAMETRO_NEGRO_MM;
  const rZona = 2.4 * Math.max(cal.rx, cal.ry); // hasta el anillo 1 (500 mm), si se ve
  const borde = 4;
  const m = new Uint8Array(w * h);
  let zona = 0, cambiados = 0;
  for (let y = borde; y < h - borde; y++) {
    for (let x = borde; x < w - borde; x++) {
      if ((x - cal.cx) ** 2 + (y - cal.cy) ** 2 > rZona * rZona) continue;
      const i = y * w + x;
      if (actual.d[i] === 0 && ref.d[i] === 0) continue;
      zona++;
      const dif = actual.d[i] - ref.d[i];
      if (Math.abs(dif) <= 28) continue;
      cambiados++;
      // Un agujero nuevo se ve más claro en el negro (pasa la luz) y más oscuro en el blanco.
      // El cambio contrario (un agujero que desaparece: un parche) no cuenta como impacto.
      const enNegro = ((x - cal.cx) / cal.rx) ** 2 + ((y - cal.cy) / cal.ry) ** 2 < 1;
      if (enNegro ? dif > 0 : dif < 0) m[i] = 1;
    }
  }
  const cambio = zona ? cambiados / zona : 0;
  const rAgujero = (calibreMm / 2) * pxMm;
  const esperada = Math.PI * rAgujero * rAgujero;
  const candidatas = manchas(m, w, h).filter((k) => {
    const bw = k.x1 - k.x0 + 1, bh = k.y1 - k.y0 + 1;
    return k.area > 0.3 * esperada && k.area < 3 * esperada && bw < 4 * rAgujero + 3 && bh < 4 * rAgujero + 3;
  });
  if (!candidatas.length) return { impacto: null, cambio };
  const k = candidatas.reduce((a, b) => (b.area > a.area ? b : a));
  const xPx = k.sx / k.area, yPx = k.sy / k.area;
  const mm = aMm(cal, xPx, yPx);
  return { impacto: { xPx, yPx, x: mm.x, y: mm.y, valor: puntuar(mm.x, mm.y, calibreMm) }, cambio };
}

/**
 * Vigila una secuencia de imágenes de la diana y avisa de cada impacto nuevo.
 * Un impacto se da por bueno cuando aparece en dos imágenes seguidas en el mismo sitio
 * (así no cuenta un insecto, un reflejo o un temblor). Tras cada impacto, la imagen actual
 * pasa a ser la referencia.
 */
export class Vigia {
  cal: Calibracion | null = null;
  private ref: Gris | null = null;
  private pendiente: Impacto | null = null;
  private estables = 0;

  /** Procesa una imagen. Devuelve el impacto confirmado, si lo hay. */
  procesar(g: Gris): { estado: 'buscando' | 'calibrando' | 'vigilando'; impacto?: Impacto; cal?: Calibracion } {
    const cal = calibrar(g);
    if (!cal) {
      this.estables = 0;
      return { estado: this.cal ? 'vigilando' : 'buscando' };
    }
    if (!this.cal) {
      // Se espera a que la diana esté quieta tres imágenes seguidas antes de fijarla.
      const quieta = this.previa && Math.hypot(cal.cx - this.previa.cx, cal.cy - this.previa.cy) < 0.03 * cal.rx;
      this.previa = cal;
      this.estables = quieta ? this.estables + 1 : 0;
      if (this.estables < 2) return { estado: 'calibrando', cal };
      this.cal = cal;
      this.ref = detalle(g, cal);
      return { estado: 'vigilando', cal };
    }
    const det = detalle(g, this.cal);
    const { dx, dy } = afinar(this.ref!, det, this.cal.cx - cal.cx, this.cal.cy - cal.cy, this.cal);
    const alineada = desplazar(det, dx, dy);
    const { impacto, cambio } = comparar(this.ref!, alineada, this.cal);
    if (cambio > 0.05) {
      // Ha cambiado demasiado (se ha movido el móvil o la luz): nueva referencia sin contar nada.
      this.ref = alineada;
      this.pendiente = null;
      return { estado: 'vigilando', cal: this.cal };
    }
    if (!impacto) {
      this.pendiente = null;
      return { estado: 'vigilando', cal: this.cal };
    }
    const r = 2 * (CALIBRE_22_MM / 2) * ((this.cal.rx + this.cal.ry) / DIAMETRO_NEGRO_MM) + 2;
    if (this.pendiente && Math.hypot(impacto.xPx - this.pendiente.xPx, impacto.yPx - this.pendiente.yPx) < r) {
      this.pendiente = null;
      this.ref = alineada;
      return { estado: 'vigilando', cal: this.cal, impacto };
    }
    this.pendiente = impacto;
    return { estado: 'vigilando', cal: this.cal };
  }

  private previa: Calibracion | null = null;

  /** Vuelve a empezar (otra diana o se ha movido el soporte). */
  reiniciar() {
    this.cal = null;
    this.ref = null;
    this.pendiente = null;
    this.previa = null;
    this.estables = 0;
  }
}
