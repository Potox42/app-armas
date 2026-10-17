// En la app instalada la lectura de texto llegará con el reconocimiento del propio iPhone
// (Apple Vision), que necesita una build de desarrollo. De momento no se lee nada.

import type { Lectura } from './ocrTipos';

export const ocrDisponible = false;

export async function leerDocumento(_dataUri: string): Promise<Lectura[]> {
  return [];
}

export async function leerTextos(_dataUri: string): Promise<string[]> {
  return [];
}
