// Detección de impactos con la cámara en el catalejo (versión de la app del prototipo en
// prototipos/deteccion-impactos). Trabaja con imágenes en gris pequeñas (unos 480 px de ancho):
// 1. Calibrar: localiza el círculo negro de la diana (anillos 7 a 10, 200 mm) → centro y escala.
// 2. Alinear: cada imagen se desplaza para que el negro quede donde estaba (vibración del soporte).
// 3. Comparar: resta la imagen de referencia tras un filtro paso alto (quita cambios de luz).
//    Una mancha nueva del tamaño de un calibre es el impacto.
// 4. Puntuar con la geometría oficial de la diana de la sesión (lib/diana.ts).
import { DIANAS, puntuar, type ModeloDiana } from './diana';

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

/** Diámetro del anillo más exterior de la diana (el 1, o el 5 en la de tiro rápido). */
export function diametroExterior(diana: ModeloDiana): number {
  return Math.max(...Object.values(diana.anillos));
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

/** Cierre morfológico de una máscara (dilatar y luego erosionar r píxeles): rellena lo que queda dentro de un contorno. */
function cerrar(m: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const f = new Float32Array(w * h);
  for (let i = 0; i < f.length; i++) f[i] = m[i];
  const dil = desenfocar({ w, h, d: f }, r);
  for (let i = 0; i < f.length; i++) f[i] = dil.d[i] > 1e-4 ? 1 : 0;
  const ero = desenfocar({ w, h, d: f }, r);
  const o = new Uint8Array(w * h);
  for (let i = 0; i < o.length; i++) o[i] = ero.d[i] > 1 - 1e-4 ? 1 : 0;
  return o;
}

/**
 * Localiza el círculo negro. Solo mira el centro de la imagen (el borde del ocular sale oscuro)
 * y suaviza antes para que las rayas blancas de los anillos no lo partan en trozos.
 */
export function calibrar(g: Gris, alcance = 0.48): Calibracion | null {
  const { w, h } = g;
  const lado = Math.min(w, h);
  const r = Math.max(1, Math.round(lado / 160));
  const s = desenfocar(g, r);
  const cx0 = w / 2, cy0 = h / 2, rMax = alcance * lado;
  const dentro = (x: number, y: number) => (x - cx0) ** 2 + (y - cy0) ** 2 < rMax * rMax;
  const valores: number[] = [];
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (dentro(x, y)) valores.push(s.d[y * w + x]);
  const t = otsu(valores);
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (dentro(x, y) && s.d[y * w + x] < t) m[y * w + x] = 1;
  const todas = manchas(m, w, h);
  let mejor: Mancha | null = null;
  for (const k of todas) {
    const bw = k.x1 - k.x0 + 1, bh = k.y1 - k.y0 + 1;
    if (Math.min(bw, bh) < 0.12 * lado || bw / bh > 1.45 || bh / bw > 1.45) continue;
    // Un disco llena π/4 de su recuadro; con agujeros y rayas, algo menos.
    if (k.area / (bw * bh) < 0.6) continue;
    if (!mejor || k.area > mejor.area) mejor = k;
  }
  if (!mejor) return null;
  // Una raya blanca de anillo algo gruesa (o la foto de lado) puede separar del disco trozos de la
  // corona exterior del negro. Se suman los trozos grandes que caen junto al disco; los números
  // impresos fuera del negro son pequeños y no cuentan.
  const bw = mejor.x1 - mejor.x0 + 1, bh = mejor.y1 - mejor.y0 + 1;
  const ex0 = mejor.x0 - 0.35 * bw, ex1 = mejor.x1 + 0.35 * bw, ey0 = mejor.y0 - 0.35 * bh, ey1 = mejor.y1 + 0.35 * bh;
  for (const k of todas) {
    if (k === mejor || k.area < 0.02 * mejor.area) continue;
    if (k.x0 < ex0 || k.x1 > ex1 || k.y0 < ey0 || k.y1 > ey1) continue;
    mejor = { ...mejor, x0: Math.min(mejor.x0, k.x0), x1: Math.max(mejor.x1, k.x1), y0: Math.min(mejor.y0, k.y0), y1: Math.max(mejor.y1, k.y1) };
  }
  return {
    cx: (mejor.x0 + mejor.x1) / 2,
    cy: (mejor.y0 + mejor.y1) / 2,
    rx: (mejor.x1 - mejor.x0 + 1) / 2,
    ry: (mejor.y1 - mejor.y0 + 1) / 2,
  };
}

/** Paso alto: los detalles pequeños (agujeros, rayas) sin la luz general ni el viñeteado. */
export function detalle(g: Gris, cal: Calibracion, diana: ModeloDiana = DIANAS.precision): Gris {
  const pxMm = (cal.rx + cal.ry) / diana.negro;
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

/** Píxeles → mm sobre la diana, con la escala del círculo negro (en la de precisión, 100 mm de radio). */
export function aMm(cal: Calibracion, x: number, y: number, diana: ModeloDiana = DIANAS.precision): { x: number; y: number } {
  const radio = diana.negro / 2;
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
export function comparar(
  ref: Gris, actual: Gris, cal: Calibracion, calibreMm = DIANAS.precision.calibre, diana: ModeloDiana = DIANAS.precision,
): Comparacion {
  const { w, h } = ref;
  const pxMm = (cal.rx + cal.ry) / diana.negro;
  // Hasta el último anillo, si se ve (en la de precisión, 2,4 radios del negro, como siempre).
  const rZona = Math.max(1.1, 0.96 * (diametroExterior(diana) / diana.negro)) * Math.max(cal.rx, cal.ry);
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
  const mm = aMm(cal, xPx, yPx, diana);
  return { impacto: { xPx, yPx, x: mm.x, y: mm.y, valor: puntuar(mm.x, mm.y, calibreMm, diana) }, cambio };
}

/**
 * Vigila una secuencia de imágenes de la diana y avisa de cada impacto nuevo.
 * Un impacto se da por bueno cuando aparece en dos imágenes seguidas en el mismo sitio
 * (así no cuenta un insecto, un reflejo o un temblor). Tras cada impacto, la imagen actual
 * pasa a ser la referencia.
 */
export class Vigia {
  private diana: ModeloDiana;
  private calibreMm: number;

  constructor(diana: ModeloDiana = DIANAS.precision, calibreMm = diana.calibre) {
    this.diana = diana;
    this.calibreMm = calibreMm;
  }

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
      this.ref = detalle(g, cal, this.diana);
      return { estado: 'vigilando', cal };
    }
    const det = detalle(g, this.cal, this.diana);
    const { dx, dy } = afinar(this.ref!, det, this.cal.cx - cal.cx, this.cal.cy - cal.cy, this.cal);
    const alineada = desplazar(det, dx, dy);
    const { impacto, cambio } = comparar(this.ref!, alineada, this.cal, this.calibreMm, this.diana);
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
    const r = 2 * (this.calibreMm / 2) * ((this.cal.rx + this.cal.ry) / this.diana.negro) + 2;
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

/** Agujero encontrado en una foto de la diana; `veces` > 1 si parece que varios disparos entraron juntos. */
export interface Agujero extends Impacto {
  veces: number; // 0 en un grupo: el tirador dice cuántos disparos de la serie entraron ahí
  tam: number; // área de la mancha / área de una bala
  grupo?: { radioPx: number }; // zona con muchos agujeros juntos (no se pueden contar uno a uno)
}

/**
 * Busca los agujeros en UNA foto de la diana ya tirada (sin imagen de referencia).
 * 1. Con la calibración se dibuja cómo sería la diana limpia: negro dentro de la elipse y papel
 *    fuera, con el nivel de luz de cada zona medido en la propia foto (así da igual la sombra).
 * 2. Se resta de la foto suavizada (el suavizado borra las rayas finas de los anillos).
 * 3. Lo que sobra con tamaño de bala es un agujero: más claro en el negro, más oscuro en el blanco.
 *    Una mancha de 2 o 3 balas cuenta como 2 o 3 disparos.
 * Es una propuesta: el tirador la revisa (quita o añade agujeros) antes de apuntarla.
 */
export function buscarAgujeros(g: Gris, cal: Calibracion, diana: ModeloDiana, calibreMm: number): Agujero[] {
  const { w, h, d } = g;
  const pxMm = (cal.rx + cal.ry) / diana.negro;
  const rAgujero = (calibreMm / 2) * pxMm;
  const rZona = Math.max(1.05, (diametroExterior(diana) / diana.negro) * 1.02);
  const zonaDe = (x: number, y: number) => Math.sqrt(((x - cal.cx) / cal.rx) ** 2 + ((y - cal.cy) / cal.ry) ** 2);

  // Niveles de luz locales del negro y del papel: media ponderada en una ventana grande.
  const enNegro = new Float32Array(w * h), enPapel = new Float32Array(w * h);
  const vNegro = new Float32Array(w * h), vPapel = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x, z = zonaDe(x, y);
      // Lejos del borde del negro, para no mezclar niveles.
      if (z < 0.92) { enNegro[i] = 1; vNegro[i] = d[i]; } else if (z > 1.08 && z < rZona) { enPapel[i] = 1; vPapel[i] = d[i]; }
    }
  }
  const rLuz = Math.max(4, Math.round(cal.rx * 0.35));
  const sumN = desenfocar({ w, h, d: vNegro }, rLuz), pesN = desenfocar({ w, h, d: enNegro }, rLuz);
  const sumP = desenfocar({ w, h, d: vPapel }, rLuz), pesP = desenfocar({ w, h, d: enPapel }, rLuz);
  // Niveles globales por si alguna zona queda sin muestras.
  let tn = 0, nn = 0, tp = 0, np = 0;
  for (let i = 0; i < w * h; i++) {
    if (enNegro[i]) { tn += d[i]; nn++; }
    if (enPapel[i]) { tp += d[i]; np++; }
  }
  const negroG = nn ? tn / nn : 30, papelG = np ? tp / np : 220;
  const contraste = Math.max(40, papelG - negroG);

  const suave = desenfocar(g, Math.max(1, Math.round(rAgujero * 0.45)));
  // La plantilla también se suaviza igual, para que el borde del negro no deje un anillo de restos.
  const plantilla = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const n = pesN.d[i] > 0.05 ? sumN.d[i] / pesN.d[i] : negroG;
      const p = pesP.d[i] > 0.05 ? sumP.d[i] / pesP.d[i] : papelG;
      plantilla[i] = zonaDe(x, y) < 1 ? n : p;
    }
  }
  const plant = desenfocar({ w, h, d: plantilla }, Math.max(1, Math.round(rAgujero * 0.45)));

  const umbral = 0.3 * contraste;
  const m = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const z = zonaDe(x, y);
      if (z > rZona) continue;
      const i = y * w + x;
      const dif = suave.d[i] - plant.d[i];
      // Junto al borde del negro cualquier pequeño error de la elipse deja restos: se pide el doble.
      const u = Math.abs(z - 1) * cal.rx < rAgujero * 1.2 ? 2 * umbral : umbral;
      if (z < 1 ? dif > u : dif < -u) m[i] = 1;
    }
  }

  // Si detrás de la diana hay un fondo oscuro, un agujero en el negro no se ve claro: se ve oscuro
  // con el borde de papel roto en gris. Se buscan esos bordes claros (sin contar las rayas de los
  // anillos) y se rellenan para que cada agujero quede como una mancha.
  const radiosRaya = Object.values(diana.anillos).map((dm) => dm / 2).filter((r) => r < diana.negro / 2 - 1);
  if (diana.diezInterior) radiosRaya.push(diana.diezInterior / 2);
  const tolRaya = Math.max(1.2, 1.5 / pxMm);
  const fino = desenfocar(g, 1);
  const bordes = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      // Un agujero que ya se ve claro entero (fondo claro detrás) ya está en la máscara.
      if (zonaDe(x, y) > 0.95 || m[i]) continue;
      const mm = aMm(cal, x, y, diana);
      const r = Math.hypot(mm.x, mm.y);
      if (radiosRaya.some((rr) => Math.abs(r - rr) < tolRaya)) continue;
      const n = pesN.d[i] > 0.05 ? sumN.d[i] / pesN.d[i] : negroG;
      if (fino.d[i] - n > 0.2 * contraste) bordes[i] = 1;
    }
  }
  const rellenos = cerrar(bordes, w, h, Math.max(1, Math.round(rAgujero)));
  for (let i = 0; i < m.length; i++) if (rellenos[i]) m[i] = 1;

  // Los números de los anillos (del 1 al 9, en las dos rayas que cruzan la diana) se parecen a un
  // agujero: lo que cae justo encima de un número se descarta (si era un disparo, se añade a mano).
  const paso = (diana.anillos[8] - diana.anillos[9]) / 2;
  // Posición de número: en una de las cuatro rayas (arriba, abajo, izquierda, derecha), en el centro
  // de un anillo del 1 al 8. Devuelve el anillo y la raya (0-3), o null.
  const numeroEn = (x: number, y: number): { v: number; raya: number } | null => {
    const r = Math.hypot(x, y);
    const grados = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
    const raya = Math.round(grados / 90) % 4;
    if (Math.abs(grados - Math.round(grados / 90) * 90) > 8) return null;
    for (const [v, dm] of Object.entries(diana.anillos)) {
      if (Number(v) <= 9 && Math.abs(r - (dm / 2 - paso / 2)) < 0.45 * paso) return { v: Number(v), raya };
    }
    return null;
  };

  const esperada = Math.PI * rAgujero * rAgujero;
  const mmPx = { x: diana.negro / 2 / cal.rx, y: diana.negro / 2 / cal.ry };
  const res: Agujero[] = [];
  const manchaDe = new Map<Agujero, Mancha>();
  for (const k of manchas(m, w, h)) {
    const bw = k.x1 - k.x0 + 1, bh = k.y1 - k.y0 + 1;
    if (k.area < 0.55 * esperada) continue;
    const tam = k.area / esperada;
    const xPx = k.sx / k.area, yPx = k.sy / k.area;
    const mm = aMm(cal, xPx, yPx, diana);
    const relleno = k.area / (bw * bh);
    if (tam > 4.5) {
      // Muchos agujeros juntos (diana ya usada o una agrupación): no se cuentan uno a uno.
      if (zonaDe(xPx, yPx) < 1 && relleno > 0.2) {
        const radioPx = Math.hypot(bw, bh) / 2;
        res.push({ xPx, yPx, x: mm.x, y: mm.y, valor: puntuar(mm.x, mm.y, calibreMm, diana), veces: 0, tam, grupo: { radioPx } });
      }
      continue;
    }
    // Más alargado que dos balas juntas: no es un agujero (números, rayas, bordes).
    if (bw / bh > 2.6 || bh / bw > 2.6 || relleno < 0.35) continue;
    // Un agujero suelto mide entre 0,9 y 1,5 balas (el borde roto y el suavizado lo agrandan).
    const veces = tam < 1.75 ? 1 : Math.min(4, Math.round(tam / 1.2));
    const a: Agujero = { xPx, yPx, x: mm.x, y: mm.y, valor: puntuar(mm.x, mm.y, calibreMm, diana), veces, tam };
    manchaDe.set(a, k);
    res.push(a);
  }
  // Los números impresos: en el sitio de un número, una mancha más alta que ancha (medida en mm, para
  // que no engañe una foto de lado) es la cifra; un agujero es redondo. Y si un anillo tiene manchas
  // en 3 o 4 de las rayas, son sus números.
  const alta = (a: Agujero) => {
    const k = manchaDe.get(a);
    return !!k && (k.y1 - k.y0 + 1) * mmPx.y > 1.5 * (k.x1 - k.x0 + 1) * mmPx.x;
  };
  const rayas = new Map<number, Set<number>>();
  for (const a of res) {
    const n = a.grupo ? null : numeroEn(a.x, a.y);
    if (n) rayas.set(n.v, (rayas.get(n.v) ?? new Set()).add(n.raya));
  }
  return res.filter((a) => {
    const n = a.grupo ? null : numeroEn(a.x, a.y);
    return !n || ((rayas.get(n.v)?.size ?? 0) < 3 && !alta(a));
  });
}
