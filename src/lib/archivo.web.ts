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

/** Abre un evento .ics: Safari en el iPhone ofrece «Añadir al calendario». */
export async function abrirEnCalendario(_nombre: string, ics: string): Promise<void> {
  const a = document.createElement('a');
  a.href = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
  a.target = '_blank';
  a.rel = 'noopener';
  a.click();
}
