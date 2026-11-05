import type { jsPDF as JsPDF } from 'jspdf';
import type { Arma, Datos, Disparo, Sesion } from '@/data/types';
import { conclusion } from './conclusion';
import { geometria, type ModeloDiana } from './diana';
import { formatear } from './fechas';
import { anilloDondeCabe, correccion, desplazado, medidas, MIN_IMPACTOS, textoCorreccion } from './grupo';
import { diaDe, horaDe, nombreDia } from './historial';
import { agrupacion, conPosicion, dianasDe, formatoMedia, media, sumaSerie, todosLosDisparos, totalSesion } from './sesiones';

// PDF de uno o varios entrenamientos para mandarlo (WhatsApp, correo…): la diana con los impactos,
// las series disparo a disparo, las cifras, la conclusión y las medidas del grupo. Se dibuja con jsPDF
// (A4, en mm) para que salga un archivo .pdf de verdad que el iPhone pueda compartir.

type Rgb = [number, number, number];
const AZUL: Rgb = [29, 79, 145];
const TEXTO: Rgb = [17, 17, 17];
const GRIS: Rgb = [95, 102, 112];
const LINEA: Rgb = [213, 219, 227];
const FONDO: Rgb = [238, 243, 250];
const VERDE: Rgb = [26, 140, 78];
const NARANJA: Rgb = [214, 98, 12];
const PAPEL: Rgb = [237, 230, 214];
const NEGRO: Rgb = [21, 21, 21];
const IMPACTO: Rgb = [214, 40, 57];

const ANCHO = 210;
const ALTO = 297;
const MARGEN = 14;
const UTIL = ANCHO - 2 * MARGEN;

/** Las letras normales del PDF (Helvetica) solo tienen el alfabeto latino: se cambian los símbolos que no caben. */
export function limpiar(t: string): string {
  return t
    .replace(/≈/g, 'aprox. ').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/[→⇒]/g, '->').replace(/←/g, '<-')
    .replace(/[↔↕✓✔🏆]/gu, '')
    .replace(/[^\u0000-ÿ€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/gu, '')
    .replace(/ {2,}/g, ' ');
}

const nombreArma = (a?: Arma) => (a ? `${a.marca} ${a.modelo}`.trim() : 'Arma borrada');

/** Nombre del archivo: «entreno-2026-10-31.pdf» o «entrenos-2026-09-01-a-2026-10-31.pdf». */
export function nombrePdf(sesiones: Sesion[]): string {
  const dias = sesiones.map((s) => diaDe(s.fecha)).sort();
  if (dias.length === 0) return 'entrenos.pdf';
  if (sesiones.length === 1) return `entreno-${dias[0]}.pdf`;
  return dias[0] === dias[dias.length - 1] ? `entrenos-${dias[0]}.pdf` : `entrenos-${dias[0]}-a-${dias[dias.length - 1]}.pdf`;
}

/**
 * Crea el PDF. `JsPDF` es la clase de la librería (se pasa desde fuera para cargarla solo al usarla).
 * Con varios entrenos, la primera página es una tabla resumen y luego va cada entreno en su página.
 */
export function crearPdfEntrenos(JsPDF: new (o: object) => JsPDF, datos: Datos, lista: Sesion[]): JsPDF {
  const sesiones = [...lista].filter((s) => todosLosDisparos(s).length > 0).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const doc = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const p = new Pagina(doc, datos.nombre);
  doc.setProperties({ title: limpiar(`Tirador 360 · ${sesiones.length === 1 ? 'Entreno' : 'Entrenos'}${datos.nombre ? ` · ${datos.nombre}` : ''}`), creator: 'Tirador 360' });
  p.cabecera();

  if (sesiones.length > 1) {
    resumen(p, datos, sesiones);
    for (const s of sesiones) {
      p.nueva();
      ficha(p, datos, s);
    }
  } else if (sesiones[0]) {
    ficha(p, datos, sesiones[0]);
  } else {
    p.texto('No hay disparos que mandar.', { color: GRIS });
  }
  p.pies();
  return doc;
}

