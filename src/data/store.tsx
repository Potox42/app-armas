import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { puntuar } from '@/lib/diana';
import { hoyISO } from '@/lib/fechas';
import { cargarDatos, guardarDatos } from './db';
import { datosDeEjemplo } from './ejemplo';
import type { Ajustes, Arma, Datos, Disparo, Federacion, Licencia, Limpieza, PermisoArmas, Sesion } from './types';

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
  anadirValor: (sesionId: string, valor: number) => void;
  deshacerDisparo: (sesionId: string) => void;
  nuevaSerie: (sesionId: string) => void;
  terminarSesion: (sesionId: string) => void;
  guardarArma: (arma: Arma) => void;
  borrarArma: (id: string) => void;
  guardarLicencia: (licencia: Licencia) => void;
  borrarLicencia: (id: string) => void;
  actualizarPermiso: (cambios: Partial<PermisoArmas>) => void;
  guardarPermiso: (permiso: PermisoArmas) => void;
  guardarFederacion: (f: Federacion) => void;
  empezarDeCero: () => void;
  restaurar: (d: Datos) => void;
  guardarNombre: (nombre: string) => void;
  ajustes: Ajustes;
  guardarAjustes: (cambios: Partial<Ajustes>) => void;
  esEjemplo: boolean;
}

const AJUSTES_INICIALES: Ajustes = { bloqueo: false, avisos: false };

export const nuevoId = (prefijo: string) => `${prefijo}-${Date.now()}-${Math.round(Math.random() * 1e6)}`;

function datosVacios(nombre: string): Datos {
  return {
    nombre,
    permiso: { numero: '', licencias: [] },
    armas: [],
    federacion: {
      nombre: 'Federación Madrileña de Tiro Olímpico',
      numeroFederado: '', categoria: '', caducidadCarnet: '', codigoPase: '', caducidadPase: '',
    },
    sesiones: [],
    esEjemplo: false,
  };
}

/** Datos guardados con una versión anterior de la app: se completan los campos nuevos. */
function completar(d: Datos): Datos {
  // Antes cada licencia tenía sus fotos; ahora son de la tarjeta (el permiso).
  const conFotos = d.permiso.licencias.find((l) => l.fotoAnverso || l.fotoReverso);
  const permiso = {
    ...d.permiso,
    fotoAnverso: d.permiso.fotoAnverso ?? conFotos?.fotoAnverso,
    fotoReverso: d.permiso.fotoReverso ?? conFotos?.fotoReverso,
  };
  return { ...d, permiso, sesiones: d.sesiones ?? [], esEjemplo: d.esEjemplo ?? true };
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
      anadirValor: (sesionId, valor) =>
        actualizarSesion(sesionId, (s) => conUltimaSerie(s, (ds) => [...ds, { x: 0, y: 0, valor, sinPosicion: true }])),
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
      guardarArma: (arma) =>
        setDatos((d) => d && {
          ...d,
          armas: d.armas.some((a) => a.id === arma.id)
            ? d.armas.map((a) => (a.id === arma.id ? arma : a))
            : [...d.armas, arma],
        }),
      borrarArma: (id) => setDatos((d) => d && { ...d, armas: d.armas.filter((a) => a.id !== id) }),
      guardarLicencia: (l) =>
        setDatos((d) => d && {
          ...d,
          permiso: {
            ...d.permiso,
            licencias: d.permiso.licencias.some((x) => x.id === l.id)
              ? d.permiso.licencias.map((x) => (x.id === l.id ? l : x))
              : [...d.permiso.licencias, l],
          },
        }),
      borrarLicencia: (id) =>
        setDatos((d) => d && { ...d, permiso: { ...d.permiso, licencias: d.permiso.licencias.filter((x) => x.id !== id) } }),
      actualizarPermiso: (cambios) => setDatos((d) => d && { ...d, permiso: { ...d.permiso, ...cambios } }),
      guardarPermiso: (permiso) =>
        setDatos((d) => {
          if (!d) return d;
          // Las armas de una licencia que ya no está pasan a otra del mismo tipo (o a la primera).
          const ids = new Set(permiso.licencias.map((l) => l.id));
          const tipoDe = (id: string) => d.permiso.licencias.find((l) => l.id === id)?.tipo;
          const armas = d.armas.map((a) => {
            if (ids.has(a.licenciaId)) return a;
            const otra = permiso.licencias.find((l) => l.tipo === tipoDe(a.licenciaId)) ?? permiso.licencias[0];
            return { ...a, licenciaId: otra?.id ?? '' };
          });
          return { ...d, permiso, armas };
        }),
      guardarFederacion: (f) => setDatos((d) => d && { ...d, federacion: f }),
      empezarDeCero: () => setDatos((d) => d && { ...datosVacios(d.nombre), ajustes: d.ajustes }),
      // Los ajustes (Face ID, avisos) son de este móvil: no se traen de la copia.
      restaurar: (nuevos) => setDatos((d) => d && { ...completar(nuevos), esEjemplo: false, ajustes: d.ajustes }),
      guardarNombre: (nombre) => setDatos((d) => d && { ...d, nombre }),
      ajustes: datos.ajustes ?? AJUSTES_INICIALES,
      guardarAjustes: (cambios) => setDatos((d) => d && { ...d, ajustes: { ...(d.ajustes ?? AJUSTES_INICIALES), ...cambios } }),
      esEjemplo: datos.esEjemplo !== false,
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
