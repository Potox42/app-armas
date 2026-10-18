import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { geometria, puntuar } from '@/lib/diana';
import { colors, space } from '@/theme';
import { hoyISO } from '@/lib/fechas';
import { cargarDatos, guardarDatos } from './db';
import { datosDeEjemplo } from './ejemplo';
import type { Ajustes, Arma, Competicion, Datos, Documento, Plantilla, MovimientoMunicion, Disparo, Federacion, Licencia, Limpieza, PermisoArmas, Registro, Sesion } from './types';

// Los datos se cargan de la base de datos cifrada al arrancar y se guardan en cada cambio.
// Mientras no existan las pantallas de alta, el primer arranque parte del ejemplo.

interface Store {
  datos: Datos;
  arma: (id: string) => Arma | undefined;
  registrarLimpieza: (armaId: string, tipo: Limpieza['tipo'], nota?: string) => void;
  borrarLimpieza: (armaId: string, limpiezaId: string) => void;
  sumarDisparos: (armaId: string, disparos: number) => void;
  anadirMunicion: (armaId: string, m: Omit<MovimientoMunicion, 'id'>) => void;
  borrarMunicion: (armaId: string, movimientoId: string) => void;
  sesion: (id: string) => Sesion | undefined;
  nuevaSesion: (datos: Omit<Sesion, 'id' | 'fecha' | 'series' | 'terminada'>) => string;
  anadirDisparo: (sesionId: string, x: number, y: number) => void;
  anadirDisparos: (sesionId: string, puntos: { x: number; y: number }[]) => void;
  anadirValor: (sesionId: string, valor: number) => void;
  deshacerDisparo: (sesionId: string) => void;
  nuevaSerie: (sesionId: string) => void;
  terminarSesion: (sesionId: string) => void;
  apuntarGasto: (sesionId: string, desdeCasa: boolean) => void;
  borrarSesion: (sesionId: string) => void;
  cambiarRegistro: (sesionId: string, registro: Registro) => void;
  guardarArma: (arma: Arma) => void;
  borrarArma: (id: string) => void;
  guardarCompeticion: (c: Competicion) => void;
  borrarCompeticion: (id: string) => void;
  guardarPlantilla: (p: Plantilla) => void;
  borrarPlantilla: (id: string) => void;
  guardarDocumento: (d: Documento) => void;
  borrarDocumento: (id: string) => void;
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
    competiciones: [],
    documentos: [],
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
  return { ...d, permiso, sesiones: d.sesiones ?? [], competiciones: d.competiciones ?? [], documentos: d.documentos ?? [], esEjemplo: d.esEjemplo ?? true };
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const cargado = useRef(false);
  // Si no se pueden leer los datos guardados no se sigue con el ejemplo: al tocar algo se
  // guardaría encima y se perderían. Se avisa y se deja reintentar.
  const [fallo, setFallo] = useState(false);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    cargarDatos()
      .then((guardados) => {
        setFallo(false);
        setDatos(guardados ? completar(guardados) : datosDeEjemplo());
      })
      .catch((e) => {
        console.error('No se pudo abrir la base de datos', e);
        setFallo(true);
      });
  }, [intento]);

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
      borrarLimpieza: (armaId, limpiezaId) =>
        actualizarArma(armaId, (a) => ({ ...a, limpiezas: a.limpiezas.filter((l) => l.id !== limpiezaId) })),
      sumarDisparos: (armaId, disparos) =>
        actualizarArma(armaId, (a) => ({ ...a, disparosTotales: a.disparosTotales + disparos })),
      anadirMunicion: (armaId, m) =>
        actualizarArma(armaId, (a) => ({
          ...a,
          municion: [{ ...m, id: nuevoId('mun') }, ...(a.municion ?? [])].sort((x, y) => y.fecha.localeCompare(x.fecha)),
        })),
      borrarMunicion: (armaId, movimientoId) =>
        setDatos((d) => {
          if (!d) return d;
          // Si era el gasto de un entrenamiento, el entrenamiento vuelve a preguntar.
          const sesionId = d.armas.find((a) => a.id === armaId)?.municion?.find((m) => m.id === movimientoId)?.sesionId;
          return {
            ...d,
            armas: d.armas.map((a) => (a.id === armaId ? { ...a, municion: (a.municion ?? []).filter((m) => m.id !== movimientoId) } : a)),
            sesiones: sesionId ? d.sesiones.map((x) => (x.id === sesionId ? { ...x, gasto: undefined } : x)) : d.sesiones,
          };
        }),
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
        actualizarSesion(sesionId, (s) => {
          const { diana, calibre } = geometria(s);
          return conUltimaSerie(s, (ds) => [...ds, { x, y, valor: puntuar(x, y, calibre, diana) }]);
        }),
      anadirDisparos: (sesionId, puntos) =>
        actualizarSesion(sesionId, (s) => {
          const { diana, calibre } = geometria(s);
          return conUltimaSerie(s, (ds) => [...ds, ...puntos.map(({ x, y }) => ({ x, y, valor: puntuar(x, y, calibre, diana) }))]);
        }),
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
      // Al terminar, el tirador dice si los cartuchos salieron de casa (se apunta un gasto en el
      // arma, ligado a la sesión) o no (club, prestados…). Cambiar de opinión deshace el gasto.
      apuntarGasto: (sesionId, desdeCasa) =>
        setDatos((d) => {
          if (!d) return d;
          const s = d.sesiones.find((x) => x.id === sesionId);
          if (!s) return d;
          const n = s.series.reduce((t, x) => t + x.disparos.length, 0);
          return {
            ...d,
            sesiones: d.sesiones.map((x) => (x.id === sesionId ? { ...x, gasto: desdeCasa ? 'casa' : 'no' } : x)),
            armas: d.armas.map((a) => {
              if (a.id !== s.armaId) return a;
              const sin = (a.municion ?? []).filter((m) => m.sesionId !== sesionId);
              if (!desdeCasa || !n) return { ...a, municion: sin };
              const gasto = { id: nuevoId('mun'), fecha: s.fecha.slice(0, 10), tipo: 'gasto' as const, cartuchos: n, nota: 'Entrenamiento', sesionId };
              return { ...a, municion: [gasto, ...sin].sort((x, y) => y.fecha.localeCompare(x.fecha)) };
            }),
          };
        }),
      cambiarRegistro: (sesionId, registro) => actualizarSesion(sesionId, (s) => ({ ...s, registro })),
      borrarSesion: (sesionId) =>
        setDatos((d) => {
          if (!d) return d;
          const s = d.sesiones.find((x) => x.id === sesionId);
          if (!s) return d;
          // Si ya estaba terminada, sus disparos se habían sumado al arma: se restan.
          const n = s.terminada ? s.series.reduce((t, x) => t + x.disparos.length, 0) : 0;
          return {
            ...d,
            sesiones: d.sesiones.filter((x) => x.id !== sesionId),
            // y el gasto de munición que se apuntó con ella
            armas: d.armas.map((a) => (a.id === s.armaId
              ? { ...a, disparosTotales: Math.max(0, a.disparosTotales - n), municion: a.municion?.filter((m) => m.sesionId !== sesionId) }
              : a)),
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
      guardarCompeticion: (c) =>
        setDatos((d) => {
          if (!d) return d;
          const todas = d.competiciones ?? [];
          return {
            ...d,
            competiciones: todas.some((x) => x.id === c.id) ? todas.map((x) => (x.id === c.id ? c : x)) : [...todas, c],
          };
        }),
      borrarCompeticion: (id) => setDatos((d) => d && { ...d, competiciones: (d.competiciones ?? []).filter((x) => x.id !== id) }),
      guardarPlantilla: (pl) =>
        setDatos((d) => d && { ...d, plantillas: [...(d.plantillas ?? []).filter((x) => x.id !== pl.id), pl] }),
      borrarPlantilla: (id) => setDatos((d) => d && { ...d, plantillas: (d.plantillas ?? []).filter((x) => x.id !== id) }),
      guardarDocumento: (doc) =>
        setDatos((d) => {
          if (!d) return d;
          const todos = d.documentos ?? [];
          return { ...d, documentos: todos.some((x) => x.id === doc.id) ? todos.map((x) => (x.id === doc.id ? doc : x)) : [...todos, doc] };
        }),
      borrarDocumento: (id) => setDatos((d) => d && { ...d, documentos: (d.documentos ?? []).filter((x) => x.id !== id) }),
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

  if (fallo) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: space.xl, gap: space.md }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>No he podido abrir tus datos</Text>
        <Text style={{ color: colors.textMuted, fontSize: 15 }}>
          Siguen guardados en el móvil; no se ha borrado nada. Cierra la app del todo y vuelve a abrirla, o toca Reintentar.
        </Text>
        <Pressable onPress={() => setIntento((n) => n + 1)} style={{ backgroundColor: colors.accent, borderRadius: 14, padding: space.md, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }
  if (!store) return null;
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore fuera de StoreProvider');
  return store;
}