// ---------- Páginas ----------

/** Lleva la posición en la página y salta a otra cuando no cabe. */
class Pagina {
  y = MARGEN;
  constructor(readonly doc: JsPDF, readonly tirador: string) {}

  cabecera() {
    const d = this.doc;
    d.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...AZUL);
    d.setCharSpace(0.6).text('TIRADOR 360', MARGEN, MARGEN + 3).setCharSpace(0);
    if (this.tirador) {
      d.setFont('helvetica', 'normal').setTextColor(...GRIS).text(limpiar(this.tirador), ANCHO - MARGEN, MARGEN + 3, { align: 'right' });
    }
    d.setDrawColor(...AZUL).setLineWidth(0.5).line(MARGEN, MARGEN + 5.5, ANCHO - MARGEN, MARGEN + 5.5);
    this.y = MARGEN + 11;
  }

  nueva() {
    this.doc.addPage();
    this.cabecera();
  }

  /** Salta de página si no caben `alto` mm más. */
  sitio(alto: number) {
    if (this.y + alto > ALTO - MARGEN - 6) this.nueva();
  }

  texto(t: string, o: { size?: number; bold?: boolean; color?: Rgb; x?: number; ancho?: number; despues?: number } = {}) {
    const size = o.size ?? 10;
    const x = o.x ?? MARGEN;
    const d = this.doc.setFont('helvetica', o.bold ? 'bold' : 'normal').setFontSize(size).setTextColor(...(o.color ?? TEXTO));
    const lineas: string[] = d.splitTextToSize(limpiar(t), o.ancho ?? ANCHO - MARGEN - x);
    const alto = size * 0.3528 * 1.3; // pt → mm, con interlineado
    for (const l of lineas) {
      this.sitio(alto);
      d.text(l, x, this.y + size * 0.3528);
      this.y += alto;
    }
    this.y += o.despues ?? 1;
  }

  titulo(t: string) {
    this.sitio(14);
    this.y += 3;
    this.texto(t, { size: 13, bold: true, color: AZUL, despues: 1.5 });
  }

  pies() {
    const d = this.doc;
    const n = d.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      d.setPage(i);
      d.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...GRIS);
      d.text(limpiar('Datos apuntados por el tirador en la app Tirador 360.'), MARGEN, ALTO - 8);
      d.text(`Página ${i} de ${n}`, ANCHO - MARGEN, ALTO - 8, { align: 'right' });
    }
  }
}

/** Tabla con un entreno por fila (para cuando se mandan varios). */
function resumen(p: Pagina, datos: Datos, sesiones: Sesion[]) {
  const todos = sesiones.flatMap(todosLosDisparos);
  const dias = sesiones.map((s) => diaDe(s.fecha)).sort();
  const armas = [...new Set(sesiones.map((s) => s.armaId))].map((id) => nombreArma(datos.armas.find((a) => a.id === id)));
  p.texto(sesiones.length === 1 ? 'Entrenamiento' : `${sesiones.length} entrenamientos`, { size: 20, bold: true, despues: 1 });
  p.texto(`Del ${formatear(dias[0])} al ${formatear(dias[dias.length - 1])} · ${armas.join(', ')}`, { color: GRIS, despues: 1 });
  p.texto(`${todos.length.toLocaleString('es-ES')} disparos · media ${formatoMedia(media(todos))} por disparo`, { color: GRIS, despues: 4 });

  const cols = [
    { t: 'Fecha', w: 34 }, { t: 'Arma', w: 44 }, { t: 'Distancia', w: 18 }, { t: 'Dianas', w: 14 }, { t: 'Disparos', w: 16 },
    { t: 'Puntos', w: 24 }, { t: 'Media', w: 14 }, { t: 'Grupo', w: 18 },
  ];
  const fila = (valores: string[], cabecera: boolean) => {
    p.sitio(6.5);
    const d = p.doc;
    if (cabecera) d.setFillColor(...FONDO).rect(MARGEN, p.y, UTIL, 6.5, 'F');
    d.setFont('helvetica', cabecera ? 'bold' : 'normal').setFontSize(8.5).setTextColor(...TEXTO);
    let x = MARGEN + 1.5;
    valores.forEach((v, i) => {
      const t: string = d.splitTextToSize(limpiar(v), cols[i].w - 2)[0] ?? '';
      d.text(t, x, p.y + 4.4);
      x += cols[i].w;
    });
    p.y += 6.5;
    d.setDrawColor(...LINEA).setLineWidth(0.2).line(MARGEN, p.y, ANCHO - MARGEN, p.y);
  };
  fila(cols.map((c) => c.t), true);
  for (const s of sesiones) {
    const d = todosLosDisparos(s);
    const g = conPosicion(d).length >= MIN_IMPACTOS ? `${Math.round(agrupacion(d).radio)} mm` : '-';
    const hora = horaDe(s.fecha);
    fila([
      `${formatear(diaDe(s.fecha))}${hora ? ` ${hora}` : ''}`, nombreArma(datos.armas.find((a) => a.id === s.armaId)), `${s.distancia} m`,
      String(dianasDe(s).length), String(d.length), `${totalSesion(s)} de ${d.length * 10}`, formatoMedia(media(d)), g,
    ], false);
  }
  p.y += 3;
  p.texto('Grupo: distancia media de cada impacto al centro de los impactos (solo si se marcaron en la diana).', { size: 8, color: GRIS });
}

