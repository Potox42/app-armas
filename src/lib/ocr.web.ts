// Lectura de texto (OCR) en el propio navegador con Tesseract.js: la imagen no sale del móvil.
// Los archivos (motor, idioma español) se publican junto a la web en /ocr (scripts/web-app.js).

interface TesseractGlobal {
  createWorker: (
    lang: string,
    oem: number,
    opciones: { workerPath: string; corePath: string; langPath: string },
  ) => Promise<{ recognize: (imagen: string) => Promise<{ data: { text: string } }> }>;
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
      return g.Tesseract!.createWorker('spa', 1, {
        workerPath: `${base}/worker.min.js`,
        corePath: base,
        langPath: base,
      });
    })();
    trabajador.catch(() => {
      trabajador = null;
    });
  }
  return trabajador;
}

export const ocrDisponible = true;

/** Texto de la imagen, o null si no se pudo leer. */
export async function leerTexto(dataUri: string): Promise<string | null> {
  try {
    const w = await obtenerTrabajador();
    const r = await w.recognize(dataUri);
    return r.data.text;
  } catch (e) {
    console.warn('No se pudo leer el texto de la imagen', e);
    return null;
  }
}
