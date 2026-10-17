import type { Datos } from '@/data/types';
import { deISO, formatear } from './fechas';

export interface AvisoProgramado {
  id: string;
  fecha: Date;
  titulo: string;
  cuerpo: string;
}

// Antelación de cada recordatorio, en días. iOS admite como mucho 64 avisos programados por app.
const ANTELACION = [90, 30, 7, 0];
const MAXIMO = 60;
const HORA = 10;

function cuando(dias: number): string {
  if (dias === 0) return 'hoy';
  if (dias === 7) return 'en una semana';
  if (dias === 30) return 'en un mes';
  return 'en 3 meses';
}

/** Recordatorios con fecha (licencias, revistas, carnet y pase), ordenados y sin los ya pasados. */
export function planAvisos(datos: Datos, ahora = new Date()): AvisoProgramado[] {
  const plan: AvisoProgramado[] = [];
  const anadir = (id: string, iso: string, titulo: string, texto: (c: string) => string) => {
    if (!iso) return;
    for (const dias of ANTELACION) {
      const fecha = deISO(iso);
      fecha.setDate(fecha.getDate() - dias);
      fecha.setHours(HORA, 0, 0, 0);
      if (fecha <= ahora) continue;
      plan.push({ id: `${id}-${dias}`, fecha, titulo, cuerpo: texto(cuando(dias)) });
    }
  };

  for (const l of datos.permiso.licencias) {
    const armas = datos.armas.filter((a) => a.licenciaId === l.id);
    const revista = armas.length === 0 ? ''
      : armas.length === 1 ? ` y pasa revista de la ${armas[0].marca} ${armas[0].modelo}`
      : ` y pasa revista de tus ${armas.length} armas`;
    anadir(`licencia-${l.id}`, l.caducidad, `Licencia ${l.tipo}`,
      (c) => `Caduca ${c} (${formatear(l.caducidad)}). Renuévala${revista}.`);
  }

  const f = datos.federacion;
  anadir('carnet', f.caducidadCarnet, 'Carnet federativo',
    (c) => `Caduca ${c} (${formatear(f.caducidadCarnet)}).`);
  if (f.caducidadPase !== f.caducidadCarnet) {
    anadir('pase', f.caducidadPase, 'Pase al recinto', (c) => `Caduca ${c} (${formatear(f.caducidadPase)}).`);
  }

  return plan.sort((a, b) => a.fecha.getTime() - b.fecha.getTime()).slice(0, MAXIMO);
}
