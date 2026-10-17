import { useRef, type ComponentRef } from 'react';
import { Pressable } from 'react-native';
import Svg, { Circle, G, Text as SvgText } from 'react-native-svg';
import type { Disparo } from '@/data/types';
import {
  CALIBRE_22_MM, DIAMETRO_ANILLO_MM, DIAMETRO_DIEZ_INTERIOR_MM, DIAMETRO_NEGRO_MM,
} from '@/lib/diana';
import { colors } from '@/theme';

interface Props {
  disparos: Disparo[];
  tamano: number; // px
  visibleMm?: number; // diámetro de diana que se ve
  anteriores?: Disparo[]; // disparos de series anteriores, en gris
  grupo?: { cx: number; cy: number; radio: number }; // centro y radio medio del grupo
  onToque?: (x: number, y: number) => void;
}

const PAPEL = '#EDE6D6';
const NEGRO = '#151515';

/** Diana ISSF de pistola 25 m precisión dibujada a escala real, en milímetros. */
export function Diana({ disparos: todos, tamano, visibleMm = 360, anteriores: previos = [], grupo, onToque }: Props) {
  // Los disparos apuntados con el teclado no tienen posición: no se dibujan.
  const disparos = todos.filter((d) => !d.sinPosicion);
  const anteriores = previos.filter((d) => !d.sinPosicion);
  const r = visibleMm / 2;
  const escala = tamano / visibleMm; // px por mm

  const anillos = Object.entries(DIAMETRO_ANILLO_MM)
    .map(([v, d]) => ({ valor: Number(v), radio: d / 2 }))
    .filter((a) => a.radio <= r + 1)
    .sort((a, b) => b.radio - a.radio);

  const vista = useRef<ComponentRef<typeof Pressable>>(null);

  return (
    <Pressable
      ref={vista}
      disabled={!onToque}
      onPress={(e) => {
        const { locationX, locationY, pageX, pageY } = e.nativeEvent;
        if (Number.isFinite(locationX) && Number.isFinite(locationY)) {
          onToque?.(locationX / escala - r, locationY / escala - r);
          return;
        }
        // En web locationX no siempre llega: se calcula con la posición de la diana en pantalla.
        vista.current?.measure((_x, _y, _w, _h, px, py) => {
          onToque?.((pageX - px) / escala - r, (pageY - py) / escala - r);
        });
      }}
    >
      <Svg width={tamano} height={tamano} viewBox={`${-r} ${-r} ${visibleMm} ${visibleMm}`}>
        <Circle cx={0} cy={0} r={r} fill={PAPEL} />
        <Circle cx={0} cy={0} r={DIAMETRO_NEGRO_MM / 2} fill={NEGRO} />
        {anillos.map(({ valor, radio }) => (
          <Circle
            key={valor}
            cx={0}
            cy={0}
            r={radio}
            fill="none"
            stroke={radio * 2 <= DIAMETRO_NEGRO_MM ? PAPEL : NEGRO}
            strokeWidth={0.6}
          />
        ))}
        <Circle cx={0} cy={0} r={DIAMETRO_DIEZ_INTERIOR_MM / 2} fill="none" stroke={PAPEL} strokeWidth={0.4} />
        {anillos
          .filter((a) => a.valor >= 1 && a.valor <= 8)
          .map(({ valor, radio }) => {
            const enNegro = radio * 2 <= DIAMETRO_NEGRO_MM;
            const pos = radio - 12.5; // número en el centro del anillo
            return (
              <G key={`n${valor}`}>
                {[pos, -pos].map((x) => (
                  <SvgText
                    key={x}
                    x={x}
                    y={4}
                    fontSize={11}
                    fontWeight="600"
                    textAnchor="middle"
                    fill={enNegro ? PAPEL : NEGRO}
                  >
                    {valor}
                  </SvgText>
                ))}
              </G>
            );
          })}
        {anteriores.map((d, i) => (
          <Circle key={`a${i}`} cx={d.x} cy={d.y} r={CALIBRE_22_MM / 2} fill="#8A8F99" opacity={0.6} />
        ))}
        {grupo && grupo.radio > 0 && (
          <G>
            <Circle cx={grupo.cx} cy={grupo.cy} r={grupo.radio} fill={colors.accent} fillOpacity={0.12} stroke={colors.accent} strokeWidth={1.5} strokeDasharray="4 3" />
            <Circle cx={grupo.cx} cy={grupo.cy} r={3} fill={colors.accent} stroke="#fff" strokeWidth={1} />
          </G>
        )}
        {disparos.map((d, i) => {
          const ultimo = i === disparos.length - 1;
          return (
            <G key={i}>
              <Circle cx={d.x} cy={d.y} r={CALIBRE_22_MM / 2} fill={ultimo ? colors.green : colors.red} />
              {ultimo && (
                <Circle cx={d.x} cy={d.y} r={CALIBRE_22_MM / 2 + 3} fill="none" stroke={colors.green} strokeWidth={1.5} />
              )}
            </G>
          );
        })}
      </Svg>
    </Pressable>
  );
}

/** Diana pequeña para listas: solo la zona negra y los impactos, sin números. */
export function MiniDiana({ disparos: todos, tamano = 56 }: { disparos: Disparo[]; tamano?: number }) {
  const disparos = todos.filter((d) => !d.sinPosicion);
  // Se ve la zona negra con margen; los impactos que caen fuera se pegan al borde.
  const r = 130;
  const punto = (r * 2 * 1.5) / tamano; // unos 1,5 px de radio, sea cual sea el tamaño
  return (
    <Svg width={tamano} height={tamano} viewBox={`${-r} ${-r} ${r * 2} ${r * 2}`}>
      <Circle cx={0} cy={0} r={r} fill={PAPEL} />
      <Circle cx={0} cy={0} r={DIAMETRO_NEGRO_MM / 2} fill={NEGRO} />
      {[150, 100, 50].map((d) => (
        <Circle key={d} cx={0} cy={0} r={d / 2} fill="none" stroke={PAPEL} strokeWidth={2} opacity={0.5} />
      ))}
      {disparos.map((d, i) => {
        const dist = Math.hypot(d.x, d.y);
        const k = dist > r - punto ? (r - punto) / dist : 1;
        return <Circle key={i} cx={d.x * k} cy={d.y * k} r={punto} fill={colors.accent} stroke="#fff" strokeWidth={punto * 0.25} opacity={0.9} />;
      })}
    </Svg>
  );
}