/** Un entreno: cifras, dianas, series, conclusión y medidas del grupo. */
function ficha(p: Pagina, datos: Datos, s: Sesion) {
  const arma = datos.armas.find((a) => a.id === s.armaId);
  const disparos = todosLosDisparos(s);
  const conSitio = conPosicion(disparos);
  const dianas = dianasDe(s);
  const { diana: modelo, calibre } = geometria(s);
  const hora = horaDe(s.fecha);
  const series = s.series.filter((x) => x.disparos.length);

  const dia = diaDe(s.fecha);
  const fecha = /\d{4}$/.test(nombreDia(dia)) ? nombreDia(dia) : `${nombreDia(dia)} de ${dia.slice(0, 4)}`; // siempre con el año
  p.texto(`${fecha}${hora ? ` · ${hora}` : ''}`, { size: 18, bold: true, despues: 0.5 });
  p.texto(
    [nombreArma(arma), s.modalidad, `${s.distancia} m`, s.municion.trim(), s.competicion ? 'Competición' : 'Entreno'].filter(Boolean).join(' · '),
    { color: GRIS, despues: 4 },
  );

  // Cifras principales en cajas.
  const dieces = disparos.filter((d) => d.valor === 10).length;
  const g = agrupacion(disparos);
  const cajas = [
    { t: 'Puntos', v: String(totalSesion(s)), d: `de ${disparos.length * 10}` },
    { t: 'Media', v: formatoMedia(media(disparos)), d: 'por disparo' },
    { t: 'Dieces', v: String(dieces), d: `de ${disparos.length}` },
    conSitio.length >= MIN_IMPACTOS
      ? { t: 'Agrupación', v: `${Math.round(g.radio)} mm`, d: 'radio medio' }
      : { t: dianas.length > 1 ? 'Dianas' : 'Series', v: String(dianas.length > 1 ? dianas.length : series.length), d: `${disparos.length} disparos` },
  ];
  p.sitio(20);
  const anchoCaja = (UTIL - 3 * 3) / 4;
  cajas.forEach((c, i) => {
    const x = MARGEN + i * (anchoCaja + 3);
    const d = p.doc;
    d.setFillColor(...FONDO).roundedRect(x, p.y, anchoCaja, 18, 2, 2, 'F');
    d.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...GRIS).text(c.t, x + 3, p.y + 4.5);
    d.setFont('helvetica', 'bold').setFontSize(16).setTextColor(...(i === 1 ? VERDE : TEXTO)).text(c.v, x + 3, p.y + 11.5);
    d.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...GRIS).text(c.d, x + 3, p.y + 15.5);
  });
  p.y += 22;

  // Dianas con los impactos (si se marcaron en la diana) y, al lado o debajo, las series.
  if (conSitio.length > 0) {
    if (dianas.length <= 1) {
      p.sitio(86);
      const lado = 82;
      const top = p.y;
      dibujarDiana(p.doc, MARGEN, top, lado, modelo, calibre, disparos, true);
      const xs = MARGEN + lado + 6;
      p.y = top;
      tablaSeries(p, series.map((x, i) => ({ nombre: `Serie ${i + 1}`, disparos: x.disparos })), xs);
      p.y = Math.max(p.y, top + lado) + 2;
      p.texto('Rojo: impactos. Cruz y círculo azules: centro de los impactos y distancia media a ese centro.', { size: 7.5, color: GRIS });
    } else {
      p.titulo('Dianas');
      const porFila = 3;
      const hueco = 4;
      const lado = (UTIL - hueco * (porFila - 1)) / porFila;
      for (let i = 0; i < dianas.length; i += porFila) {
        p.sitio(lado + 11);
        const top = p.y;
        dianas.slice(i, i + porFila).forEach((dn, j) => {
          const x = MARGEN + j * (lado + hueco);
          dibujarDiana(p.doc, x, top, lado, modelo, calibre, dn.disparos, true);
          const puntos = dn.disparos.reduce((t, d) => t + d.valor, 0);
          p.doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...TEXTO)
            .text(`Diana ${i + j + 1}`, x + lado / 2, top + lado + 4.5, { align: 'center' });
          p.doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...GRIS)
            .text(`${puntos} puntos · media ${formatoMedia(media(dn.disparos))}`, x + lado / 2, top + lado + 8.5, { align: 'center' });
        });
        p.y = top + lado + 12;
      }
      p.texto('Rojo: impactos. Cruz y círculo azules: centro de los impactos y distancia media a ese centro.', { size: 7.5, color: GRIS });
    }
  }
  if (conSitio.length === 0 || dianas.length > 1) {
    p.titulo('Series');
    const lineas = dianas.length > 1
      ? dianas.flatMap((dn, i) => dn.series.map((x, j) => ({ nombre: `D${i + 1} · Serie ${j + 1}`, disparos: x.disparos })))
      : series.map((x, i) => ({ nombre: `Serie ${i + 1}`, disparos: x.disparos }));
    tablaSeries(p, lineas, MARGEN);
  }

  // Reparto de puntos.
  const reparto = [10, 9, 8, 7, 6].map((v) => `${v}: ${disparos.filter((d) => d.valor === v).length}`);
  const resto = disparos.filter((d) => d.valor < 6).length;
  p.y += 2;
  p.texto(`Reparto: ${[...reparto, `menos de 6: ${resto}`].join('   ·   ')}`, { size: 9, color: GRIS, despues: 1 });
  if (series.length > 1 && new Set(series.map(sumaSerie)).size > 1) {
    const sumas = series.map(sumaSerie);
    const mejor = sumas.indexOf(Math.max(...sumas));
    const peor = sumas.indexOf(Math.min(...sumas));
    p.texto(`Mejor serie: la ${mejor + 1}.ª (${sumas[mejor]}) · Peor serie: la ${peor + 1}.ª (${sumas[peor]}) · Diferencia: ${sumas[mejor] - sumas[peor]} puntos`, { size: 9, color: GRIS });
  }

  conclusionPdf(p, s, arma, datos);
  medidasPdf(p, s, arma, disparos, modelo, calibre);
}

