import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * Fondo con degradado (y, si se pide, un brillo redondo) que ocupa todo su contenedor.
 * Se pone como primer hijo de una vista con overflow: 'hidden' y zIndex: 0 (para que el
 * degradado, con zIndex -1, quede detrás del contenido también en la web).
 * Con SVG para que se vea igual en el iPhone, en Android y en la web.
 */
export function Degradado({
  desde,
  hasta,
  brillo,
  brilloEn = [0.85, 0.1],
  diagonal = true,
}: {
  desde: string;
  hasta: string;
  brillo?: string; // color del brillo (con su opacidad en stopOpacity)
  brilloEn?: [number, number]; // dónde está el brillo, de 0 a 1
  diagonal?: boolean; // si no, de arriba abajo
}) {
  const id = useId().replace(/:/g, '');
  return (
    <Svg style={st.fondo} width="100%" height="100%" preserveAspectRatio="none" pointerEvents="none">
      <Defs>
        <LinearGradient id={`l${id}`} x1="0" y1="0" x2={diagonal ? '1' : '0'} y2="1">
          <Stop offset="0" stopColor={desde} />
          <Stop offset="1" stopColor={hasta} />
        </LinearGradient>
        {brillo && (
          <RadialGradient id={`r${id}`} cx={brilloEn[0]} cy={brilloEn[1]} r="0.55" fx={brilloEn[0]} fy={brilloEn[1]}>
            <Stop offset="0" stopColor={brillo} stopOpacity={0.28} />
            <Stop offset="1" stopColor={brillo} stopOpacity={0} />
          </RadialGradient>
        )}
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#l${id})`} />
      {brillo && <Rect width="100%" height="100%" fill={`url(#r${id})`} />}
    </Svg>
  );
}

const st = StyleSheet.create({ fondo: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: -1 } });
