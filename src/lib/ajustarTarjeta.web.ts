// Quita el fondo que queda alrededor de la tarjeta dentro del recuadro.
// Mide cuánto se aleja cada punto del color del fondo (umbral de Otsu) y busca el bloque de filas y columnas
// que son mayoritariamente «tarjeta». Si el resultado no es creíble, devuelve null.

const ANALISIS = 400; // ancho al que se reduce la foto para analizarla

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
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    // Creíble: ocupa al menos la mitad del recuadro, deja algo de fondo y tiene forma de tarjeta.
    const area = (w * h) / (W * H);
    if (area < 0.45 || area > 0.97 || w / h < 1.2 || w / h > 2) return null;

    const k = img.width / W;
    const sal = document.createElement('canvas');
    sal.width = Math.round(w * k); sal.height = Math.round(h * k);
    sal.getContext('2d')!.drawImage(img, x0 * k, y0 * k, w * k, h * k, 0, 0, sal.width, sal.height);
    return sal.toDataURL('image/jpeg', 0.9);
  } catch (e) {
    console.warn('No se pudo ajustar la tarjeta', e);
    return null;
  }
}
