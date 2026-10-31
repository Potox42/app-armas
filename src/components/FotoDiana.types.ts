import type { Disparo } from '@/data/types';
import type { ModeloDiana } from '@/lib/diana';

export interface PropsFotoDiana {
  modelo: ModeloDiana;
  calibre: number; // mm
  faltan: number; // disparos que quedan en la serie
  anteriores?: Disparo[]; // disparos ya apuntados en esta diana: se pintan en rojo sobre la foto
  onApuntar: (puntos: { x: number; y: number }[]) => void; // mm desde el centro
}
