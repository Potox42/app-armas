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
export function calibrar(g: Gris, alcance = 0.48, centro?: { x: number; y: number }): Calibracion | null {
  return buscarNegro(g, alcance, centro) ?? calibrarOtsu(g, alcance, centro);
}

/**
 * Busca el negro probando varios umbrales de gris. Con el catalejo el negro sale gris (a veces casi
 * tan claro como el papel), alrededor queda el tubo oscuro y la imagen tiene viñeteado: un solo umbral
 * separa el tubo del resto y el negro se pierde (prueba en el campo de octubre de 2026). Aquí vale
 * una mancha redonda, maciza, que no toque el borde de la imagen ni el del tubo, y rodeada de algo
 * más claro (el papel). Se queda la que más contraste tiene con lo que la rodea.
 */
function buscarNegro(g: Gris, alcance: number, centro?: { x: number; y: number }): Calibracion | null {
  // Media resolución: basta para el negro y prueba muchos umbrales deprisa.
  const w = g.w >> 1, h = g.h >> 1;
  if (w < 40 || h < 40) return null;
  const media = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = 2 * y * g.w + 2 * x;
      media[y * w + x] = (g.d[i] + g.d[i + 1] + g.d[i + g.w] + g.d[i + g.w + 1]) / 4;
    }
  }
  const lado = Math.min(w, h);
  const s = desenfocar({ w, h, d: media }, Math.max(1, Math.round(lado / 120)));
  const cx0 = centro ? centro.x / 2 : w / 2, cy0 = centro ? centro.y / 2 : h / 2, rMax = alcance * lado;
  const dentro = (x: number, y: number) => (x - cx0) ** 2 + (y - cy0) ** 2 < rMax * rMax;
  const valores: number[] = [];
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (dentro(x, y)) valores.push(s.d[y * w + x]);
  if (valores.length < 100) return null;
  valores.sort((a, b) => a - b);
  // Media de gris en una corona de la elipse (z0 a z1 radios) y qué parte es más clara que t.
  const corona = (c: Calibracion, z0: number, z1: number, t: number) => {
    let suma = 0, n = 0, claros = 0;
    const R = z1 * Math.max(c.rx, c.ry);
    for (let y = Math.max(0, Math.floor(c.cy - R)); y <= Math.min(h - 1, Math.ceil(c.cy + R)); y += 2) {
      for (let x = Math.max(0, Math.floor(c.cx - R)); x <= Math.min(w - 1, Math.ceil(c.cx + R)); x += 2) {
        const z = Math.sqrt(((x - c.cx) / c.rx) ** 2 + ((y - c.cy) / c.ry) ** 2);
        if (z < z0 || z > z1) continue;
        const v = s.d[y * w + x];
        suma += v; n++;
        if (v >= t) claros++;
      }
    }
    return { media: n ? suma / n : 0, claros: n ? claros / n : 0, n };
  };
  let mejor: { cal: Calibracion; nota: number; corte: number } | null = null;
  const m = new Uint8Array(w * h);
  for (let p = 0.04; p <= 0.8; p += 0.03) {
    const t = valores[Math.floor(p * (valores.length - 1))];
    m.fill(0);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (dentro(x, y) && s.d[y * w + x] < t) m[y * w + x] = 1;
    for (const k of manchas(m, w, h)) {
      const bw = k.x1 - k.x0 + 1, bh = k.y1 - k.y0 + 1;
      if (Math.min(bw, bh) < 0.07 * lado || bw / bh > 1.45 || bh / bw > 1.45) continue;
      if (k.area / (bw * bh) < 0.62) continue;
      // Ni el borde de la imagen ni el del tubo del catalejo (lo que está fuera del alcance).
      if (k.x0 <= 1 || k.y0 <= 1 || k.x1 >= w - 2 || k.y1 >= h - 2) continue;
      const cal = { cx: (k.x0 + k.x1) / 2, cy: (k.y0 + k.y1) / 2, rx: bw / 2, ry: bh / 2 };
      if (Math.hypot(cal.cx - cx0, cal.cy - cy0) + Math.max(cal.rx, cal.ry) > 0.98 * rMax) continue;
      const fuera = corona(cal, 1.12, 1.45, t);
      const negro = corona(cal, 0, 0.85, t);
      if (fuera.n < 20 || fuera.claros < 0.85) continue;
      const contraste = fuera.media - negro.media;
      if (contraste < 12) continue;
      const nota = contraste * fuera.claros * (k.area / (bw * bh));
      if (!mejor || nota > mejor.nota) mejor = { cal, nota, corte: (fuera.media + negro.media) / 2 };
    }
  }
  if (!mejor) return null;
  const c = mejor.cal;
  const aprox = { cx: 2 * c.cx + 0.5, cy: 2 * c.cy + 0.5, rx: 2 * c.rx, ry: 2 * c.ry };
  return afinarNegro(g, aprox, mejor.corte) ?? aprox;
}

