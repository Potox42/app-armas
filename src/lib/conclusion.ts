import type { Arma, Mano, Sesion } from '@/data/types';
import { geometria } from './diana';
import {
  anilloDondeCabe, centrosSeries, correccion, desplazado, dosGrupos, forma, medidas, MIN_IMPACTOS, puntosSiCentrado,
  sueltos, textoCorreccion,
} from './grupo';
import { direccion } from './analisis';
import { sumaSerie } from './sesiones';

// Conclusión de una diana o de una sesión en palabras sencillas: qué haces bien, qué corregir y cómo.
// Las causas vienen de zonatactica.es («Análisis de los impactos en el blanco» I y II) y se dan como
// posibles: el entrenador es quien puede confirmarlas viéndote tirar.

/** Tipo de fallo: sirve para contar cuáles se repiten entre entrenamientos. */
export type TipoFallo =
  | 'cansancio' | 'irregular' | 'centroSeMueve' | 'dosGrupos' | 'sueltos'
  | 'vertical' | 'horizontal' | 'oblicuo' | 'repartido' | 'gatillazo' | 'miras';

/** Nombre corto de cada fallo, para las listas. */
export const NOMBRE_FALLO: Record<TipoFallo, string> = {
  cansancio: 'Bajas en las últimas series',
  irregular: 'Series muy desiguales',
  centroSeMueve: 'El centro cambia entre series',
  dosGrupos: 'Dos grupos en la diana',
  sueltos: 'Disparos que se escapan del grupo',
  vertical: 'Grupo estirado de arriba abajo',
  horizontal: 'Grupo estirado de lado a lado',
  oblicuo: 'Grupo estirado en diagonal',
  repartido: 'Disparos repartidos por la diana',
  gatillazo: 'Grupo bajo por el disparador',
  miras: 'Grupo descentrado (miras)',
};

export interface Mejora {
  tipo: TipoFallo;
  que: string; // lo que se ve en la diana
  porque: string; // la causa más habitual
  hacer: string; // qué probar en el próximo entreno
}

export interface Conclusion {
  bien: string[];
  mejorar: Mejora[]; // en orden: lo primero es lo más importante
  sinPosicion: boolean; // no hay impactos marcados en la diana: solo se analizan los puntos
}

