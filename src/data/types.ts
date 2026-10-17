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

export interface Sesion {
  id: string;
  fecha: string;
  armaId: string;
  modalidad: Modalidad;
  distancia: number; // metros
  municion: string;
  disparosPorSerie: number;
  seriesPrevistas?: number; // sin valor: series libres
  registro?: 'diana' | 'teclado'; // cómo se apuntan los disparos (por defecto, tocando la diana)
  series: Serie[];
  terminada: boolean;
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
  esEjemplo?: boolean; // true mientras se usan los datos de ejemplo
}
