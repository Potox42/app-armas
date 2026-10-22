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
 * 2. Se resta de la foto suavizada con una ventana del tamaño de una bala.
 * 3. Cada máximo local de lo que sobra es un agujero: más claro en el negro, más oscuro en el blanco.
 *    Así se separan los agujeros que se tocan (en la prueba real de octubre de 2026 se escapaban
 *    los del centro, juntos en una sola mancha, y los del blanco, grises y poco marcados).
 * Es una propuesta: el tirador la revisa (quita o añade agujeros) antes de apuntarla.
 */
export function buscarAgujeros(g: Gris, cal: Calibracion, diana: ModeloDiana, calibreMm: number): Agujero[] {
  const { w, h, d } = g;
  const pxMm = (cal.rx + cal.ry) / diana.negro;
  const rAgujero = (calibreMm / 2) * pxMm;
  const rZona = Math.max(1.05, (diametroExterior(diana) / diana.negro) * 1.02);
  const zonaDe = (x: number, y: number) => Math.sqrt(((x - cal.cx) / cal.rx) ** 2 + ((y - cal.cy) / cal.ry) ** 2);

  // Entre el negro y el papel: la mitad entre el nivel típico de dentro y el de justo fuera.
  const anillo = (z0: number, z1: number) => {
    const v: number[] = [];
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) { const z = zonaDe(x, y); if (z > z0 && z < z1) v.push(d[y * w + x]); }
    v.sort((a, b) => a - b);
    return v.length ? v[v.length >> 1] : 128;
  };
  const corte = (anillo(0, 0.9) + anillo(1.1, 1.5)) / 2;
  // Niveles de luz locales del negro y del papel: media ponderada en una ventana grande.
  const enNegro = new Float32Array(w * h), enPapel = new Float32Array(w * h);
  const vNegro = new Float32Array(w * h), vPapel = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x, z = zonaDe(x, y);
      // Lejos del borde del negro, para no mezclar niveles.
      // En el papel no cuenta lo oscuro (la mesa o el soporte que asoman por el borde de la hoja).
      if (z < 0.92) { enNegro[i] = 1; vNegro[i] = d[i]; } else if (z > 1.08 && z < rZona && d[i] > corte) { enPapel[i] = 1; vPapel[i] = d[i]; }
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

  // Cada punto se compara con una ventana del tamaño de una bala, y la plantilla se suaviza igual
  // para que el borde del negro no deje un anillo de restos.
  const rBala = Math.max(2, Math.round(rAgujero * 0.8));
  const suave = desenfocar(g, rBala);
  const plantilla = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const n = pesN.d[i] > 0.05 ? sumN.d[i] / pesN.d[i] : negroG;
      const p = pesP.d[i] > 0.05 ? sumP.d[i] / pesP.d[i] : papelG;
      plantilla[i] = zonaDe(x, y) < 1 ? n : p;
    }
  }
  const plant = desenfocar({ w, h, d: plantilla }, rBala);

  // Cuánto se sale cada punto de la diana limpia: más claro en el negro (el papel roto y el fondo
  // que asoma), más oscuro en el blanco. Un agujero es un máximo local de esa diferencia; buscando
  // máximos (y no manchas) se separan los agujeros que se tocan.
  const dif = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x, z = zonaDe(x, y);
      dif[i] = z > rZona ? 0 : z < 1 ? suave.d[i] - plant.d[i] : plant.d[i] - suave.d[i];
    }
  }
  const umbral = 0.15 * contraste;
  const alrededor = desenfocar(g, Math.max(4, Math.round(rAgujero * 3)));
  const rPico = Math.max(2, Math.round(rAgujero * 1.6)); // dos agujeros se tocan a 2 radios
  const margen = rBala + 2; // sin mirar el borde de la foto (fuera de la diana)
  // Una raya (la de un anillo, el borde de una sombra) sigue igual de marcada a los dos lados del
  // punto en su dirección; un agujero se acaba enseguida en todas las direcciones.
  const lejos = Math.max(3, Math.round(rAgujero * 1.8));
  const dirs = [[1, 0], [0, 1], [0.7071, 0.7071], [0.7071, -0.7071]];
  const difEn = (x: number, y: number) => {
    const xi = Math.round(x), yi = Math.round(y);
    return xi < 0 || yi < 0 || xi >= w || yi >= h ? 0 : dif[yi * w + xi];
  };
  const alargado = (x: number, y: number, v: number) =>
    dirs.some(([ux, uy]) => Math.min(difEn(x + ux * lejos, y + uy * lejos), difEn(x - ux * lejos, y - uy * lejos)) > 0.5 * v);
  const picos: { x: number; y: number; v: number }[] = [];
  for (let y = margen; y < h - margen; y++) {
    for (let x = margen; x < w - margen; x++) {
      const i = y * w + x, v = dif[i];
      if (v < umbral) continue;
      // Junto al borde del negro cualquier pequeño error de la elipse deja restos: se pide más.
      if (Math.abs(zonaDe(x, y) - 1) * cal.rx < rAgujero * 1.2 && v < 1.6 * umbral) continue;
      // En el blanco, alrededor del agujero tiene que haber papel: si no, es el borde de la hoja o lo
      // que hay detrás (la mesa, el soporte).
      if (zonaDe(x, y) > 1 && Math.abs(alrededor.d[i] - plantilla[i]) > 0.3 * contraste) continue;
      let maximo = true;
      for (let dy = -rPico; dy <= rPico && maximo; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -rPico; dx <= rPico; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w || (dx === 0 && dy === 0)) continue;
          const o = dif[yy * w + xx];
          // En una meseta solo cuenta el primer punto.
          if (o > v || (o === v && (dy < 0 || (dy === 0 && dx < 0)))) { maximo = false; break; }
        }
      }
      if (maximo && !alargado(x, y, v)) picos.push({ x, y, v });
    }
  }

  // Los números de los anillos (del 1 al 9, en las cuatro rayas que cruzan la diana: arriba, abajo,
  // izquierda y derecha, en el centro de cada anillo) se parecen a un agujero. Cada número está
  // impreso igual (derecho) en las cuatro rayas: si lo que hay en el sitio de un número se parece a lo
  // que hay en el mismo anillo de otra raya, es la cifra. Un agujero encima de la cifra la estropea y
  // deja de parecerse, así que ese sí se cuenta.
  const fino = desenfocar(g, 1);
  const paso = (diana.anillos[8] - diana.anillos[9]) / 2;
  const rayas = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const numeroEn = (x: number, y: number): { rc: number; raya: number } | null => {
    const r = Math.hypot(x, y);
    const raya = Math.abs(x) > Math.abs(y) ? (x > 0 ? 0 : 2) : y > 0 ? 1 : 3;
    // Con margen: la diana puede estar un poco girada en la foto y las cifras se apartan de la raya.
    if (Math.min(Math.abs(x), Math.abs(y)) > 0.4 * paso + 0.05 * r) return null;
    for (const [v, dm] of Object.entries(diana.anillos)) {
      const rc = dm / 2 - paso / 2;
      if (Number(v) <= 9 && Math.abs(r - rc) <= 0.5 * paso) return { rc, raya };
    }
    return null;
  };
  const N = 16, lado = 0.7 * paso;
  const parche = (xm: number, ym: number): Float32Array | null => {
    const o = new Float32Array(N * N);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const px = cal.cx + ((xm + (i / (N - 1) - 0.5) * lado) / (diana.negro / 2)) * cal.rx;
        const py = cal.cy + ((ym + (j / (N - 1) - 0.5) * lado) / (diana.negro / 2)) * cal.ry;
        if (px < 1 || py < 1 || px > w - 2 || py > h - 2) return null;
        o[j * N + i] = muestra(fino, px, py);
      }
    }
    return o;
  };
  const parecido = (a: Float32Array, b: Float32Array): number => {
    let ma = 0, mb = 0;
    for (let i = 0; i < a.length; i++) { ma += a[i]; mb += b[i]; }
    ma /= a.length; mb /= b.length;
    let ab = 0, aa = 0, bb = 0;
    for (let i = 0; i < a.length; i++) {
      const da = a[i] - ma, db = b[i] - mb;
      ab += da * db; aa += da * da; bb += db * db;
    }
    return aa && bb ? ab / Math.sqrt(aa * bb) : 0;
  };
  // Lo que sobra al restar la cifra de otra raya: si queda una mancha clara del tamaño de una bala,
  // hay un agujero encima de la cifra.
  const sobra = (a: Float32Array, b: Float32Array): number => {
    let ma = 0, mb = 0;
    for (let i = 0; i < a.length; i++) { ma += a[i]; mb += b[i]; }
    ma /= a.length; mb /= b.length;
    let ab = 0, bb = 0;
    for (let i = 0; i < a.length; i++) { ab += (a[i] - ma) * (b[i] - mb); bb += (b[i] - mb) ** 2; }
    const k = bb ? ab / bb : 0;
    const res = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) res[i] = a[i] - ma - k * (b[i] - mb);
    // Solo cuenta lo que sobra en el centro: un agujero al lado de la cifra no la convierte en agujero.
    let max = 0;
    for (let j = N >> 2; j < N - (N >> 2); j++) {
      for (let i = N >> 2; i < N - (N >> 2); i++) {
        let t = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) t += res[(j + dj) * N + i + di];
        max = Math.max(max, Math.abs(t / 9));
      }
    }
    return max;
  };
  const esCifra = (x: number, y: number): boolean => {
    const n = numeroEn(x, y);
    if (!n) return false;
    const mio = parche(x, y);
    if (!mio) return false;
    // Para cada raya, la posición donde mejor se parece; luego se afina la propia (un poco)
    // y se queda lo que menos sobra: así un pequeño descuadre no hace ver un agujero que no hay.
    let mejor = -1, resto = Infinity;
    for (let k = 0; k < 4; k++) {
      if (k === n.raya) continue;
      const [dx, dy] = rayas[k];
      let pk = -1, igual: Float32Array | null = null;
      for (let oy = -0.4; oy <= 0.401; oy += 0.05) {
        for (let ox = -0.4; ox <= 0.401; ox += 0.05) {
          const otro = parche(dx * n.rc + ox * paso, dy * n.rc + oy * paso);
          if (!otro) continue;
          const p = parecido(mio, otro);
          if (p > pk) { pk = p; igual = otro; }
        }
      }
      if (!igual || pk < 0.5) continue;
      mejor = Math.max(mejor, pk);
      for (let oy = -0.02; oy <= 0.021; oy += 0.02) {
        for (let ox = -0.02; ox <= 0.021; ox += 0.02) {
          const yo = parche(x + ox * paso, y + oy * paso);
          if (yo) resto = Math.min(resto, sobra(yo, igual));
        }
      }
    }
    return mejor > 0.5 && resto < 0.18 * contraste;
  };

  // Cómo de rellena está la mancha: lo oscura que es de media frente a su punto más oscuro.
  const relleno = (x: number, y: number): number => {
    const papel = plantilla[y * w + x];
    let min = Infinity, suma = 0, n = 0;
    for (let dy = -rBala - 2; dy <= rBala + 2; dy++) {
      for (let dx = -rBala - 2; dx <= rBala + 2; dx++) {
        const yy = y + dy, xx = x + dx;
        if (yy < 0 || xx < 0 || yy >= h || xx >= w) continue;
        min = Math.min(min, fino.d[yy * w + xx]);
        suma += d[yy * w + xx];
        n++;
      }
    }
    return papel - min > 1 ? (papel - suma / n) / (papel - min) : 0;
  };
  // Si los agujeros de esta foto se ven muy marcados, lo que apenas destaca es ruido (rayas con el
  // enfoque del móvil, textura del papel): se pide al menos un tercio de lo que marcan los agujeros.
  const fuertes = picos.map((k) => k.v).sort((a, b) => a - b);
  const tipico = fuertes.length ? fuertes[Math.floor(fuertes.length * 0.75)] : 0;
  const res: Agujero[] = [];
  for (const k of picos) {
    if (k.v < 0.33 * tipico) continue;
    const mm = aMm(cal, k.x, k.y, diana);
    if (esCifra(mm.x, mm.y)) continue;
    // En el blanco, en el sitio de una cifra (que a veces no se puede comparar con la de otra raya
    // porque queda fuera de la foto) solo vale una mancha gris rellena; los trazos de una cifra
    // son finos y muy oscuros.
    if (zonaDe(k.x, k.y) > 1 && numeroEn(mm.x, mm.y) && relleno(k.x, k.y) < 0.33) continue;
    res.push({ xPx: k.x, yPx: k.y, x: mm.x, y: mm.y, valor: puntuar(mm.x, mm.y, calibreMm, diana), veces: 1, tam: k.v / contraste });
  }
  return res;
}