/** El borde del negro a resolución completa, cortando a medio camino entre el negro y el papel. */
function afinarNegro(g: Gris, c: Calibracion, corte: number): Calibracion | null {
  const { w, h } = g;
  const s = desenfocar(g, Math.max(1, Math.round(Math.min(w, h) / 160)));
  const R = 1.3 * Math.max(c.rx, c.ry);
  const m = new Uint8Array(w * h);
  for (let y = Math.max(0, Math.floor(c.cy - R)); y < Math.min(h, Math.ceil(c.cy + R)); y++) {
    for (let x = Math.max(0, Math.floor(c.cx - R)); x < Math.min(w, Math.ceil(c.cx + R)); x++) {
      if ((x - c.cx) ** 2 + (y - c.cy) ** 2 < R * R && s.d[y * w + x] < corte) m[y * w + x] = 1;
    }
  }
  const todas = manchas(m, w, h);
  let mejor: Mancha | null = null;
  for (const k of todas) {
    // La que contiene el centro aproximado (o la más grande cerca de él).
    if (Math.hypot((k.x0 + k.x1) / 2 - c.cx, (k.y0 + k.y1) / 2 - c.cy) > 0.25 * c.rx) continue;
    if (!mejor || k.area > mejor.area) mejor = k;
  }
  if (!mejor) return null;
  const bw0 = mejor.x1 - mejor.x0 + 1, bh0 = mejor.y1 - mejor.y0 + 1;
  // Trozos de la corona exterior separados por una raya blanca de anillo.
  for (const k of todas) {
    if (k === mejor || k.area < 0.02 * mejor.area) continue;
    if (k.x0 < mejor.x0 - 0.35 * bw0 || k.x1 > mejor.x1 + 0.35 * bw0 || k.y0 < mejor.y0 - 0.35 * bh0 || k.y1 > mejor.y1 + 0.35 * bh0) continue;
    mejor = { ...mejor, x0: Math.min(mejor.x0, k.x0), x1: Math.max(mejor.x1, k.x1), y0: Math.min(mejor.y0, k.y0), y1: Math.max(mejor.y1, k.y1) };
  }
  const r = { cx: (mejor.x0 + mejor.x1) / 2, cy: (mejor.y0 + mejor.y1) / 2, rx: (mejor.x1 - mejor.x0 + 1) / 2, ry: (mejor.y1 - mejor.y0 + 1) / 2 };
  // Si se ha ido de tamaño (se ha unido al fondo, o se ha partido), mejor la aproximada.
  if (Math.abs(r.rx / c.rx - 1) > 0.12 || Math.abs(r.ry / c.ry - 1) > 0.12) return null;
  return r;
}

/**
 * Afina el centro con las rayas blancas de los anillos de dentro del negro: con el centro bueno,
 * a cada distancia del centro todo es raya o todo es negro, y el perfil de gris por distancias sale
 * lo más marcado posible. El borde del negro solo da el centro con un par de píxeles de error, y
 * eso deja restos de las rayas al buscar agujeros.
 */
