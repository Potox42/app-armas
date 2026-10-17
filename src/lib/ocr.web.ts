// Lectura de texto (OCR) en el propio navegador con Tesseract.js: la imagen no sale del móvil.
// Los archivos (motor, idioma español) se publican junto a la web en /ocr (scripts/web-app.js).

interface TesseractGlobal {
  createWorker: (
    lang: string,
    oem: number,
    opciones: { workerPath: string; corePath: string; langPath: string },
  ) => Promise<{
    // Modo de lectura 6 = un bloque uniforme (mejor para tablas); 3 = automático.
    recognize: (imagen: string | HTMLCanvasElement) => Promise<{ data: { text: string } }>;
    setParameters: (p: Record<string, string>) => Promise<unknown>;
  }>;
}

const base = `${process.env.EXPO_BASE_URL ?? ''}/ocr`;
let trabajador: ReturnType<TesseractGlobal['createWorker']> | null = null;

function cargarScript(src: string): Promise<void> {
  return new Promise((ok, mal) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => ok();
    s.onerror = () => mal(new Error(`No se pudo cargar ${src}`));
    document.head.appendChild(s);
  });
}

async function obtenerTrabajador() {
  if (!trabajador) {
    trabajador = (async () => {
      const g = globalThis as unknown as { Tesseract?: TesseractGlobal };
      if (!g.Tesseract) await cargarScript(`${base}/tesseract.min.js`);
      // oem 1 = solo red neuronal LSTM, la más precisa.
      const w = await g.Tesseract!.createWorker('spa', 1, {
        workerPath: `${base}/worker.min.js`,
        corePath: base,
        langPath: base,
      });
      return w;
    })();
    trabajador.catch(() => {
      trabajador = null;
    });
  }
  return trabajador;
}

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, mal) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = mal;
    img.src = src;
  });
}

/**
 * Prepara la foto para el OCR: gris y luz igualada. Las tarjetas tienen fondos degradados
 * (amarillo a azul) que confunden al lector; dividir cada punto por la luz media de su zona
 * deja el texto negro sobre blanco en toda la tarjeta.
 */
async function preparar(dataUri: string): Promise<HTMLCanvasElement> {
  const img = await cargarImagen(dataUri);
  const W = img.width, H = img.height;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const datos = ctx.getImageData(0, 0, W, H);
  const px = datos.data;
  // Luz media de cada zona: la imagen reducida 1/24 y vuelta a ampliar (un desenfoque barato).
  const p = document.createElement('canvas');
  p.width = Math.max(1, Math.round(W / 24)); p.height = Math.max(1, Math.round(H / 24));
  p.getContext('2d')!.drawImage(img, 0, 0, p.width, p.height);
  const f = document.createElement('canvas');
  f.width = W; f.height = H;
  const fctx = f.getContext('2d', { willReadFrequently: true })!;
  fctx.imageSmoothingQuality = 'high';
  fctx.drawImage(p, 0, 0, W, H);
  const fondo = fctx.getImageData(0, 0, W, H).data;
  for (let i = 0; i < px.length; i += 4) {
    const gris = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    const luz = 0.299 * fondo[i] + 0.587 * fondo[i + 1] + 0.114 * fondo[i + 2] + 1;
    const v = Math.min(255, (gris / luz) * 255);
    // Contraste: lo que es claro respecto a su zona pasa a blanco.
    const k = Math.max(0, Math.min(255, (v - 110) * 1.9));
    px[i] = px[i + 1] = px[i + 2] = k;
  }
  ctx.putImageData(datos, 0, 0);
  return c;
}

export const ocrDisponible = true;

/**
 * Texto de la imagen leído de dos formas: con la luz igualada y en modo tabla, y tal cual en modo
 * automático. Cada una acierta en cosas distintas; quien lo usa combina las dos lecturas.
 * Lista vacía si no se pudo leer.
 */
export async function leerTextos(dataUri: string): Promise<string[]> {
  try {
    const w = await obtenerTrabajador();
    await w.setParameters({ tessedit_pageseg_mode: '6' });
    const preparada = await w.recognize(await preparar(dataUri));
    await w.setParameters({ tessedit_pageseg_mode: '3' });
    const original = await w.recognize(dataUri);
    return [preparada.data.text, original.data.text];
  } catch (e) {
    console.warn('No se pudo leer el texto de la imagen', e);
    return [];
  }
}