/** Series en filas: nombre, los disparos uno a uno y la suma. */
function tablaSeries(p: Pagina, lineas: { nombre: string; disparos: Disparo[] }[], x: number) {
  const d = p.doc;
  const ancho = ANCHO - MARGEN - x;
  const wNombre = lineas.some((l) => l.nombre.length > 9) ? 26 : 17;
  const wSuma = 16;
  const wValores = ancho - wNombre - wSuma;
  const celda = 5.6;
  const porLinea = Math.max(5, Math.floor(wValores / celda));
  d.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...GRIS);
  p.sitio(6);
  d.text('Disparos', x + wNombre, p.y + 3);
  d.text('Puntos', x + ancho - 1, p.y + 3, { align: 'right' });
  p.y += 4.5;
  for (const l of lineas) {
    const filas = Math.max(1, Math.ceil(l.disparos.length / porLinea));
    const alto = filas * 5 + 1.5;
    p.sitio(alto);
    d.setDrawColor(...LINEA).setLineWidth(0.2).line(x, p.y, x + ancho, p.y);
    d.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(...TEXTO).text(l.nombre, x, p.y + 4.3);
    d.setFont('helvetica', 'normal').setFontSize(9);
    l.disparos.forEach((dp, i) => {
      const fx = x + wNombre + (i % porLinea) * celda;
      const fy = p.y + 4.3 + Math.floor(i / porLinea) * 5;
      d.setTextColor(...(dp.valor === 10 ? VERDE : dp.valor < 8 ? NARANJA : TEXTO));
      d.setFont('helvetica', dp.valor === 10 ? 'bold' : 'normal').text(String(dp.valor), fx, fy);
    });
    const suma = sumaSerie({ disparos: l.disparos });
    d.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(...TEXTO)
      .text(`${suma}`, x + ancho - 1, p.y + 4.3, { align: 'right' });
    p.y += alto;
  }
  d.setDrawColor(...LINEA).line(x, p.y, x + ancho, p.y);
  p.y += 2;
}

