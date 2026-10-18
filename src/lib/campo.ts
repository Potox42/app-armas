import type { Arma, ListaCampo } from '@/data/types';

/** Cosas habituales para un día de tiro. Es una ayuda para no olvidar nada, no una lista oficial. */
export const LISTA_BASE = [
  'Licencia de armas',
  'DNI',
  'Carnet federativo y pase del recinto',
  'Munición',
  'Cargadores',
  'Protección auditiva',
  'Gafas de tiro',
  'Catalejo',
  'Kit de limpieza',
  'Agua',
];

/** La lista completa: la guía y el arma de cada una que llevas, lo de siempre y lo que hayas añadido tú. */
export function cosasQueLlevar(armas: Arma[], lista?: ListaCampo): string[] {
  const porArma = armas.flatMap((a) => {
    const nombre = `${a.marca} ${a.modelo}`.trim();
    return [`${nombre} en su maletín`, `Guía de ${nombre}`];
  });
  return [...porArma, ...LISTA_BASE, ...(lista?.propios ?? [])];
}
