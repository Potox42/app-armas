// Prepara dist/ para usarla como app desde la pantalla de inicio del iPhone (Safari > Compartir >
// Añadir a pantalla de inicio): icono, nombre, pantalla completa y manifiesto.
// Uso: BASE_URL=/app-armas npx expo export -p web && BASE_URL=/app-armas node scripts/web-app.js
const fs = require('fs');
const path = require('path');

const base = process.env.BASE_URL ?? '';
const dist = path.join(__dirname, '..', 'dist');
// Iconos generados desde assets/icon.png (convert icon.png -resize NxN assets/web/icono-N.png).
const iconos = path.join(__dirname, '..', 'assets', 'web');

for (const f of fs.readdirSync(iconos)) fs.copyFileSync(path.join(iconos, f), path.join(dist, f));

fs.writeFileSync(path.join(dist, 'manifest.json'), JSON.stringify({
  name: 'Tirador 360',
  short_name: 'Tirador 360',
  start_url: `${base}/`,
  scope: `${base}/`,
  display: 'standalone',
  background_color: '#03070B',
  theme_color: '#03070B',
  lang: 'es',
  icons: [192, 512].map((t) => ({ src: `${base}/icono-${t}.png`, sizes: `${t}x${t}`, type: 'image/png' })),
}, null, 2));

// Lectura de texto de documentos (src/lib/ocr.web.ts): motor y español servidos desde la propia web.
const ocr = path.join(dist, 'ocr');
fs.mkdirSync(ocr, { recursive: true });
const nm = path.join(__dirname, '..', 'node_modules');
for (const f of ['tesseract.min.js', 'worker.min.js']) fs.copyFileSync(path.join(nm, 'tesseract.js', 'dist', f), path.join(ocr, f));
for (const f of fs.readdirSync(path.join(nm, 'tesseract.js-core')).filter((x) => x.endsWith('-lstm.wasm.js'))) {
  fs.copyFileSync(path.join(nm, 'tesseract.js-core', f), path.join(ocr, f));
}
fs.copyFileSync(path.join(nm, '@tesseract.js-data', 'spa', '4.0.0_best_int', 'spa.traineddata.gz'), path.join(ocr, 'spa.traineddata.gz'));

let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
html = html.replace('<html lang="en">', '<html lang="es">');
html = html.replace(/<title>[^<]*<\/title>/, '<title>Tirador 360</title>');
html = html.replace('</head>', `  <link rel="manifest" href="${base}/manifest.json">
  <link rel="apple-touch-icon" href="${base}/icono-180.png">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Tirador 360">
  <meta name="theme-color" content="#03070B">
  <style>body { background: #03070B; }</style>
</head>`);
// Pantalla completa sin márgenes bajo la barra de estado del iPhone.
html = html.replace(/<meta name="viewport" content="([^"]*)"/, (m, c) =>
  c.includes('viewport-fit') ? m : `<meta name="viewport" content="${c}, viewport-fit=cover"`);
// Al abrir la app (o volver a ella) mira si hay una versión publicada más nueva y, si la hay,
// recarga. GitHub Pages deja la página en caché unos minutos y el iPhone no la renovaba.
const version = String(Date.now());
fs.writeFileSync(path.join(dist, 'version.json'), JSON.stringify({ version }));
html = html.replace('</body>', `<script>
(function () {
  var actual = '${version}', base = '${base}';
  function mirar() {
    fetch(base + '/version.json', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (v) {
        if (!v.version || v.version === actual) return;
        try { if (sessionStorage.getItem('recargado') === v.version) return; sessionStorage.setItem('recargado', v.version); } catch (e) {}
        return Promise.all([fetch(base + '/', { cache: 'reload' }), fetch(location.href, { cache: 'reload' })])
          .catch(function () {})
          .then(function () { location.reload(); });
      })
      .catch(function () {});
  }
  mirar();
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') mirar(); });
})();
</script>
</body>`);
fs.writeFileSync(path.join(dist, 'index.html'), html);
// GitHub Pages: cualquier ruta (por ejemplo al recargar en /cartera) abre la app.
fs.writeFileSync(path.join(dist, '404.html'), html);
fs.writeFileSync(path.join(dist, '.nojekyll'), '');
console.log('dist/ lista como app web en', base || '/');
