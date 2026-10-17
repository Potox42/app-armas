import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { hoyISO } from '@/lib/fechas';
import { cargarDatos, guardarDatos } from './db';
import { datosDeEjemplo } from './ejemplo';
import type { Arma, Datos, Limpieza } from './types';

// Los datos se cargan de la base de datos cifrada al arrancar y se guardan en cada cambio.
// Mientras no existan las pantallas de alta, el primer arranque parte del ejemplo.

interface Store {
  datos: Datos;
  arma: (id: string) => Arma | undefined;
  registrarLimpieza: (armaId: string, tipo: Limpieza['tipo'], nota?: string) => void;
  sumarDisparos: (armaId: string, disparos: number) => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const cargado = useRef(false);

  useEffect(() => {
    cargarDatos()
      .then((guardados) => setDatos(guardados ?? datosDeEjemplo()))
      .catch((e) => {
        console.error('No se pudo abrir la base de datos', e);
        setDatos(datosDeEjemplo());
      });
  }, []);

  useEffect(() => {
    if (!datos) return;
    if (!cargado.current) {
      cargado.current = true;
      return;
    }
    guardarDatos(datos).catch((e) => console.error('No se pudieron guardar los datos', e));
  }, [datos]);

  const store = useMemo<Store | null>(() => {
    if (!datos) return null;
    const actualizarArma = (armaId: string, cambio: (a: Arma) => Arma) =>
      setDatos((d) => d && { ...d, armas: d.armas.map((a) => (a.id === armaId ? cambio(a) : a)) });

    return {
      datos,
      arma: (id) => datos.armas.find((a) => a.id === id),
      registrarLimpieza: (armaId, tipo, nota) =>
        actualizarArma(armaId, (a) => ({
          ...a,
          limpiezas: [
            { id: `${Date.now()}`, fecha: hoyISO(), tipo, disparos: a.disparosTotales, nota },
            ...a.limpiezas,
          ],
        })),
      sumarDisparos: (armaId, disparos) =>
        actualizarArma(armaId, (a) => ({ ...a, disparosTotales: a.disparosTotales + disparos })),
    };
  }, [datos]);

  if (!store) return null;
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore fuera de StoreProvider');
  return store;
}