export function centrarAnillos(g: Gris, cal: Calibracion): Calibracion {
  const { w, h } = g;
  const s = desenfocar(g, 1);
  const dz = 0.6 / Math.max(cal.rx, cal.ry), nb = Math.ceil(0.95 / dz) + 1;
  const suma = new Float64Array(nb), n = new Float64Array(nb);
  const nota = (cx: number, cy: number) => {
    suma.fill(0); n.fill(0);
    const R = 0.95 * Math.max(cal.rx, cal.ry);
    let total = 0, cuenta = 0;
    for (let y = Math.max(0, Math.floor(cy - R)); y < Math.min(h, cy + R); y += 2) {
      for (let x = Math.max(0, Math.floor(cx - R)); x < Math.min(w, cx + R); x += 2) {
        const z = Math.sqrt(((x - cx) / cal.rx) ** 2 + ((y - cy) / cal.ry) ** 2);
        if (z >= 0.95) continue;
        const v = s.d[y * w + x], b = Math.floor(z / dz);
        suma[b] += v; n[b]++; total += v; cuenta++;
      }
    }
    if (!cuenta) return 0;
    const media = total / cuenta;
    let entre = 0;
    for (let b = 0; b < nb; b++) if (n[b]) entre += n[b] * (suma[b] / n[b] - media) ** 2;
    return entre / cuenta;
  };
  let mejor = { cx: cal.cx, cy: cal.cy, p: nota(cal.cx, cal.cy) };
  const probar = (paso: number, alcance: number) => {
    const c0 = { ...mejor };
    for (let dy = -alcance; dy <= alcance + 1e-9; dy += paso) {
      for (let dx = -alcance; dx <= alcance + 1e-9; dx += paso) {
        const p = nota(c0.cx + dx, c0.cy + dy);
        if (p > mejor.p) mejor = { cx: c0.cx + dx, cy: c0.cy + dy, p };
      }
    }
  };
  const r = Math.max(2, Math.round(Math.max(cal.rx, cal.ry) * 0.02));
  probar(1, r);
  probar(0.25, 1);
  return { ...cal, cx: mejor.cx, cy: mejor.cy };
}

