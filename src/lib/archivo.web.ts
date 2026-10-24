import * as DocumentPicker from 'expo-document-picker';

export async function compartirArchivo(nombre: string, texto: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([texto], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function elegirArchivo(): Promise<string | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: '*/*' });
  if (r.canceled || !r.assets[0]) return null;
  const a = r.assets[0];
  if (a.file) return a.file.text();
  return (await fetch(a.uri)).text();
}

/**
 * Comparte el archivo .ics con la hoja «Compartir» del iPhone (por ejemplo, Mail a uno mismo:
 * al abrir el adjunto, el iPhone ofrece «Añadir todo» al Calendario). Donde no se puede
 * compartir archivos (ordenador), se descarga. Abrir el .ics como enlace no funcionaba en la
 * app instalada en la pantalla de inicio.
 */
export async function abrirEnCalendario(nombre: string, ics: string): Promise<void> {
  try {
    const archivo = new File([ics], nombre, { type: 'text/calendar' });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.share && nav.canShare?.({ files: [archivo] })) {
      await nav.share({ files: [archivo], title: 'Añadir al calendario' });
      return;
    }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return; // cancelado por el usuario
  }
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
