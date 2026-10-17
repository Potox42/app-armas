// Quita el fondo que queda alrededor de la tarjeta dentro del recuadro, de dos formas:
// 1) por color: cuánto se aleja cada punto del color del fondo (umbral de Otsu);
// 2) por bordes: las líneas rectas más marcadas cerca de cada lado del recuadro.
// La primera falla si la tarjeta es casi del color de la mesa (guías claras sobre fondo claro);
// entonces manda la segunda. Si ninguna da algo con forma de tarjeta, devuelve null.

const ANALISIS = 400; // ancho al que se reduce la foto para analizarla
const PROPORCION = 85.6 / 53.98; // tarjeta tamaño DNI (ISO 7810 ID-1)

type Caja = { x0: number; y0: number; x1: number; y1: number };

/** Creíble: ocupa al menos la mitad del recuadro, deja algo de fondo y tiene forma de tarjeta. */
function creible(c: Caja, W: number, H: number, tolerancia: number): boolean {
  const w = c.x1 - c.x0 + 1, h = c.y1 - c.y0 + 1;
  const area = (w * h) / (W * H);
  return area >= 0.45 && area <= 0.97 && Math.abs(w / h - PROPORCION) <= tolerancia;
}

/**
 * Bordes de la tarjeta: en cada franja exterior del recuadro, la línea con más cambio de color.
 * Se mira solo la parte central de cada lado para que no cuenten las esquinas redondeadas,
 * y, de fuera hacia dentro, se toma la primera línea fuerte (las rayas de dentro de la tarjeta van después).
 */
function porBordes(px: Uint8ClampedArray, W: number, H: number): Caja {
  const dif = (a: number, b: number) =>
    Math.abs(px[a] - px[b]) + Math.abs(px[a + 1] - px[b + 1]) + Math.abs(px[a + 2] - px[b + 2]);
  const filas = new Array<number>(H).fill(0), cols = new Array<number>(W).fill(0);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = (y * W + x) * 4;
      if (x > W * 0.15 && x < W * 0.85) filas[y] += dif(i + W * 4, i - W * 4);
      if (y > H * 0.15 && y < H * 0.85) cols[x] += dif(i + 4, i - 4);
    }
  }
  const borde = (perfil: number[], desde: number, hasta: number) => {
    const paso = desde < hasta ? 1 : -1;
    let max = 0;
    for (let i = desde; i !== hasta; i += paso) max = Math.max(max, perfil[i]);
    for (let i = desde; i !== hasta; i += paso) {
      if (perfil[i] < 0.6 * max) continue;
      // El pico de esa línea (el borde puede ocupar dos o tres píxeles).
      let mejor = i;
      for (let j = i; j !== i + 4 * paso && j !== hasta; j += paso) if (perfil[j] > perfil[mejor]) mejor = j;
      return mejor;
    }
    return desde;
  };
  return {
    x0: borde(cols, 1, Math.round(W * 0.3)),
    x1: borde(cols, W - 2, Math.round(W * 0.7)),
    y0: borde(filas, 1, Math.round(H * 0.35)),
    y1: borde(filas, H - 2, Math.round(H * 0.65)),
  };
}

function cargar(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, mal) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = mal;
    img.src = src;
  });
}

function otsu(hist: number[], total: number): number {
  let suma = 0;
  for (let i = 0; i < 256; i++) suma += i * hist[i];
  let sumaB = 0, pesoB = 0, mejor = 0, umbral = 128;
  for (let i = 0; i < 256; i++) {
    pesoB += hist[i];
    if (!pesoB) continue;
    const pesoF = total - pesoB;
    if (!pesoF) break;
    sumaB += i * hist[i];
    const mB = sumaB / pesoB, mF = (suma - sumaB) / pesoF;
    const v = pesoB * pesoF * (mB - mF) ** 2;
    if (v > mejor) { mejor = v; umbral = i; }
  }
  return umbral;
}

/** Tramo continuo más largo de valores por encima de `min`. */
function tramo(perfil: number[], min: number): [number, number] {
  let ini = 0, mejorIni = 0, mejorFin = -1;
  for (let i = 0; i <= perfil.length; i++) {
    if (i < perfil.length && perfil[i] >= min) continue;
    if (i - 1 - ini > mejorFin - mejorIni) { mejorIni = ini; mejorFin = i - 1; }
    ini = i + 1;
  }
  return [mejorIni, mejorFin];
}

export async function ajustarTarjeta(dataUri: string): Promise<string | null> {
  try {
    const img = await cargar(dataUri);
    const W = ANALISIS, H = Math.round((img.height / img.width) * ANALISIS);
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, W, H);
    const px = ctx.getImageData(0, 0, W, H).data;
    // Color del fondo: la mediana de los píxeles del borde del recuadro.
    const borde: number[][] = [];
    for (let x = 0; x < W; x++) for (const y of [0, H - 1]) borde.push([...px.subarray((y * W + x) * 4, (y * W + x) * 4 + 3)]);
    for (let y = 0; y < H; y++) for (const x of [0, W - 1]) borde.push([...px.subarray((y * W + x) * 4, (y * W + x) * 4 + 3)]);
    const fondo = [0, 1, 2].map((c) => borde.map((p) => p[c]).sort((a, b) => a - b)[borde.length >> 1]);
    // Cuánto se aleja cada píxel del fondo (en color, no solo en luz: la parte azul también es tarjeta).
    const dist = new Uint8Array(W * H);
    const hist = new Array<number>(256).fill(0);
    for (let i = 0; i < W * H; i++) {
      const d = Math.min(255, Math.round(Math.hypot(px[i * 4] - fondo[0], px[i * 4 + 1] - fondo[1], px[i * 4 + 2] - fondo[2]) / 1.7));
      dist[i] = d;
      hist[d]++;
    }
    const u = Math.max(otsu(hist, W * H), 20);
    const esTarjeta = (d: number) => d > u;

    const cols = new Array<number>(W).fill(0), filas = new Array<number>(H).fill(0);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (esTarjeta(dist[y * W + x])) { cols[x]++; filas[y]++; }
    }
    const [x0, x1] = tramo(cols.map((n) => n / H), 0.5);
    const [y0, y1] = tramo(filas.map((n) => n / W), 0.5);
    const color = { x0, x1, y0, y1 };
    const bordes = porBordes(px, W, H);
    // Por color es lo más fiable cuando la tarjeta destaca; si su forma no cuadra, se prueba por bordes.
    const caja = creible(color, W, H, 0.25) ? color : creible(bordes, W, H, 0.15) ? bordes : null;
    if (!caja) return null;
    const w = caja.x1 - caja.x0 + 1, h = caja.y1 - caja.y0 + 1;

    const k = img.width / W;
    const sal = document.createElement('canvas');
    sal.width = Math.round(w * k); sal.height = Math.round(h * k);
    sal.getContext('2d')!.drawImage(img, caja.x0 * k, caja.y0 * k, w * k, h * k, 0, 0, sal.width, sal.height);
    return sal.toDataURL('image/jpeg', 0.9);
  } catch (e) {
    console.warn('No se pudo ajustar la tarjeta', e);
    return null;
  }
}