/** El método anterior (un solo umbral de Otsu): de reserva si el nuevo no encuentra nada. */
function calibrarOtsu(g: Gris, alcance = 0.48, centro?: { x: number; y: number }): Calibracion | null {
  const { w, h } = g;
  const lado = Math.min(w, h);
  const r = Math.max(1, Math.round(lado / 160));
  const s = desenfocar(g, r);
  // Por defecto se mira alrededor del centro de la imagen; si el tirador ha tocado dónde está la
  // diana (el móvil en un soporte no siempre la deja en medio), alrededor de ese punto.
  const cx0 = centro?.x ?? w / 2, cy0 = centro?.y ?? h / 2, rMax = alcance * lado;
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
  /** Dónde ha dicho el tirador que está la diana (en píxeles de la imagen), si no está en medio. */
  centro: { x: number; y: number } | null = null;
  private ref: Gris | null = null;
  private ultima: Gris | null = null; // última imagen alineada, para tomarla de referencia
  private pendiente: Impacto | null = null;
  private estables = 0;

  /** Procesa una imagen. Devuelve el impacto confirmado, si lo hay. */
  procesar(g: Gris): { estado: 'buscando' | 'calibrando' | 'vigilando'; impacto?: Impacto; cal?: Calibracion } {
    // Ya fijada, la diana se sigue buscando donde estaba; si no, donde la tocó el tirador o en medio.
    const cerca = this.cal ? { x: this.cal.cx, y: this.cal.cy } : this.centro ?? undefined;
    // Sin pista, si no aparece en medio se mira en casi toda la imagen.
    const cal = calibrar(g, 0.48, cerca) ?? (!cerca ? calibrar(g, 0.7) : null);
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
    this.ultima = alineada;
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

  /**
   * El tirador ha marcado un disparo a mano: lo que se ve ahora pasa a ser la referencia, para no
   * contar luego ese mismo agujero otra vez.
   */
  marcadoAMano() {
    this.pendiente = null;
    if (this.ultima) this.ref = this.ultima;
  }

  /** Vuelve a empezar (otra diana o se ha movido el soporte). */
  reiniciar() {
    this.ultima = null;
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
 * 1. La diana limpia se mide en la propia foto: la mediana por sectores y distancias al centro (con
 *    las rayas de los anillos, el viñeteado y la sombra). Se resta y queda lo que no es de la diana.
 * 2. En el negro cuenta lo que se aparta en los dos sentidos (con el catalejo el agujero tiene partes
 *    claras y oscuras); en el blanco, lo más oscuro. Se quitan los restos de rayas.
 * 3. Cada máximo local suelto es un agujero (así se separan los que se tocan); las cifras impresas
 *    se reconocen comparándolas con las de las otras rayas.
 * Probado con las fotos reales de octubre de 2026 (foto de cerca y foto por el catalejo).
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

  // Ventana del tamaño de una bala; la plantilla de luz de negro y papel sirve para mirar alrededor.
  const rBala = Math.max(2, Math.round(rAgujero * 0.8));
  const plantilla = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const n = pesN.d[i] > 0.05 ? sumN.d[i] / pesN.d[i] : negroG;
      const p = pesP.d[i] > 0.05 ? sumP.d[i] / pesP.d[i] : papelG;
      plantilla[i] = zonaDe(x, y) < 1 ? n : p;
    }
  }

  // La diana limpia, medida en la propia foto: como es redonda, en cada sector (16 porciones de
  // tarta) y a cada distancia del centro, lo normal es la mediana de lo que hay; los agujeros son
  // pocos y no la mueven. Así salen en la plantilla las rayas de los anillos, el borde del negro, el
  // viñeteado y la sombra, y al restarla queda lo que no es de la diana: agujeros y cifras.
  const casiFino = desenfocar(g, 1);
  const S = 16, dz = 0.6 / Math.max(cal.rx, cal.ry), nb = Math.ceil(rZona / dz) + 2;
  const cajas: number[][] = Array.from({ length: S * nb }, () => []);
  const angulo = (x: number, y: number) => {
    const a = Math.atan2((y - cal.cy) / cal.ry, (x - cal.cx) / cal.rx) / (2 * Math.PI) * S;
    return a < 0 ? a + S : a;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const z = zonaDe(x, y);
      if (z > rZona) continue;
      cajas[Math.floor(angulo(x, y)) % S * nb + Math.floor(z / dz)].push(casiFino.d[y * w + x]);
    }
  }
  const mediana = new Float32Array(S * nb).fill(NaN);
  cajas.forEach((c, k) => { if (c.length) { c.sort((a, b) => a - b); mediana[k] = c[c.length >> 1]; } });
  // Huecos (cerca del centro hay pocos puntos por caja): el valor de la caja vecina.
  for (let sct = 0; sct < S; sct++) for (let b = 1; b < nb; b++) if (isNaN(mediana[sct * nb + b])) mediana[sct * nb + b] = mediana[sct * nb + b - 1];
  for (let sct = 0; sct < S; sct++) for (let b = nb - 2; b >= 0; b--) if (isNaN(mediana[sct * nb + b])) mediana[sct * nb + b] = mediana[sct * nb + b + 1];
  // Cerca del centro un sector es muy estrecho (un agujero lo llenaría): allí se juntan sectores
  // (de 16 a 4) y, en el mismo centro, una sola mediana para toda la vuelta.
  const juntar = (n: number) => {
    const m = new Float32Array(n * nb).fill(NaN), por = S / n;
    for (let j = 0; j < n; j++) {
      for (let b = 0; b < nb; b++) {
        const v: number[] = [];
        for (let k = 0; k < por; k++) for (const x of cajas[(j * por + k) * nb + b]) v.push(x);
        if (v.length) { v.sort((p, q) => p - q); m[j * nb + b] = v[v.length >> 1]; }
      }
      for (let b = 1; b < nb; b++) if (isNaN(m[j * nb + b])) m[j * nb + b] = m[j * nb + b - 1];
      for (let b = nb - 2; b >= 0; b--) if (isNaN(m[j * nb + b])) m[j * nb + b] = m[j * nb + b + 1];
    }
    return m;
  };
  const perfiles = [{ n: 1, m: juntar(1) }, { n: 4, m: juntar(4) }, { n: S, m: mediana }];
  // A partir de qué distancia vale cada reparto: que cada sector abarque unas 8 balas.
  const zDesde = (n: number) => (8 * rAgujero * n) / (2 * Math.PI * Math.min(cal.rx, cal.ry));
  const valorEn = (p: { n: number; m: Float32Array }, x: number, y: number, b: number) => {
    if (p.n === 1) return p.m[b];
    const a = (angulo(x, y) / S) * p.n - 0.5, s0 = Math.floor(a), f = a - s0;
    return p.m[((s0 + p.n) % p.n) * nb + b] * (1 - f) + p.m[((s0 + 1) % p.n) * nb + b] * f;
  };
  const resto = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const z = zonaDe(x, y);
      if (z > rZona) continue;
      const b = Math.floor(z / dz);
      // Paso suave de un reparto al siguiente.
      let v = valorEn(perfiles[0], x, y, b);
      for (const p of perfiles.slice(1)) {
        const z0 = zDesde(p.n), k = Math.max(0, Math.min(1, (z - z0) / (0.5 * z0)));
        if (k > 0) v = v * (1 - k) + valorEn(p, x, y, b) * k;
      }
      resto[y * w + x] = casiFino.d[y * w + x] - v;
    }
  }
  // En el negro, con el catalejo, el agujero tiene partes más claras (el borde roto) y más oscuras (el
  // fondo) que el negro, que se ve gris: de media casi no cambia. Allí se suma cuánto se aparta cada
  // punto en los dos sentidos, en la ventana de una bala, menos lo que se aparta de normal (grano).
  // En el blanco el agujero es más oscuro que el papel.
  const aparta = new Float32Array(w * h), oscuro = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) { aparta[i] = Math.abs(resto[i]); oscuro[i] = -resto[i]; }
  const apartaS = desenfocar({ w, h, d: aparta }, rBala), oscuroS = desenfocar({ w, h, d: oscuro }, rBala);
  const ruidoV: number[] = [];
  for (let y = 0; y < h; y += 3) for (let x = 0; x < w; x += 3) if (zonaDe(x, y) < 0.9) ruidoV.push(apartaS.d[y * w + x]);
  ruidoV.sort((a, b) => a - b);
  const ruido = ruidoV.length ? ruidoV[ruidoV.length >> 1] : 0;
  const dif = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x, z = zonaDe(x, y);
      dif[i] = z > rZona ? 0 : z < 1 ? apartaS.d[i] - ruido : oscuroS.d[i];
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
  // Antes de buscar máximos se quitan las rayas (anillos, borde del negro): a cada punto se le resta
  // lo que sigue habiendo a los dos lados en la dirección en que más sigue. En una raya queda casi
  // nada; en un agujero (aunque esté encima de una raya) queda el agujero. Si no, una raya clara
  // junto a un agujero lo tapa al buscar el máximo.
  const sinRayas = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = dif[y * w + x];
      if (v <= 0) continue;
      let raya = 0;
      for (const [ux, uy] of dirs) raya = Math.max(raya, Math.min(difEn(x + ux * lejos, y + uy * lejos), difEn(x - ux * lejos, y - uy * lejos)));
      sinRayas[y * w + x] = v - Math.max(0, raya);
    }
  }
  // Un agujero es una mancha suelta: a poco más de su tamaño, alrededor, ya no hay nada (los textos y
  // botones de la cámara que salen en una captura, o el borde oscuro del catalejo, sí siguen).
  const ocho = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7071, 0.7071], [-0.7071, 0.7071], [0.7071, -0.7071], [-0.7071, -0.7071]];
  const aislado = (x: number, y: number, v: number) => {
    const r = Math.max(4, Math.round(rAgujero * 2.4));
    if (x < r || y < r || x >= w - r || y >= h - r) return false;
    return ocho.filter(([ux, uy]) => difEn(x + ux * r, y + uy * r) > 0.45 * v).length < 3;
  };
  const picos: { x: number; y: number; v: number }[] = [];
  for (let y = margen; y < h - margen; y++) {
    for (let x = margen; x < w - margen; x++) {
      const i = y * w + x, v = sinRayas[i];
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
          const o = sinRayas[yy * w + xx];
          // En una meseta solo cuenta el primer punto.
          if (o > v || (o === v && (dy < 0 || (dy === 0 && dx < 0)))) { maximo = false; break; }
        }
      }
      if (maximo && aislado(x, y, dif[i])) picos.push({ x, y, v });
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
