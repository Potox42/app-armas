import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

// Símbolo de Tirador 360: punto de mira con flechas en círculo (mismo dibujo que
// assets/fuente/generar-iconos.js, que hace el icono de la app).
const AZUL = '#1E6BFF';
const CIAN = '#22D3FF';
const BLANCO = '#F4F7FA';

const R = 72;
const G = 22;
const pol = (r: number, ang: number) => [100 + r * Math.cos((ang * Math.PI) / 180), 100 + r * Math.sin((ang * Math.PI) / 180)];
const f = (n: number) => n.toFixed(2);

function arco(a0: number, a1: number) {
  const [x0, y0] = pol(R, a0);
  const [x1, y1] = pol(R, a1);
  return `M${f(x0)} ${f(y0)}A${R} ${R} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} ${a1 > a0 ? 1 : 0} ${f(x1)} ${f(y1)}`;
}

function punta(ang: number, sentido: number) {
  const a = (ang * Math.PI) / 180;
  const ux = Math.cos(a), uy = Math.sin(a);
  const [tx, ty] = sentido > 0 ? [-uy, ux] : [uy, -ux];
  const [bx, by] = pol(R, ang);
  const ancho = G + 18, largo = 20;
  const p = [[bx + (ux * ancho) / 2, by + (uy * ancho) / 2], [bx + tx * largo, by + ty * largo], [bx - (ux * ancho) / 2, by - (uy * ancho) / 2]];
  return `M${p.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')}Z`;
}

const IZQUIERDA = arco(96, 262);
const PUNTA_ARRIBA = punta(262, 1);
const BLANCO_ARCO = arco(278, 352);
const ABAJO = arco(84, 22);
const PUNTA_DERECHA = punta(22, -1);
const CRUZ = [[100, 46, 100, 81], [100, 119, 100, 154], [46, 100, 81, 100], [119, 100, 154, 100]];

export function Logo({ size = 96 }: { size?: number }) {
  const deg = 'url(#t360)';
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <LinearGradient id="t360" gradientUnits="userSpaceOnUse" x1="30" y1="170" x2="170" y2="30">
          <Stop offset="0" stopColor={AZUL} />
          <Stop offset="1" stopColor={CIAN} />
        </LinearGradient>
      </Defs>
      <Path d={IZQUIERDA} fill="none" stroke={deg} strokeWidth={G} />
      <Path d={PUNTA_ARRIBA} fill={deg} />
      <Path d={BLANCO_ARCO} fill="none" stroke={BLANCO} strokeWidth={G} />
      <Path d={ABAJO} fill="none" stroke={deg} strokeWidth={G} />
      <Path d={PUNTA_DERECHA} fill={deg} />
      <Circle cx={100} cy={100} r={34} fill="none" stroke={deg} strokeWidth={8} />
      {CRUZ.map(([x1, y1, x2, y2]) => (
        <Line key={`${x1},${y1}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={BLANCO} strokeWidth={8} strokeLinecap="round" />
      ))}
      <Circle cx={100} cy={100} r={11} fill={CIAN} />
    </Svg>
  );
}
