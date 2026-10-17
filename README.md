# Tirador Deportivo

App personal para llevar la documentación de armas (permiso, licencias F/D/E, guías de pertenencia, revistas), el mantenimiento de cada arma y los datos de la federación. Hecha con Expo (React Native) para iPhone y Android.

- Los datos se guardan solo en el móvil, en una base de datos cifrada con SQLCipher. La clave vive en el llavero del dispositivo.
- La vista previa web usa datos de ejemplo y no guarda nada.

## Comandos

```bash
npm install
npm run typecheck      # comprobar tipos
npm run preview:web    # genera dist/preview.html (vista previa en un solo archivo)
```

El cifrado no funciona en Expo Go: para probar en el iPhone hace falta una build de desarrollo (`eas build --profile development`).
