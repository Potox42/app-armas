import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Datos, Sesion } from '@/data/types';
import { crearPdfEntrenos, nombrePdf } from './pdfEntreno';

export type ResultadoPdf = 'enviado' | 'descargado' | 'cancelado' | 'otraVez';

export function prepararPdf(): Promise<unknown> {
  return import('jspdf');
}

/** Crea el PDF en la caché y abre el menú de compartir (WhatsApp, Mail, Archivos…). */
export async function enviarEntrenosPdf(datos: Datos, sesiones: Sesion[]): Promise<ResultadoPdf> {
  const { jsPDF } = await import('jspdf');
  const doc = crearPdfEntrenos(jsPDF, datos, sesiones);
  const archivo = new File(Paths.cache, nombrePdf(sesiones));
  if (archivo.exists) archivo.delete();
  archivo.create();
  archivo.write(new Uint8Array(doc.output('arraybuffer')));
  await Sharing.shareAsync(archivo.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Enviar PDF' });
  return 'enviado';
}
