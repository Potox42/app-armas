// Pitidos del simulador hechos con Web Audio (sin archivos de sonido).
// En Safari del iPhone el audio solo se puede activar con un toque: prepararPitidos() se llama
// desde el botón «Empezar». Con el tipo de sesión «playback» (Safari recientes) los pitidos
// deberían sonar aunque el iPhone esté en silencio; si no, hay que quitar el silencio.
export type Pitido = 'fuego' | 'alto' | 'cuenta' | 'aviso';

let ctx: AudioContext | null = null;

export function prepararPitidos() {
  try {
    const sesion = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (sesion) sesion.type = 'playback';
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    // Un sonido mudo dentro del toque deja el audio desbloqueado para el resto de la tirada.
    tono(440, 0, 0.01, 0);
  } catch {
    ctx = null;
  }
}

function tono(hz: number, desde: number, dura: number, volumen = 0.35) {
  if (!ctx) return;
  const t = ctx.currentTime + desde;
  const osc = ctx.createOscillator();
  const vol = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = hz;
  // Subida y bajada de 10 ms para que no chasquee.
  vol.gain.setValueAtTime(0, t);
  vol.gain.linearRampToValueAtTime(volumen, t + 0.01);
  vol.gain.setValueAtTime(volumen, t + dura - 0.01);
  vol.gain.linearRampToValueAtTime(0, t + dura);
  osc.connect(vol).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dura + 0.02);
}

export function pitar(tipo: Pitido) {
  if (!ctx) return;
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  switch (tipo) {
    case 'fuego': // pitido largo y agudo: a disparar
      tono(1320, 0, 0.6);
      break;
    case 'alto': // dos pitidos graves: se acabó el tiempo
      tono(520, 0, 0.25);
      tono(520, 0.35, 0.25);
      break;
    case 'cuenta': // pip corto: últimos segundos de la preparación
      tono(880, 0, 0.12, 0.25);
      break;
    case 'aviso': // tres pips rápidos: quedan 30 s de la serie
      tono(990, 0, 0.1, 0.3);
      tono(990, 0.18, 0.1, 0.3);
      tono(990, 0.36, 0.1, 0.3);
      break;
  }
}
