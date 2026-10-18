import { useEffect, useRef } from 'react';
import { useStore } from '@/data/store';
import { huella, subirCopia } from '@/lib/nube';

const ESPERA_MS = 20_000; // tras un cambio, se espera un poco por si llegan más (una serie entera)

/** Si la copia automática está activada, sube una copia cifrada a tu servidor cuando cambian los datos. */
export function CopiaAutomatica() {
  const { datos, ajustes, esEjemplo, guardarAjustes } = useStore();
  const subida = useRef<string | null>(null); // huella de lo último que se subió en esta sesión
  const nube = ajustes.nube;
  const actual = huella(datos);

  useEffect(() => {
    if (!nube?.url || !nube.clave || !nube.contrasena || esEjemplo) return;
    if (subida.current === actual) return;
    // Al abrir la app no se sube otra vez si la última copia es de hace menos de un día y no hubo cambios.
    if (subida.current === null && nube.ultima && Date.now() - Date.parse(nube.ultima) < 86_400_000 && nube.huella === actual) {
      subida.current = actual;
      return;
    }
    const t = setTimeout(() => {
      subirCopia(datos, nube)
        .then((ultima) => {
          subida.current = actual;
          guardarAjustes({ nube: { ...nube, ultima, huella: actual, error: undefined }, ultimaCopia: ultima.slice(0, 10) });
        })
        .catch((e: Error) => {
          console.error('Copia automática', e);
          guardarAjustes({ nube: { ...nube, error: e.message } });
        });
    }, ESPERA_MS);
    return () => clearTimeout(t);
    // Solo cuando cambian los datos o la configuración del servidor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actual, nube?.url, nube?.clave, nube?.contrasena, esEjemplo]);

  return null;
}
