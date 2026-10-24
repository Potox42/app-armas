import type { Datos } from '@/data/types';
import { disparosDesdeLimpieza, licenciaDe } from './avisos';
import { historial, textoResultado } from './competiciones';
import { formatear, hoyISO, sumarDias } from './fechas';
import { estadoMunicion } from './municion';
import { dianasDe, formatoMedia, media, todosLosDisparos, totalSesion } from './sesiones';

export interface OpcionesInforme {
  papeles: boolean; // licencias, armas, munición y otros papeles
  deportivo: boolean; // competiciones y entrenamientos
  desde: string | null; // ISO; null = todo
  ocultarNumeros: boolean; // NIF, nº de guía, nº de identificación y pólizas
}

const esc = (s: string | number | undefined | null) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const f = (iso?: string) => (iso ? formatear(iso) : '—');

/** «12345678Z» → «••••••78Z». */
export function ocultar(t: string | undefined, visibles = 3): string {
  if (!t) return '—';
  return t.length <= visibles ? t : `${'•'.repeat(Math.min(6, t.length - visibles))}${t.slice(-visibles)}`;
}

/** Hace 12 meses, para el informe del último año. */
export const haceUnAnio = (hoy = hoyISO()) => sumarDias(hoy, -365);

const tabla = (cabecera: string[], filas: (string | number)[][], vacio: string) =>
  filas.length === 0
    ? `<p class="vacio">${esc(vacio)}</p>`
    : `<table><thead><tr>${cabecera.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${filas
      .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
      .join('')}</tbody></table>`;

/** Informe en HTML (para imprimir o guardar como PDF) con los papeles, el inventario y el historial. */
export function informeHtml(datos: Datos, o: OpcionesInforme, hoy = hoyISO()): string {
  const num = (t?: string) => (o.ocultarNumeros ? ocultar(t) : t || '—');
  const partes: string[] = [];

  if (o.papeles) {
    const p = datos.permiso;
    partes.push('<h2>Licencias</h2>');
    partes.push(`<p>NIF: ${esc(num(p.numero))}</p>`);
    partes.push(tabla(
      ['Tipo', 'Clase', 'Válida desde', 'Válida hasta'],
      [...p.licencias].sort((a, b) => 'EFD'.indexOf(a.tipo) - 'EFD'.indexOf(b.tipo))
        .map((l) => [l.tipo, l.categoria ? `${l.categoria}ª` : '—', f(l.expedicion), f(l.caducidad)]),
      'Sin licencias.',
    ));
    const fe = datos.federacion;
    if (fe.numeroFederado || fe.caducidadCarnet) {
      partes.push(`<p>${esc(fe.nombre)} · federado nº ${esc(fe.numeroFederado || '—')} · carnet válido hasta ${esc(f(fe.caducidadCarnet))}</p>`);
    }
    const docs = datos.documentos ?? [];
    if (docs.length) {
      partes.push('<h2>Otros papeles</h2>');
      partes.push(tabla(['Documento', 'Número', 'Válido hasta'], docs.map((d) => [d.nombre, num(d.numero), f(d.caducidad)]), ''));
    }

    partes.push('<h2>Armas</h2>');
    partes.push(tabla(
      ['Arma', 'Tipo', 'Calibre', 'Nº de guía', 'Fecha guía', 'Nº identificación', 'Licencia'],
      datos.armas.map((a) => [
        `${a.marca} ${a.modelo}`, a.tipo, a.calibre, num(a.numeroGuia), f(a.fechaGuia), num(a.numeroSerie), licenciaDe(datos, a)?.tipo ?? '—',
      ]),
      'Sin armas.',
    ));
    if (datos.armas.length) {
      partes.push('<h3>Uso y munición</h3>');
      partes.push(tabla(
        ['Arma', 'Disparos', 'Última limpieza', 'Sin limpiar', `Compradas ${hoy.slice(0, 4)}`, 'En casa'],
        datos.armas.map((a) => {
          const m = estadoMunicion(a, hoy);
          return [
            `${a.marca} ${a.modelo}`, a.disparosTotales.toLocaleString('es-ES'), f(a.limpiezas[0]?.fecha), disparosDesdeLimpieza(a),
            m.cupo === null ? `${m.comprados}` : `${m.comprados} de ${m.cupo}`, `${m.enCasa} de ${m.maxDeposito}`,
          ];
        }),
        '',
      ));
    }
  }

  if (o.deportivo) {
    const desde = o.desde ?? '0000';
    const comps = historial(datos, hoy).filter((c) => c.fecha >= desde);
    partes.push('<h2>Competiciones</h2>');
    partes.push(tabla(
      ['Fecha', 'Tipo', 'Modalidad', 'Lugar', 'Resultado'],
      comps.map((c) => [f(c.fecha), c.categoria, c.modalidad, c.lugar ?? '', textoResultado(c) || '—']),
      'Sin competiciones en este periodo.',
    ));
    const ses = datos.sesiones.filter((s) => s.terminada && s.fecha.slice(0, 10) >= desde && todosLosDisparos(s).length);
    const disparos = ses.flatMap(todosLosDisparos);
    partes.push('<h2>Entrenamientos</h2>');
    if (ses.length) {
      partes.push(`<p>${ses.length} entrenamientos · ${disparos.length.toLocaleString('es-ES')} disparos · media ${formatoMedia(media(disparos))} por disparo</p>`);
    }
    partes.push(tabla(
      ['Fecha', 'Arma', 'Modalidad', 'Distancia', 'Dianas', 'Disparos', 'Puntos', 'Media'],
      ses.map((s) => {
        const a = datos.armas.find((x) => x.id === s.armaId);
        const d = todosLosDisparos(s);
        return [f(s.fecha.slice(0, 10)), a ? `${a.marca} ${a.modelo}` : '—', s.modalidad, `${s.distancia} m`, dianasDe(s).length, d.length, `${totalSesion(s)} / ${d.length * 10}`, formatoMedia(media(d))];
      }),
      'Sin entrenamientos en este periodo.',
    ));
  }

  const periodo = o.deportivo ? (o.desde ? ` · historial desde el ${f(o.desde)}` : ' · todo el historial') : '';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Tirador 360 · ${esc(datos.nombre)}</title>
<style>${ESTILO}</style></head><body><div class="informe">
<header><div class="marca">Tirador 360</div><h1>${esc(datos.nombre || 'Mi informe')}</h1>
<p class="sub">Generado el ${esc(f(hoy))}${esc(periodo)}. Datos apuntados por el titular en la app; no es un documento oficial.</p></header>
${partes.join('\n')}
</div></body></html>`;
}

// Mismo estilo en el PDF del móvil y al imprimir desde la web (todo dentro de .informe).
export const ESTILO = `
.informe { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #111; font-size: 11px; line-height: 1.4; }
.informe header { border-bottom: 2px solid #1d4f91; padding-bottom: 8px; margin-bottom: 12px; }
.informe .marca { color: #1d4f91; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; font-size: 10px; }
.informe h1 { font-size: 20px; margin: 2px 0; }
.informe h2 { font-size: 14px; margin: 18px 0 6px; color: #1d4f91; }
.informe h3 { font-size: 12px; margin: 12px 0 4px; }
.informe .sub, .informe .vacio { color: #555; }
.informe table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
.informe tr { page-break-inside: avoid; }
.informe th { text-align: left; background: #eef3fa; font-weight: 700; }
.informe th, .informe td { border-bottom: 1px solid #d5dbe3; padding: 4px 6px; vertical-align: top; }
@page { margin: 14mm; }
`;
