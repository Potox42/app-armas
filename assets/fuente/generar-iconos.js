// Genera el icono, la pantalla de arranque y los iconos de Android a partir de un SVG.
// Uso: node assets/fuente/generar-iconos.js  (necesita Playwright con Chromium)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const AZUL = '#1E7BFF';

/** Diana estilo ISSF centrada en (512,512); escala 1 = radio exterior 360. */
function diana(escala = 1, mono = false) {
  const r = (v) => (v * escala).toFixed(1);
  const blanco = mono ? '#fff' : '#EEF2F8';
  const negro = mono ? 'none' : '#0F1522';
  const lineaClara = mono ? '#000' : '#9AA6B8';
  let s = `<circle cx="512" cy="512" r="${r(360)}" fill="${blanco}"/>`;
  for (const k of [300, 240]) s += `<circle cx="512" cy="512" r="${r(k)}" fill="none" stroke="${lineaClara}" stroke-width="${r(6)}"/>`;
  if (mono) {
    s += `<circle cx="512" cy="512" r="${r(180)}" fill="#000"/>`;
    for (const k of [120, 60]) s += `<circle cx="512" cy="512" r="${r(k)}" fill="none" stroke="#fff" stroke-width="${r(8)}"/>`;
    return s;
  }
  s += `<circle cx="512" cy="512" r="${r(180)}" fill="${negro}"/>`;
  for (const k of [120, 60]) s += `<circle cx="512" cy="512" r="${r(k)}" fill="none" stroke="#C9D2E0" stroke-width="${r(5)}"/>`;
  s += `<circle cx="512" cy="512" r="${r(14)}" fill="#C9D2E0"/>`;
  // Impacto marcado en azul, como en la app.
  const ix = 512 + 34 * escala, iy = 512 - 40 * escala;
  s += `<circle cx="${ix}" cy="${iy}" r="${r(40)}" fill="${AZUL}" fill-opacity="0.35"/>`;
  s += `<circle cx="${ix}" cy="${iy}" r="${r(22)}" fill="${AZUL}" stroke="#fff" stroke-width="${r(6)}"/>`;
  // Marcas de mira.
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const a = 395 * escala, b = 455 * escala;
    s += `<line x1="${512 + dx * a}" y1="${512 + dy * a}" x2="${512 + dx * b}" y2="${512 + dy * b}" stroke="${AZUL}" stroke-width="${r(18)}" stroke-linecap="round"/>`;
  }
  return s;
}

const fondo = `
  <defs>
    <radialGradient id="brillo" cx="50%" cy="42%" r="70%">
      <stop offset="0" stop-color="#1A2A47"/><stop offset="1" stop-color="#0B0F17"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#brillo)"/>`;

const svg = (contenido, transparente = true) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${transparente ? '' : ''}${contenido}</svg>`;

const salidas = {
  'icon.png': [svg(fondo + diana(0.98)), 1024],
  'splash-icon.png': [svg(diana(1.2)), 1024],
  'android-icon-foreground.png': [svg(diana(0.78)), 1024],
  'android-icon-background.png': [svg(fondo), 1024],
  'android-icon-monochrome.png': [svg(diana(0.78, true)), 1024],
  'favicon.png': [svg(fondo + diana(1.1)), 48],
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  for (const [nombre, [s, tam]] of Object.entries(salidas)) {
    await p.setViewportSize({ width: tam, height: tam });
    await p.setContent(`<html><body style="margin:0;background:transparent">${s.replace('width="1024" height="1024"', `width="${tam}" height="${tam}"`)}</body></html>`);
    await p.screenshot({ path: path.join(__dirname, '..', nombre), omitBackground: true });
    fs.writeFileSync(path.join(__dirname, nombre.replace('.png', '.svg')), s);
  }
  await b.close();
})();
