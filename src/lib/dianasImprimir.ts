import { DIANAS, type IdDiana, type ModeloDiana } from './diana';
import { ESTILO } from './informe';

// Dianas para imprimir en A4, en milímetros reales (las mismas medidas ISSF que lib/diana.ts).
// - «Tamaño real»: la diana mide lo mismo que la oficial. Si no cabe en el folio, sale solo el centro.
// - «Reducida»: para entrenar a menos distancia que la oficial, la diana se reduce en la misma
//   proporción (a 10 m, una diana de 25 m sale al 40 %): se ve del mismo tamaño que en la galería.
// Cada hoja lleva una barra de 10 cm para comprobar que la impresora no ha cambiado la escala.

/** Distancia oficial de cada diana (m). */
export const DISTANCIA_OFICIAL: Record<IdDiana, number> = { precision: 25, rapido: 25, airePistola: 10, aireCarabina: 10 };

/** Hueco útil del A4 con márgenes de 14 mm (los del informe). */
const ANCHO_UTIL = 180;
const ALTO_UTIL = 210; // deja sitio para el título y la barra de 10 cm

export interface OpcionesDiana {
  id: IdDiana;
  distancia: number; // a la que vas a tirar (m)
  copias: number;
}

export interface Plan {
  modelo: ModeloDiana;
  escala: number; // 1 = tamaño real
  diametro: number; // diámetro impreso de la diana completa (mm)
  recortada: boolean; // no cabe entera en el folio
  texto: string;
}

const diametroExterior = (m: ModeloDiana) => Math.max(...Object.values(m.anillos));
const coma = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

export function planDiana({ id, distancia }: OpcionesDiana): Plan {
  const modelo = DIANAS[id];
  const oficial = DISTANCIA_OFICIAL[id];
  const escala = distancia > 0 && distancia < oficial ? distancia / oficial : 1;
  const diametro = diametroExterior(modelo) * escala;
  const recortada = diametro > Math.min(ANCHO_UTIL, ALTO_UTIL);
  const tam = escala === 1 ? 'a tamaño real' : `reducida al ${Math.round(escala * 100)} % para tirar a ${coma(distancia)} m`;
  const texto = `${modelo.nombre}, ${tam}.` + (recortada ? ' No cabe entera en un A4: sale solo la parte central.' : '');
  return { modelo, escala, diametro, recortada, texto };
}

/** SVG de una diana (medidas en mm) recortada al hueco del folio. */
function svgDiana(p: Plan): string {
  const { modelo, escala } = p;
  const lado = Math.min(p.diametro, ANCHO_UTIL, ALTO_UTIL);
  const r = lado / 2;
  const negro = (modelo.negro * escala) / 2;
  const grosor = Math.max(0.25, 0.5 * escala);
  const anillos = Object.entries(modelo.anillos)
    .map(([v, d]) => ({ valor: Number(v), radio: (d * escala) / 2 }))
    .sort((a, b) => b.radio - a.radio);
  const partes: string[] = [];
  partes.push(`<circle cx="0" cy="0" r="${negro}" fill="#111"/>`);
  for (const a of anillos) {
    const enNegro = a.radio <= negro + 0.01;
    partes.push(`<circle cx="0" cy="0" r="${a.radio}" fill="none" stroke="${enNegro ? '#fff' : '#111'}" stroke-width="${grosor}"/>`);
  }
  if (modelo.diezInterior > 0) {
    partes.push(`<circle cx="0" cy="0" r="${(modelo.diezInterior * escala) / 2}" fill="none" stroke="#fff" stroke-width="${grosor * 0.7}"/>`);
  }
  // Números de los anillos (del 1 al 8) a izquierda, derecha, arriba y abajo, en mitad de cada anillo.
  const paso = ((modelo.anillos[8] ?? 0) - (modelo.anillos[9] ?? 0)) * escala / 2;
  const letra = Math.max(2.2, paso * 0.45);
  for (const a of anillos) {
    if (a.valor < 1 || a.valor > 8) continue;
    const medio = a.radio - paso / 2;
    if (medio <= 0 || medio > r - letra) continue;
    const color = a.radio <= negro + 0.01 ? '#fff' : '#111';
    for (const [x, y] of [[-medio, 0], [medio, 0], [0, -medio], [0, medio]]) {
      partes.push(`<text x="${x}" y="${y}" font-size="${letra}" fill="${color}" text-anchor="middle" dominant-baseline="central" font-family="Arial,Helvetica,sans-serif">${a.valor}</text>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}mm" height="${lado}mm" viewBox="${-r} ${-r} ${lado} ${lado}" style="display:block;margin:0 auto">` +
    `<rect x="${-r}" y="${-r}" width="${lado}" height="${lado}" fill="#fff"/>${partes.join('')}</svg>`;
}

/** Barra de 10 cm con marcas cada centímetro, para comprobar la escala al imprimir. */
function barra(): string {
  const marcas = Array.from({ length: 11 }, (_, i) =>
    `<line x1="${i * 10}" y1="${i % 5 === 0 ? 0 : 2}" x2="${i * 10}" y2="6" stroke="#111" stroke-width="0.3"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="102mm" height="8mm" viewBox="-1 -1 102 8" style="display:block;margin:4mm auto 1mm">` +
    `${marcas}<line x1="0" y1="6" x2="100" y2="6" stroke="#111" stroke-width="0.5"/></svg>` +
    '<div class="sub" style="text-align:center">Esta barra debe medir exactamente 10 cm. Si no, imprime al 100 % (sin «Ajustar a la página»).</div>';
}

/** HTML con una hoja por copia, listo para lib/imprimir (exportarPdf). */
export function htmlDianas(o: OpcionesDiana): string {
  const p = planDiana(o);
  const copias = Math.max(1, Math.min(10, Math.round(o.copias)));
  const hoja = (i: number) =>
    `<section style="page-break-after:${i < copias - 1 ? 'always' : 'auto'}">` +
    `<header><div class="marca">Tirador Deportivo</div><h1>${p.modelo.nombre}</h1><div class="sub">${p.texto}</div></header>` +
    `${svgDiana(p)}${barra()}</section>`;
  return `<html><head><meta charset="utf-8"><style>${ESTILO}</style></head><body><div class="informe">${Array.from({ length: copias }, (_, i) => hoja(i)).join('')}</div></body></html>`;
}
