import type { Arma, Datos, Licencia } from '@/data/types';
import { competiciones, cuandoEs } from './competiciones';
import { diasHasta, hoyISO, mesAnio, plazo } from './fechas';
import { estadoMunicion } from './municion';

export type Nivel = 'rojo' | 'naranja' | 'verde';
export type TipoAviso = 'licencia' | 'revista' | 'carnet' | 'pase' | 'limpieza' | 'competicion' | 'municion' | 'copia' | 'actividad';

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

  // Munición: el cupo y el máximo en casa son de cada arma (la compra va con su guía).
  for (const a of datos.armas) {
    const m = estadoMunicion(a);
    const nombre = `${a.marca} ${a.modelo}`.trim();
    if (m.enCasa > m.maxDeposito) {
      avisos.push({
        id: `deposito-${a.id}`, tipo: 'municion', titulo: `Munición ${nombre}`,
        detalle: `Tienes ${m.enCasa} cartuchos en casa; el máximo es ${m.maxDeposito}`, nivel: 'rojo', orden: 0, armaId: a.id,
      });
    }
    if (m.cupo !== null && m.comprados >= m.cupo * 0.8) {
      const agotado = m.comprados >= m.cupo;
      avisos.push({
        id: `cupo-${a.id}`, tipo: 'municion', titulo: `Cupo de munición ${nombre}`,
        detalle: agotado ? `Cupo del año gastado (${m.comprados} de ${m.cupo})` : `Te quedan ${m.quedan} de ${m.cupo} este año`,
        nivel: agotado ? 'rojo' : 'naranja', orden: agotado ? 1 : 40, armaId: a.id,
      });
    }
  }

  // Competiciones a las que estás apuntado, durante las dos semanas anteriores.
  for (const c of competiciones(datos)) {
    const dias = diasHasta(c.fecha);
    if (!c.inscrito || dias < 0 || dias > 14) continue;
    avisos.push({
      id: `competicion-${c.id}`,
      tipo: 'competicion',
      titulo: `${c.categoria}: ${c.modalidad}`,
      detalle: `${cuandoEs(c.fecha)}${c.hora ? ` a las ${c.hora}` : ''}${c.lugar ? ` · ${c.lugar}` : ''}`,
      fecha: c.fecha,
      nivel: dias <= 2 ? 'naranja' : 'verde',
      orden: dias,
    });
  }

  const copia = avisoCopia(datos);
  if (copia) avisos.push(copia);
  const actividad = avisoActividad(datos);
  if (actividad) avisos.push(actividad);

  const f = datos.federacion;
  if (!f.caducidadCarnet) return avisos.sort((x, y) => x.orden - y.orden);
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
  if (f.caducidadPase && f.caducidadPase !== f.caducidadCarnet) {
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

/**
 * Copia de seguridad: los datos solo están en este móvil. Se recuerda si nunca se ha guardado una
 * copia o si la última tiene más de 30 días (más de 90: rojo). No con los datos de ejemplo.
 */
export function avisoCopia(datos: Datos, hoy = hoyISO()): Aviso | null {
  if (datos.esEjemplo !== false) return null;
  if (datos.armas.length === 0 && datos.permiso.licencias.length === 0) return null;
  const ultima = datos.ajustes?.ultimaCopia;
  const dias = ultima ? -diasHasta(ultima, hoy) : null;
  if (dias !== null && dias < 30) return null;
  return {
    id: 'copia',
    tipo: 'copia',
    titulo: 'Copia de seguridad',
    detalle: dias === null ? 'Aún no has guardado ninguna copia' : `La última es de hace ${dias} días`,
    nivel: dias !== null && dias >= 90 ? 'rojo' : 'naranja',
    orden: dias !== null && dias >= 90 ? 2 : 50,
  };
}

/**
 * Licencia F: se pierde tras un año sin actividad deportiva de tiro (art. 138 del Reglamento de
 * Armas, RD 137/1993). Se mira la última competición pasada a la que estabas apuntado: naranja a
 * los 9 meses, rojo al año. Es un recordatorio: qué tiradas valen lo certifica la federación.
 */
export function avisoActividad(datos: Datos, hoy = hoyISO()): Aviso | null {
  const f = datos.permiso.licencias.find((l) => l.tipo === 'F' && diasHasta(l.caducidad, hoy) >= 0);
  if (!f) return null;
  const pasadas = competiciones(datos).filter((c) => c.inscrito && c.fecha <= hoy);
  const ultima = pasadas.reduce<string | null>((m, c) => (!m || c.fecha > m ? c.fecha : m), null);
  const dias = ultima ? -diasHasta(ultima, hoy) : null;
  if (dias !== null && dias < 270) return null;
  const meses = dias === null ? 0 : Math.floor(dias / 30.4);
  return {
    id: 'actividad',
    tipo: 'actividad',
    titulo: 'Actividad para la licencia F',
    detalle: dias === null
      ? 'No tienes ninguna tirada apuntada en el último año'
      : `Tu última tirada fue hace ${meses} meses`,
    nivel: dias !== null && dias >= 365 ? 'rojo' : 'naranja',
    orden: dias !== null && dias >= 365 ? 1 : 60,
  };
}
