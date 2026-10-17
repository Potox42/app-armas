import type { TipoArma } from '@/data/types';

// Siluetas de arma dibujadas en un lienzo de 240 x 120, de perfil y con el cañón a la derecha.
// Solo datos: las pinta GunArt (ui.tsx).

export const CLARO = '#5B6478';
export const OSCURO = '#3B4253';
export const DETALLE = '#262C38';

export interface Trazo {
  d: string;
  relleno?: string;
  linea?: string;
  grosor?: number;
}

const pistola: Trazo[] = [
  // Empuñadura
  { d: 'M44 50 H104 L99 62 L88 108 Q86 116 78 116 H54 Q44 116 46 106 L56 64 Q50 56 44 54 Z', relleno: OSCURO },
  { d: 'M60 66 H92 M58 76 H90 M56 86 H87 M54 96 H85', linea: DETALLE, grosor: 2 },
  // Armazón y guardamonte
  { d: 'M44 46 H190 V56 H140 L134 60 H100 Z', relleno: OSCURO },
  { d: 'M104 58 Q104 84 128 84 H142 Q150 84 150 74 V56', linea: OSCURO, grosor: 6 },
  { d: 'M122 60 Q128 70 122 80', linea: CLARO, grosor: 4 },
  // Corredera, miras y estrías
  { d: 'M36 24 H200 Q208 24 208 32 V46 H36 Z', relleno: CLARO },
  { d: 'M48 28 V42 M54 28 V42 M60 28 V42 M66 28 V42', linea: OSCURO, grosor: 2 },
  { d: 'M196 17 H204 V24 H196 Z M40 16 H54 V24 H40 Z', relleno: CLARO },
  { d: 'M150 38 H176', linea: OSCURO, grosor: 3 },
];

const revolver: Trazo[] = [
  // Culata curva
  { d: 'M50 54 H96 L92 66 Q86 96 74 112 Q70 117 63 116 H44 Q36 115 40 106 Q54 84 54 66 Q48 60 50 54 Z', relleno: OSCURO },
  // Armazón, martillo y guardamonte
  { d: 'M50 30 H128 V62 H96 L88 54 H50 Z', relleno: OSCURO },
  { d: 'M50 30 L40 20 L48 18 L60 30 Z', relleno: CLARO },
  { d: 'M96 60 Q96 84 116 84 H124 Q132 84 132 74 V60', linea: OSCURO, grosor: 6 },
  { d: 'M112 62 Q118 72 112 80', linea: CLARO, grosor: 4 },
  // Tambor
  { d: 'M80 26 H132 Q138 26 138 32 V58 Q138 64 132 64 H80 Q74 64 74 58 V32 Q74 26 80 26 Z', relleno: CLARO },
  { d: 'M74 39 H138 M74 51 H138', linea: OSCURO, grosor: 2 },
  // Cañón con costilla y mira
  { d: 'M136 28 H222 V44 H136 Z', relleno: CLARO },
  { d: 'M136 44 H218 V50 H136 Z', relleno: OSCURO },
  { d: 'M212 20 H220 V28 H212 Z', relleno: CLARO },
];

function larga(conVisor: boolean, dobleCanon: boolean): Trazo[] {
  const t: Trazo[] = [
    // Culata con carrillera y pistolete
    { d: 'M8 46 Q8 40 16 40 L74 36 V56 Q70 60 66 60 L52 62 Q44 76 34 80 L16 86 Q8 88 8 80 Z', relleno: OSCURO },
    { d: 'M14 46 Q30 42 52 44', linea: DETALLE, grosor: 2 },
    // Cajón de mecanismos y guardamonte
    { d: 'M72 34 H138 V52 H72 Z', relleno: CLARO },
    { d: 'M92 52 Q92 70 108 70 H116 Q122 70 122 62 V52', linea: OSCURO, grosor: 5 },
    { d: 'M104 54 Q108 62 104 68', linea: CLARO, grosor: 3 },
    // Guardamanos
    { d: 'M136 40 H196 Q200 40 200 44 V52 Q200 56 196 56 H136 Z', relleno: OSCURO },
  ];
  // Cerrojo (no en la escopeta)
  if (!dobleCanon) t.push({ d: 'M92 34 V26 Q92 22 96 22', linea: CLARO, grosor: 4 });
  if (dobleCanon) {
    t.push({ d: 'M138 34 H234 V40 H138 Z M138 41 H232 V47 H138 Z', relleno: CLARO });
    t.push({ d: 'M138 33 H234', linea: OSCURO, grosor: 2 });
  } else {
    t.push({ d: 'M138 38 H234 V44 H138 Z', relleno: CLARO });
    t.push({ d: 'M228 32 H234 V38 H228 Z', relleno: CLARO });
  }
  if (conVisor) {
    t.push({ d: 'M82 22 H144 Q148 22 148 26 V28 Q148 32 144 32 H82 Q78 32 78 28 V26 Q78 22 82 22 Z', relleno: CLARO });
    t.push({ d: 'M70 20 H84 V34 H70 Z M144 19 H160 V35 H144 Z', relleno: CLARO });
    t.push({ d: 'M92 32 V36 M132 32 V36', linea: OSCURO, grosor: 4 });
  } else if (!dobleCanon) {
    // Diópter de tiro (carabina de precisión)
    t.push({ d: 'M78 26 H96 V34 H78 Z', relleno: CLARO });
    t.push({ d: 'M83 22 H91 V27 H83 Z', relleno: OSCURO });
  }
  return t;
}

export const SILUETAS: Record<TipoArma, Trazo[]> = {
  Pistola: pistola,
  'Revólver': revolver,
  Carabina: larga(false, false),
  Rifle: larga(true, false),
  Escopeta: larga(false, true),
};
