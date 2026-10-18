import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Guarda el texto en un archivo temporal y abre el menú de compartir (Archivos, iCloud Drive, AirDrop…). */
export async function compartirArchivo(nombre: string, texto: string): Promise<void> {
  const archivo = new File(Paths.cache, nombre);
  if (archivo.exists) archivo.delete();
  archivo.create();
  archivo.write(texto);
  // Se queda en la caché (cifrada) hasta la próxima copia: el sistema puede seguir leyéndola al compartir.
  await Sharing.shareAsync(archivo.uri, { mimeType: 'application/octet-stream', dialogTitle: 'Guardar copia de seguridad' });
}

/** Abre el selector de archivos y devuelve el contenido, o null si se cancela. */
export async function elegirArchivo(): Promise<string | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (r.canceled || !r.assets[0]) return null;
  const archivo = new File(r.assets[0].uri);
  try {
    return await archivo.text();
  } finally {
    if (archivo.exists) archivo.delete();
  }
}

/** Comparte un evento .ics para añadirlo al calendario del móvil. */
export async function abrirEnCalendario(nombre: string, ics: string): Promise<void> {
  const archivo = new File(Paths.cache, nombre);
  if (archivo.exists) archivo.delete();
  archivo.create();
  archivo.write(ics);
  await Sharing.shareAsync(archivo.uri, { mimeType: 'text/calendar', UTI: 'com.apple.ical.ics', dialogTitle: 'Añadir al calendario' });
}
