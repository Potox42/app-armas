// Genera el icono, la pantalla de arranque, los iconos de Android y los de la app web a partir del
// símbolo de Tirador 360 (punto de mira con flechas en círculo). Mismo dibujo que src/components/Logo.tsx.
// Uso: node assets/fuente/generar-iconos.js  (necesita Playwright con Chromium)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const AZUL = '#1E6BFF'; // inicio del degradado
const CIAN = '#22D3FF'; // final del degradado y punto central
const BLANCO = '#F4F7FA';
const FONDO = '#0B1626';

const pol = (cx, cy, r, ang) => [cx + r * Math.cos((ang * Math.PI) / 180), cy + r * Math.sin((ang * Math.PI) / 180)];
const f = (n) => n.toFixed(2);

/** Arco de a0 a a1 grados (sentido horario en pantalla si a1 > a0). */
function arco(cx, cy, r, a0, a1) {
  const [x0, y0] = pol(cx, cy, r, a0);
  const [x1, y1] = pol(cx, cy, r, a1);
  return `M${f(x0)} ${f(y0)}A${r} ${r} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} ${a1 > a0 ? 1 : 0} ${f(x1)} ${f(y1)}`;
}

/** Punta de flecha al final de un arco, con la base atravesando el anillo. */
function punta(cx, cy, r, ang, sentido, ancho, largo) {
  const a = (ang * Math.PI) / 180;
  const ux = Math.cos(a), uy = Math.sin(a);
  const [tx, ty] = sentido > 0 ? [-uy, ux] : [uy, -ux];
  const bx = cx + r * ux, by = cy + r * uy;
  const p = [[bx + (ux * ancho) / 2, by + (uy * ancho) / 2], [bx + tx * largo, by + ty * largo], [bx - (ux * ancho) / 2, by - (uy * ancho) / 2]];
  return `M${p.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')}Z`;
}

/** El símbolo en un cuadro de 200×200. mono: todo de un color (icono monocromo de Android). */
function simbolo(id, mono) {
  const R = 72, G = 22, cx = 100, cy = 100;
  const grad = mono || `url(#${id})`;
  const blanco = mono || BLANCO;
  const centro = mono || CIAN;
  let s = mono ? '' : `<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="30" y1="170" x2="170" y2="30"><stop offset="0" stop-color="${AZUL}"/><stop offset="1" stop-color="${CIAN}"/></linearGradient></defs>`;
  s += `<path d="${arco(cx, cy, R, 96, 262)}" fill="none" stroke="${grad}" stroke-width="${G}"/>`;
  s += `<path d="${punta(cx, cy, R, 262, 1, G + 18, 20)}" fill="${grad}"/>`;
  s += `<path d="${arco(cx, cy, R, 278, 352)}" fill="none" stroke="${blanco}" stroke-width="${G}"/>`;
  s += `<path d="${arco(cx, cy, R, 84, 22)}" fill="none" stroke="${grad}" stroke-width="${G}"/>`;
  s += `<path d="${punta(cx, cy, R, 22, -1, G + 18, 20)}" fill="${grad}"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="34" fill="none" stroke="${grad}" stroke-width="8"/>`;
  for (const [x1, y1, x2, y2] of [[100, 46, 100, 81], [100, 119, 100, 154], [46, 100, 81, 100], [119, 100, 154, 100]]) {
    s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${blanco}" stroke-width="8" stroke-linecap="round"/>`;
  }
  s += `<circle cx="${cx}" cy="${cy}" r="11" fill="${centro}"/>`;
  return s;
}

/** Símbolo centrado en el lienzo de 1024 ocupando `lado` px. */
const centrado = (lado, id, mono) => `<g transform="translate(${(1024 - lado) / 2} ${(1024 - lado) / 2}) scale(${lado / 200})">${simbolo(id, mono)}</g>`;
const fondo = `<rect width="1024" height="1024" fill="${FONDO}"/>`;
const svg = (contenido) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${contenido}</svg>`;

const raiz = path.join(__dirname, '..');
const conFondo = svg(fondo + centrado(800, 'a'));
const salidas = {
  'icon.png': [conFondo, 1024],
  'splash-icon.png': [svg(centrado(880, 'b')), 1024],
  'android-icon-foreground.png': [svg(centrado(620, 'c')), 1024],
  'android-icon-background.png': [svg(fondo), 1024],
  'android-icon-monochrome.png': [svg(centrado(620, 'd', '#FFFFFF')), 1024],
  'favicon.png': [conFondo, 48],
  'web/icono-180.png': [conFondo, 180],
  'web/icono-192.png': [conFondo, 192],
  'web/icono-512.png': [conFondo, 512],
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  for (const [nombre, [s, tam]] of Object.entries(salidas)) {
    await p.setViewportSize({ width: tam, height: tam });
    await p.setContent(`<html><body style="margin:0;background:transparent">${s.replace('width="1024" height="1024"', `width="${tam}" height="${tam}"`)}</body></html>`);
    await p.screenshot({ path: path.join(raiz, nombre), omitBackground: true });
    if (!nombre.startsWith('web/')) fs.writeFileSync(path.join(__dirname, path.basename(nombre).replace('.png', '.svg')), s);
  }
  await b.close();
})();
