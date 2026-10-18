export type TipoLicencia = 'F' | 'D' | 'E';

/** Una fila de la tarjeta de licencia de armas: tipo, válida desde y válida hasta. */
export interface Licencia {
  id: string;
  tipo: TipoLicencia;
  numero?: string; // versiones antiguas: cada licencia tenía su número
  categoria?: string; // licencia F: 1, 2 o 3
  expedicion: string; // ISO yyyy-mm-dd («válida desde»)
  caducidad: string; // «válida hasta»
  fotoAnverso?: string; // versiones antiguas: las fotos ahora van en el permiso
  fotoReverso?: string;
}

/** La tarjeta de licencia de armas: un solo documento con una fila por cada licencia (E, F, D). */
export interface PermisoArmas {
  numero: string; // NIF/NIE que figura en la tarjeta
  expedicion?: string; // fecha de expedición de la tarjeta
  fotoAnverso?: string;
  fotoReverso?: string;
  licencias: Licencia[];
}

export type TipoArma = 'Pistola' | 'Carabina' | 'Revólver' | 'Escopeta' | 'Rifle';

export interface Limpieza {
  id: string;
  fecha: string;
  tipo: 'Básica' | 'Completa';
  disparos: number; // disparos acumulados del arma en el momento de la limpieza
  nota?: string;
}

/** Una compra de cartuchos o un gasto (cartuchos disparados de los que tienes en casa). */
export interface MovimientoMunicion {
  id: string;
  fecha: string; // ISO yyyy-mm-dd
  tipo: 'compra' | 'gasto';
  cartuchos: number;
  enRecinto?: boolean; // compra hecha y gastada en el club: no cuenta para el cupo ni entra en casa
  nota?: string;
}

export interface Arma {
  id: string;
  marca: string;
  modelo: string;
  tipo: TipoArma;
  calibre: string;
  numeroSerie: string;
  numeroGuia: string;
  fechaGuia: string;
  licenciaId: string;
  disparosTotales: number;
  intervaloLimpieza: number; // disparos entre limpiezas
  foto?: string;
  fotoGuiaAnverso?: string;
  fotoGuiaReverso?: string;
  limpiezas: Limpieza[];
  municion?: MovimientoMunicion[]; // el más reciente primero
  cupoAnual?: number; // si tienes autorización para más cartuchos al año
  maxDeposito?: number; // si tienes autorización para guardar más
}

export interface Federacion {
  nombre: string;
  numeroFederado: string;
  categoria: string;
  caducidadCarnet: string;
  codigoPase: string;
  caducidadPase: string;
  fotoCarnet?: string;
  fotoQr?: string;
}

export type Modalidad = 'Precisión' | 'Tiro rápido' | 'Standard' | 'Otra';

export interface Disparo {
  x: number; // mm desde el centro, positivo a la derecha
  y: number; // mm desde el centro, positivo hacia abajo
  valor: number;
  sinPosicion?: boolean; // apuntado con el teclado de puntuación: x e y no significan nada
}

export interface Serie {
  disparos: Disparo[];
}

/** Cómo se apuntan los disparos: tocando la diana, con números o con la cámara en el catalejo. */
export type Registro = 'diana' | 'teclado' | 'camara';

export interface Sesion {
  id: string;
  fecha: string;
  armaId: string;
  modalidad: Modalidad;
  distancia: number; // metros
  municion: string;
  disparosPorSerie: number;
  seriesPrevistas?: number; // sin valor: series libres
  registro?: Registro; // cómo se apuntan los disparos (por defecto, tocando la diana)
  series: Serie[];
  terminada: boolean;
}

/** Tipos de competición, como los del calendario de la federación (p. ej. fmto.es). */
export type CategoriaCompeticion = 'Preparatoria' | 'Complementaria' | 'Regional' | 'Nacional' | 'Trofeo' | 'Otra';

export interface Competicion {
  id: string;
  fecha: string; // ISO yyyy-mm-dd
  hora?: string; // HH:MM
  categoria: CategoriaCompeticion;
  modalidad: string; // «Pistola 25 m», «Pistola Aire 10 m»…
  lugar?: string;
  inscrito: boolean; // apuntado: se avisa antes
  notas?: string;
}

export interface Ajustes {
  bloqueo: boolean; // pedir Face ID al abrir la app
  avisos: boolean; // notificaciones locales de caducidades
  bienvenida?: boolean; // ya se mostró la pantalla de bienvenida
}

export interface Datos {
  nombre: string;
  ajustes?: Ajustes;
  permiso: PermisoArmas;
  armas: Arma[];
  federacion: Federacion;
  sesiones: Sesion[];
  competiciones?: Competicion[]; // sin valor en datos de versiones anteriores
  esEjemplo?: boolean; // true mientras se usan los datos de ejemplo
}