export function conclusion(sesion: Sesion, arma: Arma | undefined, mano: Mano = 'diestro'): Conclusion {
  const { diana, calibre } = geometria(sesion);
  const series = sesion.series.filter((s) => s.disparos.length);
  const todos = series.flatMap((s) => s.disparos);
  const bien: string[] = [];
  const mejorar: Mejora[] = [];

  // Regularidad entre series (no hace falta saber dónde entró cada disparo). Solo se avisa si la diferencia
  // es mayor de lo que da el azar con series de ese tamaño (la media de n disparos varía ≈ desviación / √n).
  const conSeries = series.filter((s) => s.disparos.length >= 3);
  if (conSeries.length >= 2) {
    const medias = conSeries.map((s) => sumaSerie(s) / s.disparos.length);
    const dif = Math.max(...medias) - Math.min(...medias);
    const valores = conSeries.flatMap((s) => s.disparos.map((d) => d.valor));
    const mv = valores.reduce((t, v) => t + v, 0) / valores.length;
    const desv = Math.sqrt(valores.reduce((t, v) => t + (v - mv) ** 2, 0) / valores.length);
    const azar = (3.5 * desv) / Math.sqrt(valores.length / conSeries.length);
    if (dif <= 0.3) bien.push('Eres regular: todas tus series se parecen.');
    else if (dif > Math.max(0.5, azar)) {
      const mitad = Math.floor(medias.length / 2);
      const bajaAlFinal = mitad >= 2 && medias.slice(-mitad).reduce((t, v) => t + v, 0) < medias.slice(0, mitad).reduce((t, v) => t + v, 0) - 0.4 * mitad;
      mejorar.push(bajaAlFinal
        ? {
            tipo: 'cansancio',
            que: 'Las últimas series te salen peor que las primeras.',
            porque: 'Suele ser cansancio: el brazo y la vista se fatigan y pierdes concentración.',
            hacer: 'Descansa un par de minutos entre series, baja el arma si no sale el disparo y trabaja la forma física del brazo.',
          }
        : {
            tipo: 'irregular',
            que: 'Unas series te salen mucho mejor que otras.',
            porque: 'Cambias algo de una serie a otra: la postura, el agarre o la concentración.',
            hacer: 'Antes de cada serie repite la misma rutina: misma colocación de pies, mismo agarre, respira y empieza.',
          });
    }
  }

  const m = medidas(todos);
  if (!m || m.n < MIN_IMPACTOS) return { bien, mejorar, sinPosicion: true };

  // 1) Constancia: dos grupos, centro que se mueve entre series, disparos sueltos.
  const dos = dosGrupos(todos);
  const cs = centrosSeries(series);
  // Si hay dos grupos o el centro se mueve, el grupo se estira por eso: no se lee la forma.
  const f = dos || cs.seMueve ? { forma: 'redondo' as const } : forma(todos);
  // En un grupo alargado, los extremos no son disparos sueltos.
  const sx = dos || cs.seMueve || f.forma !== 'redondo' ? [] : sueltos(series);
  if (cs.seMueve) {
    mejorar.push({
      tipo: 'centroSeMueve',
      que: 'El centro de tus disparos cambia de una serie a otra.',
      porque: 'Entre series cambias la postura o el agarre del arma.',
      hacer: 'Busca tu postura natural: colócate, cierra los ojos un momento, ábrelos y mira si sigues apuntando al centro. Si no, mueve los pies, no el brazo.',
    });
  } else if (dos) {
    mejorar.push({
      tipo: 'dosGrupos',
      que: 'Hay dos grupos separados en la diana.',
      porque: 'Has cambiado de postura o de agarre a mitad (por ejemplo, al recargar o tras un fallo): cada postura hace su propio grupo.',
      hacer: 'Después de recargar, vuelve a colocarte igual que al principio: pies, agarre y apoyo. Si hace falta, márcate la posición de los pies.',
    });
  } else if (cs.centros.length >= 3) {
    bien.push('Mantienes el mismo centro serie tras serie: tu postura y tu agarre son constantes.');
  }
  if (sx.length) {
    const alEmpezar = sx.every((x) => x.enSerie === 0);
    const alFinal = sx.every((x) => x.enSerie === x.deSerie - 1);
    mejorar.push({
      tipo: 'sueltos',
      que: sx.length === 1 ? 'Un disparo se ha ido lejos del grupo.' : `${sx.length} disparos se han ido lejos del grupo.`,
      porque: alEmpezar
        ? 'Ha sido el primer disparo de la serie: puede que no estuvieras asentado o que te pillara el retroceso.'
        : alFinal
          ? 'Ha sido el último disparo de la serie: suele ser cansancio o prisa por terminar.'
          : 'Suele ser un tirón: el disparo sale antes de tiempo (por un ruido del puesto de al lado o por forzar el disparador).',
      hacer: 'Si no lo ves claro, baja el arma y vuelve a empezar. Aprieta el disparador poco a poco, sin decidir el momento exacto en que sale.',
    });
  } else if (!dos && !cs.seMueve && f.forma === 'redondo' && m.n >= 6) {
    bien.push('No se te escapa ningún disparo del grupo.');
  }

  // 2) Tamaño y forma del grupo.
  const anillo = anilloDondeCabe(m.cep50 * 2 + calibre, diana);
  if (anillo !== null && anillo >= 9) {
    bien.push(`Agrupas bien: la mitad de tus disparos caben en un círculo del tamaño del ${anillo}.`);
  }
  if (f.forma === 'vertical') {
    mejorar.push({
      tipo: 'vertical',
      que: 'El grupo se estira de arriba abajo.',
      porque: 'Lo más habitual: no igualas bien la altura del punto de mira con el alza, respiras mientras disparas o aprietas el agarre unas veces más que otras.',
      hacer: 'Fíjate en que el punto de mira quede justo a la altura del alza. Suelta la mitad del aire y quédate quieto antes de disparar. Agarra siempre con la misma fuerza.',
    });
  } else if (f.forma === 'horizontal') {
    mejorar.push({
      tipo: 'horizontal',
      que: 'El grupo se estira de lado a lado.',
      porque: 'Tu postura no apunta sola al centro y tienes que forzar el brazo de lado; también puede ser el agarre.',
      hacer: 'Colócate de forma que, con el brazo relajado, el arma apunte sola al centro (mueve los pies, no el brazo). Revisa que el agarre sea el mismo en cada disparo.',
    });
  } else if (f.forma === 'oblicuo') {
    mejorar.push({
      tipo: 'oblicuo',
      que: 'El grupo se estira en diagonal.',
      porque: 'Mezcla de las dos cosas: postura que obliga a forzar el brazo y altura de las miras o respiración.',
      hacer: 'Primero revisa la postura (que el arma apunte sola al centro) y después la respiración y la imagen de miras.',
    });
  } else if (anillo === null || anillo <= 7) {
    mejorar.push({
      tipo: 'repartido',
      que: 'Los disparos quedan repartidos por toda la diana.',
      porque: 'Falta constancia: algo cambia entre disparo y disparo (postura, agarre, cómo aprietas el disparador o dónde miras justo antes de disparar).',
      hacer: 'Haz series cortas y despacio, cuidando una sola cosa cada vez: primero el agarre, luego el disparador. Mira las miras, no la diana, al disparar.',
    });
  } else if (!dos && !cs.seMueve && !sx.length) {
    bien.push('Tu grupo es redondo: no tiras hacia un lado concreto.');
  }

  // 3) Dónde está el grupo. Se deja para el final: primero hay que agrupar y luego corregir miras.
  if (desplazado(m, diana)) {
    const lado = direccion(m.cx, m.cy);
    const ganas = puntosSiCentrado(todos, m, calibre, diana);
    const c = correccion(m.cx, m.cy, sesion.distancia, arma?.clic);
    const ajuste = [
      Math.abs(m.cx) >= 2 ? textoCorreccion(c.horizontal, 'h', arma?.clic) : '',
      Math.abs(m.cy) >= 2 ? textoCorreccion(c.vertical, 'v', arma?.clic) : '',
    ].filter(Boolean).join(' y ');
    // Diestro: abajo a la izquierda suele ser gatillazo. Zurdo: abajo a la derecha.
    const gatillazo = m.cy > 0 && (mano === 'zurdo' ? m.cx > 0 : m.cx < 0) && Math.abs(m.cx) > Math.abs(m.cy) * 0.3;
    mejorar.push({
      tipo: gatillazo ? 'gatillazo' : 'miras',
      que: `Tu grupo queda ${lado} del centro${ganas > 0 ? `: centrado habrías hecho ${ganas} ${ganas === 1 ? 'punto' : 'puntos'} más` : ''}.`,
      porque: gatillazo
        ? `En un tirador ${mano} el grupo bajo y a la ${mano === 'zurdo' ? 'derecha' : 'izquierda'} suele ser apretar el disparador de golpe o con demasiada fuerza. Si no, son las miras.`
        : 'Si te pasa en todos los entrenos, son las miras: no están ajustadas para ti a esta distancia.',
      hacer: gatillazo
        ? `Aprieta el disparador recto hacia atrás y poco a poco, con la yema del dedo. Si aun así sigue pasando, mueve las miras: ${ajuste}.`
        : `Si se repite, mueve las miras ${ajuste}. El alza (o la torreta del visor) se mueve hacia donde quieres llevar los disparos.`,
    });
  } else {
    bien.push('Tu grupo está centrado: las miras están bien ajustadas.');
  }

  return { bien, mejorar, sinPosicion: false };
}
