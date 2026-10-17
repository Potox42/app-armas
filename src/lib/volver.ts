import { router, type Href } from 'expo-router';

/**
 * Vuelve a la pantalla anterior. Si no la hay (en la web, al recargar o reabrir la app
 * estando dentro de una ficha), va a `alternativa` para no dejar a nadie atrapado.
 */
export function volver(alternativa: Href = '/') {
  if (router.canGoBack()) router.back();
  else router.replace(alternativa);
}
