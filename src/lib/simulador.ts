// Simulador de tirada: secuencia de órdenes y luces de las pruebas de pistola a 25 m.
// Fuente: Reglamento técnico de pistola ISSF (borrador 01/01/2023, reglas 8.7.6.4 y 8.7.6.5):
// - Tras «LOAD» hay 1 minuto para prepararse.
// - Standard: series de 5 disparos en 150, 20 o 10 s; empiezan con «ATTENTION» y la luz roja.
// - Tiro rápido: tras «ATTENTION», luz roja 7 s; luego 5 apariciones de 3 s con 7 s entre ellas.
// - Precisión: series de 5 disparos en 5 minutos.
// - Tras «UNLOAD», 1 minuto de pausa antes de la siguiente serie.
// El reglamento no dice cuánto dura la luz roja en standard: se usan los mismos 7 s que en tiro rápido.

export type Luz = 'nada' | 'roja' | 'verde';
export type Idioma = 'es' | 'en';

export interface Paso {
  inicio: number; // ms desde el comienzo
  fin: number;
  luz: Luz;
  rotulo: string; // lo que se ve en pantalla
  orden?: { es: string; en: string }; // lo que se dice al empezar el paso
  saltable?: boolean; // preparación y pausas: se pueden acortar con «Listo»
}

export interface Programa {
  id: string;
  nombre: string;
  detalle: string;
  series: number;
  tipo: 'continuo' | 'rapido';
  segundos: number; // tiempo de la serie (continuo) o de cada aparición (rápido)
}

export const PROGRAMAS: Programa[] = [
  { id: 'std150', nombre: 'Standard 150 s', detalle: '5 disparos en 150 segundos', series: 4, tipo: 'continuo', segundos: 150 },
  { id: 'std20', nombre: 'Standard 20 s', detalle: '5 disparos en 20 segundos', series: 4, tipo: 'continuo', segundos: 20 },
  { id: 'std10', nombre: 'Standard 10 s', detalle: '5 disparos en 10 segundos', series: 4, tipo: 'continuo', segundos: 10 },
  { id: 'rapido', nombre: 'Tiro rápido (duelo)', detalle: '5 apariciones de 3 s, con 7 s entre ellas', series: 6, tipo: 'rapido', segundos: 3 },
  { id: 'precision', nombre: 'Precisión 5 min', detalle: '5 disparos en 5 minutos', series: 6, tipo: 'continuo', segundos: 300 },
];

const PREPARACION = 60_000;
const ROJA = 7_000;
const PAUSA = 60_000;

const O = {
  cargar: (n: number) => ({ es: n === 1 ? 'Primera serie. Carguen.' : 'Siguiente serie. Carguen.', en: n === 1 ? 'For the first series. Load.' : 'For the next series. Load.' }),
  atencion: { es: 'Atención.', en: 'Attention.' },
  fuego: { es: 'Fuego.', en: 'Start.' },
  alto: { es: 'Alto.', en: 'Stop.' },
  descargar: { es: 'Descarguen.', en: 'Unload.' },
  fin: { es: 'Fin de la tirada.', en: 'End of the match.' },
};

/** Todos los pasos de la tirada, uno detrás de otro. */
export function plan(p: Programa, series = p.series): Paso[] {
  const pasos: Paso[] = [];
  let t = 0;
  const poner = (dur: number, luz: Luz, rotulo: string, orden?: Paso['orden'], saltable?: boolean) => {
    pasos.push({ inicio: t, fin: t + dur, luz, rotulo, orden, saltable });
    t += dur;
  };
  for (let n = 1; n <= series; n++) {
    poner(PREPARACION, 'nada', `Serie ${n} de ${series}: carga y prepárate`, O.cargar(n), true);
    if (p.tipo === 'continuo') {
      // En precisión no hay luz roja previa: se da la salida directamente.
      if (p.id === 'precision') {
        poner(p.segundos * 1000, 'verde', `Serie ${n}: dispara`, O.fuego);
      } else {
        poner(ROJA, 'roja', 'Atención', O.atencion);
        poner(p.segundos * 1000, 'verde', `Serie ${n}: dispara`);
      }
    } else {
      poner(ROJA, 'roja', 'Atención', O.atencion);
      for (let k = 1; k <= 5; k++) {
        poner(p.segundos * 1000, 'verde', `Disparo ${k} de 5`);
        if (k < 5) poner(ROJA, 'roja', 'Brazo abajo');
      }
    }
    if (n < series) poner(PAUSA, 'nada', 'Descarga. Pausa hasta la siguiente serie', { es: `${O.alto.es} ${O.descargar.es}`, en: `${O.alto.en} ${O.descargar.en}` }, true);
    else poner(1, 'nada', 'Tirada terminada', { es: `${O.alto.es} ${O.descargar.es} ${O.fin.es}`, en: `${O.alto.en} ${O.descargar.en} ${O.fin.en}` });
  }
  return pasos;
}

/** El paso que toca en el instante t (ms); null al terminar. */
export function pasoEn(pasos: Paso[], t: number): number | null {
  const i = pasos.findIndex((p) => t >= p.inicio && t < p.fin);
  return i >= 0 ? i : null;
}
