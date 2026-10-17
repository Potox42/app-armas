// Junta el export web (dist/) en un único HTML autocontenido para la vista previa.
// Uso: npm run preview:web  ->  dist/preview.html
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'dist');
let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

html = html.replace(/<link rel="icon"[^>]*>/, '');
html = html.replace('<html lang="en">', '<html lang="es">');
html = html.replace(
  '</style>',
  '  body { background: #0B0F17; }\n    </style>',
);

// Expo Router lee la ruta del navegador: en la vista previa siempre arrancamos en Inicio.
const reset = "<script>try{history.replaceState(null,'','/')}catch(e){}</script>";

html = html.replace(/<script src="([^"]+)" defer><\/script>/g, (_, src) => {
  const code = fs.readFileSync(path.join(dist, src), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script>${code}</script>`;
});
html = html.replace('<div id="root"></div>', `<div id="root"></div>\n  ${reset}`);

fs.writeFileSync(path.join(dist, 'preview.html'), html);
console.log(`dist/preview.html (${Math.round(html.length / 1024)} KB)`);
