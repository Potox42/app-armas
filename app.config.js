// Ajustes que dependen del entorno. El resto está en app.json.
// BASE_URL: ruta donde se publica la versión web (GitHub Pages usa /app-armas).
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    ...(process.env.BASE_URL ? { baseUrl: process.env.BASE_URL } : {}),
  },
});
