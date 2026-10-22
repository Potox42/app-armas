import type { ModeloDiana } from '@/lib/diana';

export interface PropsCamaraDiana {
  activo: boolean; // si es false se sigue mirando pero no se apuntan impactos (serie completa)
  horizontal?: boolean; // móvil en horizontal: vídeo apaisado
  modelo?: ModeloDiana; // diana de la sesión (por defecto, pistola precisión 25 m)
  calibre?: number; // mm
  soloVer?: boolean; // visor del catalejo: se ve la diana pero no se buscan impactos
  alto?: number; // alto del vídeo en puntos (por defecto, 3:4 del ancho)
  onImpacto: (x: number, y: number) => void; // mm desde el centro (x a la derecha, y hacia abajo)
}
