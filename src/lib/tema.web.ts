export type PreferenciaTema = 'oscuro' | 'claro' | 'auto';

const CLAVE = 'tirador.tema';

export function leerPreferenciaTema(): PreferenciaTema {
  try {
    const v = globalThis.localStorage?.getItem(CLAVE);
    return v === 'claro' || v === 'auto' ? v : 'oscuro';
  } catch {
    return 'oscuro';
  }
}

/** Guarda la preferencia y recarga la página para aplicar los colores nuevos. */
export function guardarPreferenciaTema(p: PreferenciaTema): { recargado: boolean } {
  try {
    localStorage.setItem(CLAVE, p);
  } catch {
    return { recargado: false };
  }
  window.location.reload();
  return { recargado: true };
}
