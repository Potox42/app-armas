import { puntuar } from '@/lib/diana';
import { hoyISO, sumarAnios, sumarDias } from '@/lib/fechas';
import type { Datos, Serie, Sesion } from './types';

// Datos ficticios para la vista previa. Las fechas se calculan desde hoy
// para que los avisos siempre se vean con sentido.
// Generador pseudoaleatorio con semilla: el ejemplo sale siempre igual.
function aleatorio(semilla: number) {
  let x = semilla;
  return () => ((x = (x * 9301 + 49297) % 233280) / 233280);
}

function seriesDeEjemplo(semilla: number, dispersion: number): Serie[] {
  const r = aleatorio(semilla);
  const normal = () => Math.sqrt(-2 * Math.log(r() || 1e-6)) * Math.cos(2 * Math.PI * r());
  return Array.from({ length: 6 }, () => ({
    disparos: Array.from({ length: 10 }, () => {
      const x = normal() * dispersion + 4;
      const y = normal() * dispersion - 6;
      return { x, y, valor: puntuar(x, y) };
    }),
  }));
}

function sesionesDeEjemplo(hoy: string): Sesion[] {
  // Un entrenamiento cada dos semanas durante seis meses, mejorando poco a poco.
  return Array.from({ length: 13 }, (_, i) => {
    const semilla = 11 + i * 7;
    return {
      dias: -3 - i * 14,
      dispersion: 30 + i * 1.2,
      semilla,
      armaId: i % 4 === 2 ? 'pardini-sp' : 'walther-p22',
    };
  }).map(({ dias, dispersion, semilla, armaId }) => ({
    id: `ejemplo-${semilla}`,
    fecha: `${sumarDias(hoy, dias)}T10:14:00`,
    armaId,
    modalidad: 'Precisión',
    distancia: 25,
    municion: 'RWS R50 .22 LR',
    disparosPorSerie: 10,
    series: seriesDeEjemplo(semilla, dispersion),
    terminada: true,
  }));
}

export function datosDeEjemplo(): Datos {
  const hoy = hoyISO();
  const cadF = sumarDias(hoy, 92);
  const cadD = sumarDias(hoy, 570);
  const cadE = sumarDias(hoy, 890);

  return {
    nombre: 'Rubén',
    permiso: {
      numero: '12345678-Z',
      expedicion: sumarAnios(cadE, -5),
      licencias: [
        { id: 'lic-e', tipo: 'E', expedicion: sumarAnios(cadE, -5), caducidad: cadE },
        { id: 'lic-f', tipo: 'F', categoria: '3', expedicion: sumarAnios(cadF, -5), caducidad: cadF },
        { id: 'lic-d', tipo: 'D', expedicion: sumarAnios(cadD, -5), caducidad: cadD },
      ],
    },
    armas: [
      {
        id: 'walther-p22',
        marca: 'Walther',
        modelo: 'P22',
        tipo: 'Pistola',
        calibre: '.22 LR',
        numeroSerie: 'WA123456',
        numeroGuia: '1234567-A',
        fechaGuia: sumarAnios(hoy, -4),
        licenciaId: 'lic-f',
        disparosTotales: 1842,
        intervaloLimpieza: 500,
        limpiezas: [
          { id: 'l4', fecha: sumarDias(hoy, -7), tipo: 'Completa', disparos: 1500 },
          { id: 'l3', fecha: sumarDias(hoy, -73), tipo: 'Básica', disparos: 1320 },
          { id: 'l2', fecha: sumarDias(hoy, -123), tipo: 'Completa', disparos: 820 },
          { id: 'l1', fecha: sumarDias(hoy, -190), tipo: 'Básica', disparos: 320 },
        ],
      },
      {
        id: 'pardini-sp',
        marca: 'Pardini',
        modelo: 'SP',
        tipo: 'Pistola',
        calibre: '.22 LR',
        numeroSerie: 'PA998877',
        numeroGuia: '2345678-B',
        fechaGuia: sumarAnios(hoy, -3),
        licenciaId: 'lic-f',
        disparosTotales: 3210,
        intervaloLimpieza: 500,
        limpiezas: [
          { id: 'p1', fecha: sumarDias(hoy, -40), tipo: 'Completa', disparos: 2780 },
        ],
      },
      {
        id: 'anschutz-1907',
        marca: 'Anschütz',
        modelo: '1907',
        tipo: 'Carabina',
        calibre: '.22 LR',
        numeroSerie: 'AN554433',
        numeroGuia: '3456789-C',
        fechaGuia: sumarAnios(hoy, -2),
        licenciaId: 'lic-f',
        disparosTotales: 2450,
        intervaloLimpieza: 800,
        limpiezas: [
          { id: 'a1', fecha: sumarDias(hoy, -20), tipo: 'Completa', disparos: 2300 },
        ],
      },
    ],
    federacion: {
      nombre: 'Federación Madrileña de Tiro Olímpico',
      numeroFederado: '12345',
      categoria: 'Senior',
      caducidadCarnet: sumarDias(hoy, 118),
      codigoPase: 'FMTO-12345-2026',
      caducidadPase: sumarDias(hoy, 118),
    },
    sesiones: sesionesDeEjemplo(hoy),
    esEjemplo: true,
  };
}