/**
 * Agujeros nuevos comparando la foto de la diana ANTES de la serie con la de DESPUÉS.
 * Las dos fotos se pasan a una rejilla común en milímetros (con la calibración de cada una), se
 * busca el pequeño giro y desplazamiento que mejor las encaja y se restan: lo que cambia con tamaño
 * de bala es un agujero nuevo, aunque la diana ya esté llena de agujeros de series anteriores.
 * Devuelve las posiciones en píxeles de la foto de después.
 */
export function agujerosNuevos(
  antes: Gris, calA: Calibracion, despues: Gris, calD: Calibracion, diana: ModeloDiana, calibreMm: number,
): Agujero[] {
  const radioMm = diana.negro / 2;
  const pxMm = (calD.rx + calD.ry) / diana.negro;
  const paso = Math.max(0.25, 0.8 / pxMm); // mm por punto de la rejilla (sin perder detalle de la foto de después)
  const alcance = Math.min(diametroExterior(diana) / 2, 1.6 * radioMm);
  const n = Math.ceil((2 * alcance) / paso);
  const aPx = (cal: Calibracion, u: number, v: number) => [cal.cx + (u / radioMm) * cal.rx, cal.cy + (v / radioMm) * cal.ry] as const;
  const dentro = (g: Gris, x: number, y: number) => x >= 1 && y >= 1 && x < g.w - 2 && y < g.h - 2;

  // Rejilla de la foto de después.
  const D = new Float32Array(n * n), valido = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const u = -alcance + i * paso, v = -alcance + j * paso;
      if (u * u + v * v > alcance * alcance) continue;
      const [x, y] = aPx(calD, u, v);
      if (!dentro(despues, x, y)) continue;
      D[j * n + i] = muestra(despues, x, y);
      valido[j * n + i] = 1;
    }
  }
  const rejillaAntes = (giro: number, du: number, dv: number, cada: number) => {
    const c = Math.cos(giro), s = Math.sin(giro);
    const A = new Float32Array(n * n), ok = new Uint8Array(n * n);
    for (let j = 0; j < n; j += cada) {
      for (let i = 0; i < n; i += cada) {
        const k = j * n + i;
        if (!valido[k]) continue;
        const u = -alcance + i * paso, v = -alcance + j * paso;
        const [x, y] = aPx(calA, c * u - s * v + du, s * u + c * v + dv);
        if (!dentro(antes, x, y)) continue;
        A[k] = muestra(antes, x, y);
        ok[k] = 1;
      }
    }
    return { A, ok };
  };
  const parecido = (A: Float32Array, ok: Uint8Array, cada: number) => {
    let sa = 0, sd = 0, m = 0;
    for (let j = 0; j < n; j += cada) for (let i = 0; i < n; i += cada) { const k = j * n + i; if (ok[k]) { sa += A[k]; sd += D[k]; m++; } }
    if (m < 100) return -1;
    sa /= m; sd /= m;
    let ad = 0, aa = 0, dd = 0;
    for (let j = 0; j < n; j += cada) {
      for (let i = 0; i < n; i += cada) {
        const k = j * n + i;
        if (!ok[k]) continue;
        const a = A[k] - sa, d = D[k] - sd;
        ad += a * d; aa += a * a; dd += d * d;
      }
    }
    return aa && dd ? ad / Math.sqrt(aa * dd) : -1;
  };
  // Encaje: primero el giro (las cifras y las rayas lo marcan), luego el desplazamiento fino.
  const grueso = Math.max(1, Math.round(1.5 / paso));
  let mejor = { giro: 0, du: 0, dv: 0, p: -2 };
  for (let g = -6; g <= 6; g += 0.5) {
    const { A, ok } = rejillaAntes((g * Math.PI) / 180, 0, 0, grueso);
    const p = parecido(A, ok, grueso);
    if (p > mejor.p) mejor = { giro: g, du: 0, dv: 0, p };
  }
  const fino = Math.max(1, Math.round(0.6 / paso));
  const g0 = mejor.giro;
  for (let g = g0 - 0.5; g <= g0 + 0.501; g += 0.125) {
    const { A, ok } = rejillaAntes((g * Math.PI) / 180, 0, 0, fino);
    const p = parecido(A, ok, fino);
    if (p > mejor.p) mejor = { giro: g, du: 0, dv: 0, p };
  }
  for (let dv = -2; dv <= 2.001; dv += 0.25) {
    for (let du = -2; du <= 2.001; du += 0.25) {
      const { A, ok } = rejillaAntes((mejor.giro * Math.PI) / 180, du, dv, fino);
      const p = parecido(A, ok, fino);
      if (p > mejor.p) mejor = { ...mejor, du, dv, p };
    }
  }
  const { A, ok } = rejillaAntes((mejor.giro * Math.PI) / 180, mejor.du, mejor.dv, 1);

  // Cada foto con su propia luz: se resta su media local y se ajusta el contraste del antes al después.
  const rLuz = Math.max(4, Math.round(12 / paso));
  const local = (X: Float32Array) => desenfocar({ w: n, h: n, d: X }, rLuz).d;
  const mA = local(A), mD = local(D);
  const rAg = calibreMm / 2 / paso;
  const suavizar = (X: Float32Array) => desenfocar({ w: n, h: n, d: X }, 1).d;
  const a0 = new Float32Array(n * n), d0 = new Float32Array(n * n);
  let sa = 0, sd = 0;
  for (let k = 0; k < n * n; k++) {
    if (!ok[k]) continue;
    a0[k] = A[k] - mA[k]; d0[k] = D[k] - mD[k];
    sa += Math.abs(a0[k]); sd += Math.abs(d0[k]);
  }
  const escala = sa ? sd / sa : 1;
  for (let k = 0; k < n * n; k++) a0[k] *= escala;
  const sA = suavizar(a0), sD = suavizar(d0);

  // Contraste de referencia: papel menos negro en la foto de después.
  let tn = 0, nn = 0, tp = 0, np = 0;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      if (!ok[k]) continue;
      const r = Math.hypot(-alcance + i * paso, -alcance + j * paso) / radioMm;
      if (r < 0.9) { tn += D[k]; nn++; } else if (r > 1.1) { tp += D[k]; np++; }
    }
  }
  const contraste = Math.max(40, (np ? tp / np : 220) - (nn ? tn / nn : 30));

  // Diferencia que no se explica moviendo un punto de la rejilla (un encaje casi perfecto deja
  // restos en los bordes de rayas y cifras): así solo queda lo que de verdad es nuevo.
  const m = new Uint8Array(n * n);
  const umbral = 0.22 * contraste;
  for (let j = 2; j < n - 2; j++) {
    for (let i = 2; i < n - 2; i++) {
      const k = j * n + i;
      if (!ok[k]) continue;
      let menor = Infinity;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const q = k + dj * n + di;
          if (ok[q]) menor = Math.min(menor, Math.abs(sD[k] - sA[q]));
        }
      }
      if (menor > umbral) m[k] = 1;
    }
  }
  // Un agujero en el negro con fondo oscuro detrás cambia solo en el borde roto (un anillo de trozos):
  // se engordan los trozos para que el anillo quede como una mancha y se mide esa mancha.
  const rd = Math.max(1, Math.round(rAg * 0.5));
  const f = new Float32Array(n * n);
  for (let k = 0; k < n * n; k++) f[k] = m[k];
  const eng = desenfocar({ w: n, h: n, d: f }, rd).d;
  const gordo = new Uint8Array(n * n);
  for (let k = 0; k < n * n; k++) gordo[k] = eng[k] > 1e-4 ? 1 : 0;

  const esperada = Math.PI * rAg * rAg;
  const unoGordo = Math.PI * (rAg + rd) ** 2; // lo que mide un agujero suelto tras engordarlo
  const res: Agujero[] = [];
  for (const k of manchas(gordo, n, n)) {
    if (k.area < 0.8 * esperada) continue;
    let cambio = 0;
    for (let j = k.y0; j <= k.y1; j++) for (let i = k.x0; i <= k.x1; i++) cambio += m[j * n + i];
    if (cambio < 0.12 * esperada) continue;
    const tam = k.area / unoGordo;
    const veces = tam < 1.6 ? 1 : Math.min(5, Math.round(tam / 1.2));
    const u = -alcance + (k.sx / k.area) * paso, v = -alcance + (k.sy / k.area) * paso;
    const [xPx, yPx] = aPx(calD, u, v);
    res.push({ xPx, yPx, x: u, y: v, valor: puntuar(u, v, calibreMm, diana), veces, tam });
  }
  return res;
}
