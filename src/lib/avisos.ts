import type { Arma, Datos, Licencia } from '@/data/types';
import { diasHasta, mesAnio, plazo } from './fechas';

export type Nivel = 'rojo' | 'naranja' | 'verde';
export type TipoAviso = 'licencia' | 'revista' | 'carnet' | 'pase' | 'limpieza';

export interface Aviso {
  id: string;
  tipo: TipoAviso;
  titulo: string;
  detalle: string;
  fecha?: string;
  nivel: Nivel;
  orden: number; // días restantes, para ordenar
  armaId?: string;
}

// Propuesta de plazos de aviso (no es norma): rojo a 3 meses, naranja a 6 meses.
export function nivelPorDias(dias: number): Nivel {
  if (dias <= 90) return 'rojo';
  if (dias <= 180) return 'naranja';
  return 'verde';
}

export function licenciaDe(datos: Datos, arma: Arma): Licencia | undefined {
  return datos.permiso.licencias.find((l) => l.id === arma.licenciaId);
}

/**
 * Revista de armas: las armas con guía de pertenencia pasan revista cada 5 años,
 * dentro del mes de renovación de la licencia de su titular (Ministerio del Interior).
 */
export function proximaRevista(datos: Datos, arma: Arma): string | undefined {
  return licenciaDe(datos, arma)?.caducidad;
}

export function disparosDesdeLimpieza(arma: Arma): number {
  const ultima = arma.limpiezas[0];
  return arma.disparosTotales - (ultima ? ultima.disparos : 0);
}

export function calcularAvisos(datos: Datos): Aviso[] {
  const avisos: Aviso[] = [];

  for (const l of datos.permiso.licencias) {
    const dias = diasHasta(l.caducidad);
    avisos.push({
      id: `licencia-${l.id}`,
      tipo: 'licencia',
      titulo: `Licencia ${l.tipo}`,
      detalle: plazo(l.caducidad),
      fecha: l.caducidad,
      nivel: nivelPorDias(dias),
      orden: dias,
    });
  }

  // Una revista por licencia: todas sus armas se pasan en el mismo mes.
  for (const l of datos.permiso.licencias) {
    const armas = datos.armas.filter((a) => a.licenciaId === l.id);
    if (armas.length === 0) continue;
    const dias = diasHasta(l.caducidad);
    avisos.push({
      id: `revista-${l.id}`,
      tipo: 'revista',
      titulo: armas.length === 1
        ? `Revista ${armas[0].marca} ${armas[0].modelo}`
        : `Revista de ${armas.length} armas (licencia ${l.tipo})`,
      detalle: dias < 0 ? plazo(l.caducidad) : `En ${mesAnio(l.caducidad)}`,
      fecha: l.caducidad,
      nivel: nivelPorDias(dias),
      orden: dias,
      armaId: armas.length === 1 ? armas[0].id : undefined,
    });
  }

  for (const a of datos.armas) {
    const desde = disparosDesdeLimpieza(a);
    if (desde >= a.intervaloLimpieza * 0.8) {
      const pasada = desde >= a.intervaloLimpieza;
      avisos.push({
        id: `limpieza-${a.id}`,
        tipo: 'limpieza',
        titulo: `Limpieza ${a.marca} ${a.modelo}`,
        detalle: pasada
          ? `${desde} disparos sin limpiar`
          : `Quedan ${a.intervaloLimpieza - desde} disparos`,
        nivel: pasada ? 'rojo' : 'naranja',
        orden: pasada ? 0 : 30,
        armaId: a.id,
      });
    }
  }

  const f = datos.federacion;
  const diasCarnet = diasHasta(f.caducidadCarnet);
  avisos.push({
    id: 'carnet',
    tipo: 'carnet',
    titulo: 'Carnet federativo',
    detalle: plazo(f.caducidadCarnet),
    fecha: f.caducidadCarnet,
    nivel: nivelPorDias(diasCarnet),
    orden: diasCarnet,
  });
  if (f.caducidadPase !== f.caducidadCarnet) {
    const diasPase = diasHasta(f.caducidadPase);
    avisos.push({
      id: 'pase',
      tipo: 'pase',
      titulo: 'Pase al recinto',
      detalle: plazo(f.caducidadPase),
      fecha: f.caducidadPase,
      nivel: nivelPorDias(diasPase),
      orden: diasPase,
    });
  }

  return avisos.sort((x, y) => x.orden - y.orden);
}
