import type { IdDiana } from '@/lib/diana';

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
  sesionId?: string; // gasto apuntado al terminar un entrenamiento: se borra con él
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
  diana?: number; // diana (hoja de papel) de la sesión a la que pertenece, desde 0; sin valor: la primera
}

/** Cómo se apuntan los disparos: tocando la diana, con números, con la cámara en el catalejo o con una foto. */
export type Registro = 'diana' | 'teclado' | 'camara' | 'foto';

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
  diana?: IdDiana; // diana con la que se puntúa (sin valor: pistola precisión 25 m)
  calibreMm?: number; // diámetro de la bala para la regla de «toca la línea» (sin valor: el de la diana)
  series: Serie[];
  terminada: boolean;
  gasto?: 'casa' | 'no'; // al terminar: se restaron los cartuchos de casa o se dijo que no
}

/** Configuración de entrenamiento guardada para empezar con un toque. */
export interface Plantilla {
  id: string;
  nombre: string;
  armaId?: string;
  modalidad: Modalidad;
  distancia: number;
  municion?: string;
  disparosPorSerie: number;
  seriesPrevistas?: number;
  registro?: Registro;
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
  // Resultado, cuando ya ha pasado
  participado?: boolean; // sin valor: se supone que sí si estabas apuntado
  puntos?: number;
  puesto?: number;
  participantes?: number;
  armaId?: string;
}

/** Otros papeles con fecha: seguro, certificado médico… */
export type TipoDocumento = 'Seguro' | 'Certificado médico' | 'Otro';

export interface Documento {
  id: string;
  tipo: TipoDocumento;
  nombre: string; // «Seguro de responsabilidad civil», «Certificado médico»…
  caducidad?: string; // ISO
  numero?: string;
  foto?: string;
  nota?: string;
}

/** Lista de «qué llevar» al campo: lo que ya está marcado. */
export interface ListaCampo {
  hechos: string[];
  propios?: string[]; // cosas añadidas por el tirador
  armas?: string[]; // las armas que vas a llevar
}

/** Copia automática: el móvil cifra los datos con la contraseña y los sube a tu propio hosting. */
export interface CopiaServidor {
  url: string; // dirección del archivo copia.php en tu web
  clave: string; // la misma CLAVE que está escrita en copia.php
  contrasena: string; // para cifrar la copia (se queda en este móvil)
  ultima?: string; // ISO con hora: última copia subida
  huella?: string; // de los datos de esa copia, para no repetirla si nada ha cambiado
  error?: string; // último fallo al subir, si lo hubo
}

export interface Ajustes {
  bloqueo: boolean; // pedir Face ID al abrir la app
  avisos: boolean; // notificaciones locales de caducidades
  bienvenida?: boolean; // ya se mostró la pantalla de bienvenida
  ultimaCopia?: string; // ISO: última copia de seguridad guardada desde este móvil
  nube?: CopiaServidor; // copia automática en el hosting del tirador
  pin?: { sal: string; hash: string; largo: number }; // bloqueo con PIN en la versión web (SHA-256 con sal)
  campo?: ListaCampo;
}

export interface Datos {
  nombre: string;
  ajustes?: Ajustes;
  permiso: PermisoArmas;
  armas: Arma[];
  federacion: Federacion;
  sesiones: Sesion[];
  competiciones?: Competicion[]; // sin valor en datos de versiones anteriores
  plantillas?: Plantilla[];
  documentos?: Documento[]; // seguro, certificado médico… (sin valor en versiones anteriores)
  esEjemplo?: boolean; // true mientras se usan los datos de ejemplo
}
