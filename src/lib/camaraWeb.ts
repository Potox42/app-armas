// En el móvil la cámara nativa ya hace las fotos a resolución completa.
export async function subirResolucion() {}

// En la app instalada la linterna la enciende la propia cámara (propiedad enableTorch).
export const hayLinterna = () => true;
export async function linterna(encender: boolean): Promise<boolean> {
  return encender;
}
