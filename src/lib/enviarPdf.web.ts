import type { Datos, Sesion } from '@/data/types';
import { crearPdfEntrenos, nombrePdf } from './pdfEntreno';

// En el navegador (iPhone): se crea el .pdf y se abre la hoja «Compartir» del sistema (WhatsApp, Mail,
// Guardar en Archivos…). Donde no se pueden compartir archivos (ordenador), se descarga.
//
// Safari solo deja abrir «Compartir» justo después del toque: la librería se carga antes (prepararPdf)
// y el PDF se hace sin esperas. Si aun así el iPhone no lo deja, se devuelve 'otraVez' y basta con
// tocar de nuevo: el archivo ya está hecho.

type Libreria = typeof import('jspdf');
let libreria: Libreria | null = null;
let cargando: Promise<Libreria> | null = null;
let pendiente: { clave: string; archivo: File } | null = null;

export type ResultadoPdf = 'enviado' | 'descargado' | 'cancelado' | 'otraVez';

export function prepararPdf(): Promise<unknown> {
  cargando ??= import('jspdf').then((m) => (libreria = m));
  return cargando;
}

const claveDe = (sesiones: Sesion[]) => sesiones.map((s) => `${s.id}:${s.series.length}`).join(',');

export async function enviarEntrenosPdf(datos: Datos, sesiones: Sesion[]): Promise<ResultadoPdf> {
  const clave = claveDe(sesiones);
  let archivo = pendiente?.clave === clave ? pendiente.archivo : null;
  if (!archivo) {
    const lib = libreria ?? (await prepararPdf(), libreria!);
    const doc = crearPdfEntrenos(lib.jsPDF, datos, sesiones);
    archivo = new File([doc.output('blob')], nombrePdf(sesiones), { type: 'application/pdf' });
  }
  pendiente = null;
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [archivo] })) {
    try {
      await nav.share({ files: [archivo] });
      return 'enviado';
    } catch (e) {
      const nombre = e instanceof Error ? e.name : '';
      if (nombre === 'AbortError') return 'cancelado';
      if (nombre === 'NotAllowedError') {
        pendiente = { clave, archivo };
        return 'otraVez';
      }
      throw e;
    }
  }
  const url = URL.createObjectURL(archivo);
  const a = document.createElement('a');
  a.href = url;
  a.download = archivo.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return 'descargado';
}
