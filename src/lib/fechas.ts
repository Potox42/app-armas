const DIA = 24 * 60 * 60 * 1000;

export function hoyISO(): string {
  return aISO(new Date());
}

export function aISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function deISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function sumarDias(iso: string, dias: number): string {
  const d = deISO(iso);
  d.setDate(d.getDate() + dias);
  return aISO(d);
}

export function sumarAnios(iso: string, anios: number): string {
  const d = deISO(iso);
  d.setFullYear(d.getFullYear() + anios);
  return aISO(d);
}

export function diasHasta(iso: string, desde: string = hoyISO()): number {
  return Math.round((deISO(iso).getTime() - deISO(desde).getTime()) / DIA);
}

export function formatear(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function mesAnio(iso: string): string {
  const d = deISO(iso);
  return `${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

/** "Caducada hace 3 días", "Caduca en 92 días", "En 6 meses", "En 2 años" */
export function plazo(iso: string, verbo = 'Caduca'): string {
  const dias = diasHasta(iso);
  if (dias < 0) return `Caducada hace ${-dias} días`;
  if (dias === 0) return `${verbo} hoy`;
  if (dias <= 120) return `${verbo} en ${dias} días`;
  if (dias < 730) return `En ${Math.round(dias / 30)} meses`;
  return `En ${Math.floor(dias / 365)} años`;
}
