import type { Datos } from './types';

// En la vista previa web no se guarda nada: siempre arranca con los datos de ejemplo.

export async function cargarDatos(): Promise<Datos | null> {
  return null;
}

export async function guardarDatos(_datos: Datos): Promise<void> {}

// Fotos en memoria mientras la página está abierta.
const fotos = new Map<string, string>();

export async function guardarFoto(id: string, dataUri: string): Promise<void> {
  fotos.set(id, dataUri);
}

export async function leerFoto(id: string): Promise<string | null> {
  return fotos.get(id) ?? null;
}

export async function borrarFoto(id: string): Promise<void> {
  fotos.delete(id);
}
