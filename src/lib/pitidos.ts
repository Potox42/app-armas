// En la app instalada aún no hay pitidos (habría que añadir expo-audio y unos sonidos): solo la voz.
export type Pitido = 'fuego' | 'alto' | 'cuenta' | 'aviso';
export function prepararPitidos() {}
export function pitar(_tipo: Pitido) {}
