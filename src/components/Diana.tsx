import { useRef, type ComponentRef } from 'react';
import { Pressable } from 'react-native';
import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg';
import type { Disparo } from '@/data/types';
import { DIANAS, type ModeloDiana } from '@/lib/diana';
import { colors } from '@/theme';

interface Props {
  disparos: Disparo[];
  tamano: number; // px
  modelo?: ModeloDiana; // qué diana (por defecto, pistola precisión 25 m)
  calibre?: number; // diámetro de los impactos dibujados, mm
  visibleMm?: number; // diámetro de diana que se ve
  anteriores?: Disparo[]; // disparos de series anteriores, en gris
  grupo?: { cx: number; cy: number; radio: number }; // centro y radio medio del grupo
  centros?: { x: number; y: number; etiqueta: string }[]; // centro de cada serie
  sueltos?: Disparo[]; // impactos lejos del grupo: se rodean en naranja
  onToque?: (x: number, y: number) => void;
}

const PAPEL = '#EDE6D6';
const NEGRO = '#151515';
const NARANJA = '#E8590C'; // fijo: va sobre el papel de la diana, que no cambia con el tema

/** Diana ISSF dibujada a escala real, en milímetros. */
export function Diana({
  disparos: todos, tamano, modelo = DIANAS.precision, calibre = modelo.calibre, visibleMm = modelo.visible,
  anteriores: previos = [], grupo, centros = [], sueltos = [], onToque,
}: Props) {
  // Los disparos apuntados con el teclado no tienen posición: no se dibujan.
  const disparos = todos.filter((d) => !d.sinPosicion);
  const anteriores = previos.filter((d) => !d.sinPosicion);
  const r = visibleMm / 2;
  const escala = tamano / visibleMm; // px por mm

  const anillos = Object.entries(modelo.anillos)
    .map(([v, d]) => ({ valor: Number(v), radio: d / 2 }))
    .filter((a) => a.radio <= r + 1)
    .sort((a, b) => b.radio - a.radio);
  const negro = modelo.negro;
  const paso = (modelo.anillos[8] - modelo.anillos[9]) / 2; // ancho de un anillo
  const u = visibleMm / 360; // grosores y letras a la misma proporción que en la diana de precisión
  const bala = calibre / 2;

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
        <Circle cx={0} cy={0} r={negro / 2} fill={NEGRO} />
        {anillos.map(({ valor, radio }) => (
          <Circle
            key={valor}
            cx={0}
            cy={0}
            r={radio}
            fill="none"
            stroke={radio * 2 <= negro ? PAPEL : NEGRO}
            strokeWidth={0.6 * u}
          />
        ))}
        {modelo.diezInterior > 0 && (
          <Circle cx={0} cy={0} r={modelo.diezInterior / 2} fill="none" stroke={PAPEL} strokeWidth={0.4 * u} />
        )}
        {anillos
          .filter((a) => a.valor >= 1 && a.valor <= 8)
          .map(({ valor, radio }) => {
            const enNegro = radio * 2 <= negro;
            const pos = radio - paso / 2; // número en el centro del anillo
            return (
              <G key={`n${valor}`}>
                {[pos, -pos].map((x) => (
                  <SvgText
                    key={x}
                    x={x}
                    y={4 * u}
                    fontSize={11 * u}
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
          <Circle key={`a${i}`} cx={d.x} cy={d.y} r={bala} fill="#8A8F99" opacity={0.6} />
        ))}
        {grupo && grupo.radio > 0 && (
          <G>
            <Circle cx={grupo.cx} cy={grupo.cy} r={grupo.radio} fill={colors.accent} fillOpacity={0.12} stroke={colors.accent} strokeWidth={1.5 * u} strokeDasharray={`${4 * u} ${3 * u}`} />
            {/* Cruz en el centro de impactos */}
            <Line x1={grupo.cx - 9 * u} x2={grupo.cx + 9 * u} y1={grupo.cy} y2={grupo.cy} stroke="#fff" strokeWidth={3.5 * u} />
            <Line x1={grupo.cx} x2={grupo.cx} y1={grupo.cy - 9 * u} y2={grupo.cy + 9 * u} stroke="#fff" strokeWidth={3.5 * u} />
            <Line x1={grupo.cx - 8 * u} x2={grupo.cx + 8 * u} y1={grupo.cy} y2={grupo.cy} stroke={colors.accent} strokeWidth={2 * u} />
            <Line x1={grupo.cx} x2={grupo.cx} y1={grupo.cy - 8 * u} y2={grupo.cy + 8 * u} stroke={colors.accent} strokeWidth={2 * u} />
          </G>
        )}
        {sueltos.map((d, i) => (
          <Circle key={`s${i}`} cx={d.x} cy={d.y} r={bala + 4 * u} fill="none" stroke={NARANJA} strokeWidth={2 * u} />
        ))}
        {centros.map((c) => (
          <G key={`c${c.etiqueta}`}>
            <Circle cx={c.x} cy={c.y} r={6 * u} fill={NARANJA} stroke="#fff" strokeWidth={u} />
            <SvgText x={c.x} y={c.y + 3 * u} fontSize={8 * u} fontWeight="700" fill="#fff" textAnchor="middle">{c.etiqueta}</SvgText>
          </G>
        ))}
        {disparos.map((d, i) => {
          const ultimo = i === disparos.length - 1;
          return (
            <G key={i}>
              <Circle cx={d.x} cy={d.y} r={bala} fill={ultimo ? colors.green : colors.red} />
              {ultimo && (
                <Circle cx={d.x} cy={d.y} r={bala + 3 * u} fill="none" stroke={colors.green} strokeWidth={1.5 * u} />
              )}
            </G>
          );
        })}
      </Svg>
    </Pressable>
  );
}

/** Diana pequeña para listas: solo la zona negra y los impactos, sin números. */
export function MiniDiana({ disparos: todos, tamano = 56, modelo = DIANAS.precision }: {
  disparos: Disparo[]; tamano?: number; modelo?: ModeloDiana;
}) {
  const disparos = todos.filter((d) => !d.sinPosicion);
  // Se ve la zona negra con margen; los impactos que caen fuera se pegan al borde.
  const r = modelo.negro * 0.65;
  const punto = (r * 2 * 1.5) / tamano; // unos 1,5 px de radio, sea cual sea el tamaño
  return (
    <Svg width={tamano} height={tamano} viewBox={`${-r} ${-r} ${r * 2} ${r * 2}`}>
      <Circle cx={0} cy={0} r={r} fill={PAPEL} />
      <Circle cx={0} cy={0} r={modelo.negro / 2} fill={NEGRO} />
      {[8, 9, 10].map((v) => modelo.anillos[v]).filter((d) => d < modelo.negro).map((d) => (
        <Circle key={d} cx={0} cy={0} r={d / 2} fill="none" stroke={PAPEL} strokeWidth={r / 65} opacity={0.5} />
      ))}
      {disparos.map((d, i) => {
        const dist = Math.hypot(d.x, d.y);
        const k = dist > r - punto ? (r - punto) / dist : 1;
        return <Circle key={i} cx={d.x * k} cy={d.y * k} r={punto} fill={colors.accent} stroke="#fff" strokeWidth={punto * 0.25} opacity={0.9} />;
      })}
    </Svg>
  );
}
