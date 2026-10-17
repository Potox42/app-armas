// La cámara de la web arranca a 640 × 480 en Safari: muy poca resolución para leer la letra
// pequeña de una tarjeta. Se pide al vídeo que suba a la mayor que admita el móvil.

const proporcion = (v: HTMLVideoElement) => (v.videoHeight ? v.videoWidth / v.videoHeight : 0);
const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

export async function subirResolucion() {
  const video = [...document.querySelectorAll('video')].find((v) => v.srcObject instanceof MediaStream);
  const pista = (video?.srcObject as MediaStream | undefined)?.getVideoTracks()[0];
  if (!video || !pista) return;
  const antes = proporcion(video);
  const originales = pista.getConstraints();
  // Misma forma que la imagen actual (para no recortar el campo de visión), con el lado largo a 1920.
  const { width = 640, height = 480 } = pista.getSettings();
  const k = 1920 / Math.max(width, height);
  if (k <= 1) return;
  try {
    await pista.applyConstraints({
      ...originales,
      width: { ideal: Math.round(width * k) },
      height: { ideal: Math.round(height * k) },
    });
    await esperar(600);
    // Si la imagen ha cambiado de forma, la vista previa ya no coincide con la foto: se deshace.
    if (antes && Math.abs(proporcion(video) / antes - 1) > 0.05) await pista.applyConstraints(originales);
  } catch (e) {
    console.warn('La cámara no admite más resolución', e);
  }
}

function pistaActual() {
  const video = [...document.querySelectorAll('video')].find((v) => v.srcObject instanceof MediaStream);
  return (video?.srcObject as MediaStream | undefined)?.getVideoTracks()[0];
}

/** ¿El navegador deja encender la linterna con la cámara abierta? (Safari no siempre lo permite). */
export function hayLinterna(): boolean {
  const caps = pistaActual()?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
  return !!caps?.torch;
}

/** Enciende o apaga la linterna; devuelve si ha quedado encendida. */
export async function linterna(encender: boolean): Promise<boolean> {
  const pista = pistaActual();
  if (!pista) return false;
  try {
    await pista.applyConstraints({ advanced: [{ torch: encender } as MediaTrackConstraintSet] });
    return encender;
  } catch {
    return false;
  }
}
