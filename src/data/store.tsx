import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { puntuar } from '@/lib/diana';
import { hoyISO } from '@/lib/fechas';
import { cargarDatos, guardarDatos } from './db';
import { datosDeEjemplo } from './ejemplo';
import type { Arma, Datos, Disparo, Limpieza, Sesion } from './types';

// Los datos se cargan de la base de datos cifrada al arrancar y se guardan en cada cambio.
// Mientras no existan las pantallas de alta, el primer arranque parte del ejemplo.

interface Store {
  datos: Datos;
  arma: (id: string) => Arma | undefined;
  registrarLimpieza: (armaId: string, tipo: Limpieza['tipo'], nota?: string) => void;
  sumarDisparos: (armaId: string, disparos: number) => void;
  sesion: (id: string) => Sesion | undefined;
  nuevaSesion: (datos: Omit<Sesion, 'id' | 'fecha' | 'series' | 'terminada'>) => string;
  anadirDisparo: (sesionId: string, x: number, y: number) => void;
  deshacerDisparo: (sesionId: string) => void;
  nuevaSerie: (sesionId: string) => void;
  terminarSesion: (sesionId: string) => void;
}

/** Datos guardados con una versión anterior de la app: se completan los campos nuevos. */
function completar(d: Datos): Datos {
  return { ...d, sesiones: d.sesiones ?? [] };
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const cargado = useRef(false);

  useEffect(() => {
    cargarDatos()
      .then((guardados) => setDatos(guardados ? completar(guardados) : datosDeEjemplo()))
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
    const actualizarSesion = (id: string, cambio: (s: Sesion) => Sesion) =>
      setDatos((d) => d && { ...d, sesiones: d.sesiones.map((x) => (x.id === id ? cambio(x) : x)) });
    const conUltimaSerie = (s: Sesion, cambio: (disparos: Disparo[]) => Disparo[]): Sesion => ({
      ...s,
      series: s.series.map((serie, i) => (i === s.series.length - 1 ? { disparos: cambio(serie.disparos) } : serie)),
    });

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
      sesion: (id) => datos.sesiones.find((x) => x.id === id),
      nuevaSesion: (nueva) => {
        const id = `s${Date.now()}`;
        setDatos((d) => d && {
          ...d,
          sesiones: [{ ...nueva, id, fecha: new Date().toISOString(), series: [{ disparos: [] }], terminada: false }, ...d.sesiones],
        });
        return id;
      },
      anadirDisparo: (sesionId, x, y) =>
        actualizarSesion(sesionId, (s) => conUltimaSerie(s, (ds) => [...ds, { x, y, valor: puntuar(x, y) }])),
      deshacerDisparo: (sesionId) =>
        actualizarSesion(sesionId, (s) => conUltimaSerie(s, (ds) => ds.slice(0, -1))),
      nuevaSerie: (sesionId) =>
        actualizarSesion(sesionId, (s) => ({ ...s, series: [...s.series, { disparos: [] }] })),
      terminarSesion: (sesionId) =>
        setDatos((d) => {
          if (!d) return d;
          const s = d.sesiones.find((x) => x.id === sesionId);
          if (!s || s.terminada) return d;
          const series = s.series.filter((x) => x.disparos.length > 0);
          const n = series.reduce((t, x) => t + x.disparos.length, 0);
          return {
            ...d,
            sesiones: d.sesiones.map((x) => (x.id === sesionId ? { ...x, series, terminada: true } : x)),
            // los disparos de la sesión cuentan para el mantenimiento del arma
            armas: d.armas.map((a) => (a.id === s.armaId ? { ...a, disparosTotales: a.disparosTotales + n } : a)),
          };
        }),
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
