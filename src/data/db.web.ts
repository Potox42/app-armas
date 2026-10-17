import type { Datos } from './types';

// En la vista previa web no se guarda nada: siempre arranca con los datos de ejemplo.

export async function cargarDatos(): Promise<Datos | null> {
  return null;
}

export async function guardarDatos(_datos: Datos): Promise<void> {}
