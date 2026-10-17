import Svg, { Circle, Line } from 'react-native-svg';

const AZUL = '#1E7BFF';

/** Diana del icono de la app (mismo dibujo que assets/fuente/generar-iconos.js). */
export function Logo({ size = 96 }: { size?: number }) {
  const c = 512;
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      <Circle cx={c} cy={c} r={360} fill="#EEF2F8" />
      {[300, 240].map((r) => <Circle key={r} cx={c} cy={c} r={r} fill="none" stroke="#9AA6B8" strokeWidth={6} />)}
      <Circle cx={c} cy={c} r={180} fill="#0F1522" />
      {[120, 60].map((r) => <Circle key={r} cx={c} cy={c} r={r} fill="none" stroke="#C9D2E0" strokeWidth={5} />)}
      <Circle cx={c} cy={c} r={14} fill="#C9D2E0" />
      <Circle cx={c + 34} cy={c - 40} r={40} fill={AZUL} fillOpacity={0.35} />
      <Circle cx={c + 34} cy={c - 40} r={22} fill={AZUL} stroke="#fff" strokeWidth={6} />
      {[[0, -1], [0, 1], [-1, 0], [1, 0]].map(([dx, dy]) => (
        <Line
          key={`${dx},${dy}`}
          x1={c + dx * 395} y1={c + dy * 395} x2={c + dx * 455} y2={c + dy * 455}
          stroke={AZUL} strokeWidth={18} strokeLinecap="round"
        />
      ))}
    </Svg>
  );
}
