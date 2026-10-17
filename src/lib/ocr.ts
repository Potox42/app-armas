// En la app instalada la lectura de texto llegará con el reconocimiento del propio iPhone
// (Apple Vision), que necesita una build de desarrollo. De momento no se lee nada.

export const ocrDisponible = false;

export async function leerTexto(_dataUri: string): Promise<string | null> {
  return null;
}
