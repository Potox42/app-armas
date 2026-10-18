import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

/** Crea el PDF y abre el menú de compartir (Archivos, Mail, AirDrop, Imprimir…). */
export async function exportarPdf(html: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 }); // A4 a 72 ppp
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Guardar PDF' });
}
