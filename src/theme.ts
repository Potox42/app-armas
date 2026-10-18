import { Appearance } from 'react-native';
import { leerPreferenciaTema } from './lib/tema';

// Estilo «cabina nocturna»: azul marino casi negro, tarjetas con degradado y brillo azul
// (inspirado en el prototipo Tirador Pro 3.6 de Rubén).
const oscuro = {
  bg: '#03070B',
  bgTop: '#07121E', // parte alta de la pantalla, donde está el brillo
  card: '#0E1D2C',
  cardTop: '#13263A', // degradado de las tarjetas: arriba a la izquierda…
  cardBottom: '#08131E', // …abajo a la derecha
  cardAlt: '#152A40',
  border: '#24405A',
  borderSoft: 'rgba(117,173,225,0.16)',
  text: '#F7FBFF',
  textMuted: '#8CA0B6',
  kicker: '#7BC3FF', // rótulos pequeños en mayúsculas
  accent: '#3A8EF0',
  accentLight: '#58B0FF', // degradado de los botones principales
  accentDark: '#2266D9',
  accentSoft: '#12345A',
  green: '#49DF91',
  greenSoft: '#173923',
  red: '#FF7080',
  redSoft: '#3B1920',
  orange: '#FFC66D',
  orangeSoft: '#3C2B0D',
  purple: '#B7A7FF',
  purpleSoft: '#2F2853',
  // Piezas con color propio
  brilloFondo: '#2668B8',
  brilloCard: '#4E9DFF',
  heroDesde: '#183149',
  heroHasta: '#07101A',
  heroBrillo: '#5BB3FF',
  heroBorde: 'rgba(117,173,225,0.34)',
  iconoFondo: '#163A60',
  iconoColor: '#A7D9FF',
  cifraFondo: 'rgba(5,13,22,0.55)',
  barraPestanas: 'rgba(4,10,16,0.96)',
  dianaFondo: '#1B2733',
  sombra: 0.35,
};

// Modo claro: más sereno, papel blanco y azul sobrio, para leer a pleno sol en el campo.
const claro: typeof oscuro = {
  bg: '#F2F5F9',
  bgTop: '#E6EDF6',
  card: '#FFFFFF',
  cardTop: '#FFFFFF',
  cardBottom: '#F6F8FB',
  cardAlt: '#E9EEF5',
  border: '#D2DBE6',
  borderSoft: 'rgba(29,79,145,0.10)',
  text: '#0F1B28',
  textMuted: '#56677A',
  kicker: '#2563A8',
  accent: '#2A72D2',
  accentLight: '#4A8FE6',
  accentDark: '#1F5CB3',
  accentSoft: '#DCE9FA',
  green: '#16834D',
  greenSoft: '#DDF2E5',
  red: '#C42F3C',
  redSoft: '#FBE2E4',
  orange: '#A86200',
  orangeSoft: '#FBEBD2',
  purple: '#5845C4',
  purpleSoft: '#E7E2FA',
  brilloFondo: '#FFFFFF',
  brilloCard: '#FFFFFF',
  heroDesde: '#FFFFFF',
  heroHasta: '#E7EEF7',
  heroBrillo: '#BFD8F5',
  heroBorde: '#D2DBE6',
  iconoFondo: '#E3EDFA',
  iconoColor: '#2A72D2',
  cifraFondo: 'rgba(233,238,245,0.8)',
  barraPestanas: 'rgba(255,255,255,0.97)',
  dianaFondo: '#E3E8EF',
  sombra: 0.08,
};

const preferencia = leerPreferenciaTema();
export const temaClaro = preferencia === 'claro' || (preferencia === 'auto' && Appearance.getColorScheme() === 'light');

export const colors = temaClaro ? claro : oscuro;

export const radius = { sm: 10, md: 14, lg: 22, xl: 30 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
