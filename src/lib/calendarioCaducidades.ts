import type { Datos } from '@/data/types';
import { formatear, hoyISO, sumarDias } from './fechas';

const escapar = (s: string) => s.replace(/[\;,]/g, (x) => `\\${x}`).replace(/\n/g, '\\n');
const sinGuiones = (iso: string) => iso.replace(/-/g, '');

interface Caducidad {
  id: string;
  nombre: string; // «la licencia F»
  fecha: string; // ISO
  nota?: string;
}

/** Documentos con fecha de caducidad: licencias (con su revista de armas), carnet federativo y pase. */
export function caducidades(datos: Datos): Caducidad[] {
  const lista: Caducidad[] = [];
  for (const l of datos.permiso.licencias) {
    if (!l.caducidad) continue;
    const armas = datos.armas.filter((a) => a.licenciaId === l.id).length;
    lista.push({
      id: `licencia-${l.id}`,
      nombre: `la licencia ${l.tipo}`,
      fecha: l.caducidad,
      nota: armas
        ? `Al renovarla pasas la revista de ${armas === 1 ? 'tu arma' : `tus ${armas} armas`} en la Intervención de Armas.`
        : undefined,
    });
  }
  const f = datos.federacion;
  if (f.caducidadCarnet) lista.push({ id: 'carnet', nombre: 'el carnet federativo', fecha: f.caducidadCarnet });
  if (f.caducidadPase && f.caducidadPase !== f.caducidadCarnet) lista.push({ id: 'pase', nombre: 'el pase del recinto', fecha: f.caducidadPase });
  return lista;
}

// Recordatorios: 3 meses antes, 1 mes antes y el mismo día (los mismos plazos que los avisos de la app).
const ANTES = [
  { dias: 90, texto: (n: string, f: string) => `Renovar ${n}: caduca el ${f}` },
  { dias: 30, texto: (n: string, f: string) => `Queda un mes: ${n} caduca el ${f}` },
  { dias: 0, texto: (n: string) => `Hoy caduca ${n}` },
];

/**
 * Calendario (.ics) con un evento de día completo por recordatorio, cada uno con alarma a las
 * 10:00. Al abrirlo en el iPhone se añaden a la app Calendario, que avisa aunque la app esté cerrada.
 * Solo se incluyen los recordatorios que aún no han pasado.
 */
export function calendarioCaducidades(datos: Datos, hoy = hoyISO(), ahora = new Date()): { ics: string; eventos: number } {
  const stamp = ahora.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const eventos: string[][] = [];
  for (const c of caducidades(datos)) {
    for (const r of ANTES) {
      const dia = sumarDias(c.fecha, -r.dias);
      if (dia < hoy) continue;
      eventos.push([
        'BEGIN:VEVENT',
        `UID:${c.id}-${sinGuiones(c.fecha)}-${r.dias}@tirador-deportivo`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${sinGuiones(dia)}`,
        `DTEND;VALUE=DATE:${sinGuiones(sumarDias(dia, 1))}`,
        `SUMMARY:${escapar(r.texto(c.nombre, formatear(c.fecha)))}`,
        ...(c.nota ? [`DESCRIPTION:${escapar(c.nota)}`] : []),
        'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapar(r.texto(c.nombre, formatear(c.fecha)))}`, 'TRIGGER:PT10H', 'END:VALARM',
        'END:VEVENT',
      ]);
    }
  }
  const lineas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tirador Deportivo//ES', 'CALSCALE:GREGORIAN', ...eventos.flat(), 'END:VCALENDAR'];
  return { ics: lineas.join('\r\n') + '\r\n', eventos: eventos.length };
}
