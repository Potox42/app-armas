import { useEffect, useMemo } from 'react';
import { useStore } from '@/data/store';
import { programarAvisos, quitarAvisos } from '@/lib/notificaciones';
import { planAvisos } from '@/lib/planAvisos';

/** Mantiene los avisos del móvil al día con las fechas guardadas. */
export function AvisosProgramados() {
  const { datos, ajustes, esEjemplo } = useStore();
  // Con los datos de ejemplo no se programa nada.
  const plan = useMemo(() => (ajustes.avisos && !esEjemplo ? planAvisos(datos) : []), [datos, ajustes.avisos, esEjemplo]);
  // Solo se reprograma cuando cambia el plan, no con cada disparo registrado.
  const clave = JSON.stringify(plan);

  useEffect(() => {
    const tarea = ajustes.avisos ? programarAvisos(JSON.parse(clave, (k, v) => (k === 'fecha' ? new Date(v) : v))) : quitarAvisos();
    tarea.catch((e) => console.error('No se pudieron programar los avisos', e));
  }, [clave, ajustes.avisos]);

  return null;
}