function conclusionPdf(p: Pagina, s: Sesion, arma: Arma | undefined, datos: Datos) {
  const c = conclusion(s, arma, datos.mano);
  if (!c.bien.length && !c.mejorar.length) return;
  p.titulo('Conclusión');
  if (c.bien.length) {
    p.sitio(12); // que el título no se quede solo al final de la página
    p.texto('Lo que haces bien', { bold: true, color: VERDE, despues: 0.5 });
    for (const t of c.bien) p.texto(`•  ${t}`, { x: MARGEN + 2, despues: 0.5 });
    p.y += 2;
  }
  if (c.mejorar.length) {
    p.sitio(22);
    p.texto('Lo que tienes que corregir', { bold: true, color: NARANJA, despues: 0.5 });
    c.mejorar.forEach((m, i) => {
      p.sitio(18);
      p.texto(`${i + 1}.  ${m.que}${i === 0 && c.mejorar.length > 1 ? '  (empieza por aquí)' : ''}`, { bold: true, x: MARGEN + 2, despues: 0.3 });
      p.texto(`Por qué pasa: ${m.porque}`, { x: MARGEN + 7, color: GRIS, size: 9.5, despues: 0.3 });
      p.texto(`Qué hacer: ${m.hacer}`, { x: MARGEN + 7, size: 9.5, despues: 1.5 });
    });
    p.texto('Son las causas más habituales; el entrenador puede confirmarlas viendo tirar.', { size: 8, color: GRIS });
  } else if (!c.sinPosicion) {
    p.texto('Nada que corregir: repite la misma rutina en el próximo entreno.', { color: VERDE });
  }
  if (c.sinPosicion) {
    p.texto('Los disparos se apuntaron con números: sin los impactos marcados en la diana solo se analizan los puntos.', { size: 8.5, color: GRIS });
  }
}

