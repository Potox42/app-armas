import * as SecureStore from 'expo-secure-store';

export type PreferenciaTema = 'oscuro' | 'claro' | 'auto';

const CLAVE = 'tirador.tema';

// Se lee al arrancar, de forma síncrona, porque los estilos se crean al cargar cada pantalla.
export function leerPreferenciaTema(): PreferenciaTema {
  try {
    const v = SecureStore.getItem(CLAVE);
    return v === 'claro' || v === 'auto' ? v : 'oscuro';
  } catch {
    return 'oscuro';
  }
}

/** Guarda la preferencia. En la app instalada el cambio se ve al volver a abrirla. */
export function guardarPreferenciaTema(p: PreferenciaTema): { recargado: boolean } {
  SecureStore.setItem(CLAVE, p);
  return { recargado: false };
}
