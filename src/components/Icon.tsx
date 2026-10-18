import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'home' | 'target' | 'gun' | 'wallet' | 'user' | 'chevron' | 'back'
  | 'chart' | 'shield' | 'id' | 'broom' | 'qr' | 'check' | 'plus' | 'doc' | 'lock'
  | 'trash' | 'flash' | 'share' | 'calendar';

interface Props {
  name: IconName;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 24, color = '#fff' }: Props) {
  const p = { stroke: color, strokeWidth: 1.8, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'home' && <Path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" {...p} />}
      {name === 'target' && (
        <>
          <Circle cx={12} cy={12} r={9} {...p} />
          <Circle cx={12} cy={12} r={5} {...p} />
          <Circle cx={12} cy={12} r={1.5} fill={color} />
        </>
      )}
      {name === 'gun' && <Path d="M3 7h16l2 2v2h-8l-1 2h-2l-1 5H5l1.5-7H3z" {...p} />}
      {name === 'wallet' && (
        <>
          <Rect x={3} y={6} width={18} height={13} rx={2} {...p} />
          <Path d="M3 10h18M16 14.5h2" {...p} />
        </>
      )}
      {name === 'user' && (
        <>
          <Circle cx={12} cy={8} r={4} {...p} />
          <Path d="M4 21c1-4 4.5-6 8-6s7 2 8 6" {...p} />
        </>
      )}
      {name === 'chevron' && <Path d="M9 5l7 7-7 7" {...p} />}
      {name === 'back' && <Path d="M15 5l-7 7 7 7" {...p} />}
      {name === 'chart' && <Path d="M5 20V12M10 20V6M15 20v-9M20 20V4" {...p} strokeWidth={3} />}
      {name === 'shield' && <Path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" {...p} />}
      {name === 'id' && (
        <>
          <Rect x={3} y={5} width={18} height={14} rx={2} {...p} />
          <Circle cx={9} cy={11} r={2} {...p} />
          <Path d="M6 16c.6-1.6 1.7-2.4 3-2.4s2.4.8 3 2.4M14 10h4M14 13h3" {...p} />
        </>
      )}
      {name === 'broom' && <Path d="M14 3l-4 9M6 12h8l2 9H4z M8 16v5M12 16v5" {...p} />}
      {name === 'qr' && (
        <>
          <Rect x={3} y={3} width={7} height={7} {...p} />
          <Rect x={14} y={3} width={7} height={7} {...p} />
          <Rect x={3} y={14} width={7} height={7} {...p} />
          <Path d="M14 14h3v3h-3zM18 18h3v3h-3z" {...p} />
        </>
      )}
      {name === 'check' && <Path d="M5 12.5l4.5 4.5L19 7" {...p} strokeWidth={2.5} />}
      {name === 'plus' && <Path d="M12 5v14M5 12h14" {...p} />}
      {name === 'calendar' && (
        <>
          <Rect x={3} y={5} width={18} height={16} rx={2} {...p} />
          <Path d="M3 10h18M8 3v4M16 3v4" {...p} />
          <Circle cx={12} cy={15} r={1.6} fill={color} />
        </>
      )}
      {name === 'doc' && (
        <>
          <Path d="M6 3h8l5 5v13H6z" {...p} />
          <Line x1={9} y1={13} x2={16} y2={13} {...p} />
          <Line x1={9} y1={17} x2={14} y2={17} {...p} />
        </>
      )}
      {name === 'lock' && (
        <>
          <Rect x={5} y={11} width={14} height={10} rx={2} {...p} />
          <Path d="M8 11V8a4 4 0 0 1 8 0v3" {...p} />
        </>
      )}
      {name === 'trash' && <Path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" {...p} />}
      {name === 'flash' && <Path d="M13 2L5 14h6l-1 8 8-12h-6z" {...p} />}
      {name === 'share' && <Path d="M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1" {...p} />}
    </Svg>
  );
}
