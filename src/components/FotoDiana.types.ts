import type { ModeloDiana } from '@/lib/diana';

export interface PropsFotoDiana {
  modelo: ModeloDiana;
  calibre: number; // mm
  faltan: number; // disparos que quedan en la serie
  onApuntar: (puntos: { x: number; y: number }[]) => void; // mm desde el centro
}
