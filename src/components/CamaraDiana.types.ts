export interface PropsCamaraDiana {
  activo: boolean; // si es false se sigue mirando pero no se apuntan impactos (serie completa)
  onImpacto: (x: number, y: number) => void; // mm desde el centro (x a la derecha, y hacia abajo)
}
