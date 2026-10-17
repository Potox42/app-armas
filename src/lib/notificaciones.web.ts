import type { AvisoProgramado } from './planAvisos';

// En el navegador no hay avisos programados: solo funcionan en el móvil.
export const avisosDisponibles = false;
export async function pedirPermisoAvisos(): Promise<boolean> {
  return false;
}
export async function programarAvisos(_plan: AvisoProgramado[]): Promise<void> {}
export async function quitarAvisos(): Promise<void> {}
export async function avisoDePrueba(): Promise<void> {}
