/** Una palabra leída por OCR y su caja en la imagen, en píxeles. */
export interface Palabra {
  texto: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Una lectura de la imagen: el texto entero y sus palabras con su posición. */
export interface Lectura {
  texto: string;
  palabras: Palabra[];
}
