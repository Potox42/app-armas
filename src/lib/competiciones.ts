import type { CategoriaCompeticion, Competicion, Datos } from '@/data/types';
import { deISO, diasHasta, hoyISO } from './fechas';

export const CATEGORIAS: CategoriaCompeticion[] = ['Preparatoria', 'Complementaria', 'Regional', 'Nacional', 'Trofeo', 'Otra'];

// Modalidades que aparecen en el calendario de precisión de la FMTO (fmto.es/calendario-precision).
export const MODALIDADES = [
  'Pistola 25 m', 'Pistola Standard', 'Pistola 50 m', 'Pistola tiro rápido 25 m', 'Pistola 9 mm y G.C.',
  'Fuego Central', 'Arma Corta .22', 'Arma Corta Fuego Central', 'Pistola Aire 10 m', 'Pistola Velocidad Aire',
  'Carabina Aire 10 m', 'Carabina 50 m', 'Arma Larga .22', 'F-Class Rimfire 50 m', 'F-Class 100 m',
  'Fusil 100 m', 'Avancarga',
];

export const competiciones = (datos: Datos) => datos.competiciones ?? [];

/** Las que aún no han pasado (de la más cercana a la más lejana) y las ya pasadas (la última primero). */
export function repartir(lista: Competicion[], hoy = hoyISO()) {
  const orden = (a: Competicion, b: Competicion) => `${a.fecha}${a.hora ?? ''}`.localeCompare(`${b.fecha}${b.hora ?? ''}`);
  return {
    proximas: lista.filter((c) => c.fecha >= hoy).sort(orden),
    pasadas: lista.filter((c) => c.fecha < hoy).sort((a, b) => orden(b, a)),
  };
}

/** Día y hora de comienzo (a las 9:00 si no se sabe la hora). */
export function comienzo(c: Competicion): Date {
  const d = deISO(c.fecha);
  const [h, m] = (c.hora ?? '09:00').split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

/** «Hoy», «Mañana», «En 5 días», «Hace 3 días». */
export function cuandoEs(fecha: string): string {
  const dias = diasHasta(fecha);
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Mañana';
  if (dias < 0) return dias === -1 ? 'Ayer' : `Hace ${-dias} días`;
  return `En ${dias} días`;
}

/** «Sáb 25 oct» */
export function fechaCorta(fecha: string): string {
  const d = deISO(fecha);
  const dia = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()];
  const mes = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][d.getMonth()];
  return `${dia} ${d.getDate()} ${mes}`;
}

/** «09:30» a partir de lo escrito («9», «930», «9:30», «9.30»); null si no es una hora válida. */
export function deHora(texto: string): string | null {
  const t = texto.trim().replace('.', ':');
  if (!t) return null;
  const m = t.match(/^(\d{1,2})(?::?(\d{2}))?$/);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2] ?? 0);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

const dosCifras = (n: number) => String(n).padStart(2, '0');
const enUtc = (d: Date) =>
  `${d.getUTCFullYear()}${dosCifras(d.getUTCMonth() + 1)}${dosCifras(d.getUTCDate())}T${dosCifras(d.getUTCHours())}${dosCifras(d.getUTCMinutes())}00Z`;
const escapar = (s: string) => s.replace(/[\;,]/g, (x) => `\\${x}`).replace(/\n/g, '\\n');

/**
 * Evento de calendario (.ics) con dos alarmas: el día antes y 2 horas antes. Al abrirlo en el
 * iPhone se añade a la app Calendario, que es quien avisa aunque la app esté cerrada.
 */
export function archivoCalendario(c: Competicion, ahora = new Date()): string {
  const inicio = comienzo(c);
  const fin = new Date(inicio.getTime() + 4 * 3600 * 1000);
  const titulo = `${c.categoria}: ${c.modalidad}`;
  const lineas = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tirador Deportivo//ES', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${c.id}@tirador-deportivo`, `DTSTAMP:${enUtc(ahora)}`,
    ...(c.hora
      ? [`DTSTART:${enUtc(inicio)}`, `DTEND:${enUtc(fin)}`]
      : [`DTSTART;VALUE=DATE:${c.fecha.replace(/-/g, '')}`]),
    `SUMMARY:${escapar(titulo)}`,
    ...(c.lugar ? [`LOCATION:${escapar(c.lugar)}`] : []),
    ...(c.notas ? [`DESCRIPTION:${escapar(c.notas)}`] : []),
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapar(`Mañana: ${titulo}`)}`, 'TRIGGER:-P1D', 'END:VALARM',
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapar(titulo)}`, `TRIGGER:${c.hora ? '-PT2H' : 'PT8H'}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return lineas.join('\r\n') + '\r\n';
}
