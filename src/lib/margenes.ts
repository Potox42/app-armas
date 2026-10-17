import { Platform, type ViewStyle } from 'react-native';

// En la web (la app instalada desde Safari) los márgenes de la hora y de la raya de inicio del iPhone
// se ponen con CSS directamente: Expo Router los da a cero en la web (SafeAreaView no añade nada)
// y medirlos desde JavaScript no funcionó en el iPhone. Ojo: en la web SafeAreaView no debe tener bordes
// (bordesNativos), porque suma su margen al relleno y estropea el calc().
const web = Platform.OS === 'web';
const css = (estilo: Record<string, string>) => estilo as unknown as ViewStyle;

/** Hueco para la hora, la cobertura y la batería, más `extra` puntos de relleno propio. */
export const margenArriba = (extra = 0) =>
  web ? css({ paddingTop: `calc(${extra}px + env(safe-area-inset-top))` }) : undefined;

/** Hueco para la raya de inicio, más `extra` puntos de relleno propio. */
export const margenAbajo = (extra = 0) =>
  web ? css({ paddingBottom: `calc(${extra}px + env(safe-area-inset-bottom))` }) : undefined;

/** Barra de pestañas: su alto normal (49) más la raya de inicio. */
export const barraPestanasWeb = web
  ? css({ height: 'calc(49px + env(safe-area-inset-bottom))', paddingBottom: 'env(safe-area-inset-bottom)' })
  : undefined;


type Borde = 'top' | 'bottom' | 'left' | 'right';
/** Bordes para SafeAreaView: en el móvil los pedidos; en la web ninguno, porque ya lo hace el CSS. */
export const bordesNativos = (bordes: Borde[] = ['top', 'bottom', 'left', 'right']): Borde[] => (web ? [] : bordes);

/** En horizontal, el notch del iPhone queda a un lado: margen a izquierda y derecha. */
export const margenLados = () =>
  web ? css({ paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }) : undefined;