function medidasPdf(p: Pagina, s: Sesion, arma: Arma | undefined, disparos: Disparo[], modelo: ModeloDiana, calibre: number) {
  const m = medidas(disparos);
  if (!m || m.n < MIN_IMPACTOS) return;
  p.titulo('Medidas del grupo');
  const anillo = anilloDondeCabe(m.cep50 * 2 + calibre, modelo);
  p.texto(`La mitad de los disparos cabe en un círculo de ${Math.round(m.cep50 * 2)} mm${anillo ? ` (como el ${anillo})` : ''} · CEP50.`, { size: 9.5, despues: 0.5 });
  p.texto(`Separación máxima entre dos impactos: ${Math.round(m.dispersion)} mm · Ancho: ${Math.round(m.ancho)} mm · Alto: ${Math.round(m.alto)} mm.`, { size: 9.5, despues: 0.5 });
  if (desplazado(m, modelo)) {
    const c = correccion(m.cx, m.cy, s.distancia, arma?.clic);
    const mover = [
      Math.abs(m.cx) >= 2 ? textoCorreccion(c.horizontal, 'h', arma?.clic) : '',
      Math.abs(m.cy) >= 2 ? textoCorreccion(c.vertical, 'v', arma?.clic) : '',
    ].filter(Boolean);
    if (mover.length) {
      p.texto(`Para centrar el grupo, mover los impactos: ${mover.join(' y ')}.`, { size: 9.5, bold: true, despues: 0.5 });
      p.texto('Solo si se repite en varios entrenos: un día suelto puede ser casualidad.', { size: 8.5, color: GRIS });
    }
  } else {
    p.texto(`Grupo centrado: el centro de los impactos está a ${Math.round(Math.hypot(m.cx, m.cy))} mm del centro de la diana.`, { size: 9.5 });
  }
}

/** Diana ISSF a escala con los impactos, en un cuadrado de `lado` mm con la esquina en (x, y). */
function dibujarDiana(d: JsPDF, x: number, y: number, lado: number, modelo: ModeloDiana, calibre: number, todos: Disparo[], conGrupo: boolean) {
  const disparos = conPosicion(todos);
  const r = modelo.visible / 2;
  const k = lado / modelo.visible; // mm de papel por mm de diana
  const cx = x + lado / 2;
  const cy = y + lado / 2;
  const u = lado / 82; // grosores y letras proporcionales al tamaño
  d.setFillColor(...PAPEL).circle(cx, cy, r * k, 'F');
  d.setFillColor(...NEGRO).circle(cx, cy, (modelo.negro / 2) * k, 'F');
  const anillos = Object.entries(modelo.anillos)
    .map(([v, diam]) => ({ valor: Number(v), radio: diam / 2 }))
    .filter((a) => a.radio <= r + 0.5);
  const paso = (modelo.anillos[8] - modelo.anillos[9]) / 2;
  for (const a of anillos) {
    const enNegro = a.radio * 2 <= modelo.negro;
    d.setDrawColor(...(enNegro ? PAPEL : NEGRO)).setLineWidth(0.18 * u).circle(cx, cy, a.radio * k, 'S');
  }
  if (modelo.diezInterior > 0) d.setDrawColor(...PAPEL).setLineWidth(0.12 * u).circle(cx, cy, (modelo.diezInterior / 2) * k, 'S');
  d.setFont('helvetica', 'bold').setFontSize(Math.max(4, 6.5 * u));
  for (const a of anillos) {
    if (a.valor < 1 || a.valor > 8) continue;
    const pos = (a.radio - paso / 2) * k;
    d.setTextColor(...(a.radio * 2 <= modelo.negro ? PAPEL : NEGRO));
    for (const sx of [-1, 1]) d.text(String(a.valor), cx + sx * pos, cy + 0.8 * u, { align: 'center' });
  }
  const bala = Math.max(0.6, (calibre / 2) * k);
  d.setFillColor(...IMPACTO).setDrawColor(255, 255, 255).setLineWidth(0.12 * u);
  for (const p of disparos) {
    if (Math.hypot(p.x, p.y) > r) continue; // fuera de lo que se ve
    d.circle(cx + p.x * k, cy + p.y * k, bala, 'FD');
  }
  if (conGrupo && disparos.length >= MIN_IMPACTOS) {
    const g = agrupacion(disparos);
    const gx = cx + g.cx * k, gy = cy + g.cy * k, b = 2.2 * u;
    d.setDrawColor(58, 142, 240).setLineWidth(0.35 * u);
    d.setLineDashPattern([1.2 * u, 0.9 * u], 0).circle(gx, gy, g.radio * k, 'S').setLineDashPattern([], 0);
    d.setLineWidth(0.5 * u).line(gx - b, gy, gx + b, gy).line(gx, gy - b, gx, gy + b);
  }
}
