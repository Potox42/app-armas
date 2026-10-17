export type TipoLicencia = 'F' | 'D' | 'E';

export interface Licencia {
  id: string;
  tipo: TipoLicencia;
  numero: string;
  expedicion: string; // ISO yyyy-mm-dd
  caducidad: string;
}

export interface PermisoArmas {
  numero: string;
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

export interface Datos {
  nombre: string;
  permiso: PermisoArmas;
  armas: Arma[];
  federacion: Federacion;
}
