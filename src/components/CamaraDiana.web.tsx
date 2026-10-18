import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Vigia, type Calibracion, type Gris } from '@/lib/impactos';
import { colors, radius, space } from '@/theme';
import type { PropsCamaraDiana } from './CamaraDiana.types';

const ANCHO = 480; // ancho de la imagen que se analiza
const CADA_MS = 450; // cada cuánto se mira la diana

type Estado = 'arrancando' | 'sin-permiso' | 'buscando' | 'calibrando' | 'vigilando';

const TEXTOS: Record<Estado, string> = {
  arrancando: 'Abriendo la cámara…',
  'sin-permiso': 'No puedo usar la cámara. Permite el acceso a la cámara en Safari (aA › Ajustes del sitio web).',
  buscando: 'Apunta al centro de la diana: tiene que verse el círculo negro entero.',
  calibrando: 'Diana encontrada. Mantén el móvil quieto…',
  vigilando: 'Listo: dispara. Cada impacto se apunta solo.',
};

/**
 * Vídeo de la cámara trasera (con el móvil en el catalejo) que vigila la diana y avisa de cada
 * impacto nuevo con su posición en mm. Todo se procesa en el móvil; no se guarda el vídeo.
 */
export function CamaraDiana({ activo, horizontal, modelo, calibre, onImpacto }: PropsCamaraDiana) {
  const { height: altoPantalla } = useWindowDimensions();
  const caja = useRef<unknown>(null); // en la web, el elemento del DOM de la vista
  const [estado, setEstado] = useState<Estado>('arrancando');
  const [ultimo, setUltimo] = useState<number | null>(null);
  const vigia = useRef(new Vigia(modelo, calibre));
  const marcas = useRef<{ x: number; y: number }[]>([]); // impactos vistos, en píxeles de la imagen analizada
  // Siempre la última versión de las props, sin reiniciar la cámara.
  const props = useRef({ activo, onImpacto });
  useEffect(() => {
    props.current = { activo, onImpacto };
  });

  useEffect(() => {
    const raiz = caja.current as unknown as HTMLElement | null;
    if (!raiz) return;
    const video = document.createElement('video');
    video.playsInline = true;
    video.muted = true;
    video.autoplay = true;
    video.setAttribute('playsinline', '');
    Object.assign(video.style, { width: '100%', height: '100%', objectFit: 'contain', display: 'block' });
    const capa = document.createElement('canvas');
    Object.assign(capa.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' });
    raiz.appendChild(video);
    raiz.appendChild(capa);
    const lienzo = document.createElement('canvas');
    const ctx = lienzo.getContext('2d', { willReadFrequently: true })!;
    const impactos = marcas.current;
    let flujo: MediaStream | null = null;
    let reloj: ReturnType<typeof setInterval> | undefined;
    let vivo = true;

    const dibujar = (cal?: Calibracion) => {
      const W = video.videoWidth, H = video.videoHeight;
      if (!W) return;
      // La capa usa las mismas coordenadas que el vídeo; se encaja igual (contain).
      const caja = capa.getBoundingClientRect();
      capa.width = caja.width * devicePixelRatio;
      capa.height = caja.height * devicePixelRatio;
      const k = Math.min(capa.width / W, capa.height / H);
      const ox = (capa.width - W * k) / 2, oy = (capa.height - H * k) / 2;
      const a = W / ANCHO; // de la imagen analizada al vídeo
      const c = capa.getContext('2d')!;
      c.clearRect(0, 0, capa.width, capa.height);
      if (cal) {
        c.strokeStyle = vigia.current.cal ? '#2ECC71' : '#F5A623';
        c.lineWidth = 3 * devicePixelRatio;
        c.beginPath();
        c.ellipse(ox + cal.cx * a * k, oy + cal.cy * a * k, cal.rx * a * k, cal.ry * a * k, 0, 0, Math.PI * 2);
        c.stroke();
      }
      c.fillStyle = '#FF3B30';
      for (const p of impactos) {
        c.beginPath();
        c.arc(ox + p.x * a * k, oy + p.y * a * k, 6 * devicePixelRatio, 0, Math.PI * 2);
        c.fill();
      }
    };

    const mirar = () => {
      const W = video.videoWidth, H = video.videoHeight;
      if (!W || video.readyState < 2) return;
      const h = Math.round((H / W) * ANCHO);
      lienzo.width = ANCHO;
      lienzo.height = h;
      ctx.drawImage(video, 0, 0, ANCHO, h);
      const px = ctx.getImageData(0, 0, ANCHO, h).data;
      const d = new Float32Array(ANCHO * h);
      for (let i = 0; i < d.length; i++) d[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
      const g: Gris = { w: ANCHO, h, d };
      const r = vigia.current.procesar(g);
      setEstado(r.estado);
      if (r.impacto && props.current.activo) {
        impactos.push({ x: r.impacto.xPx, y: r.impacto.yPx });
        setUltimo(r.impacto.valor);
        props.current.onImpacto(r.impacto.x, r.impacto.y);
      }
      dibujar(r.cal ?? vigia.current.cal ?? undefined);
    };

    // Sin cámara en el navegador (o sin HTTPS), getUserMedia no existe: se trata como un permiso denegado.
    Promise.resolve()
      .then(() => navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }))
      .then((s) => {
        if (!vivo) return s.getTracks().forEach((t) => t.stop());
        flujo = s;
        video.srcObject = s;
        return video.play().then(() => {
          setEstado('buscando');
          reloj = setInterval(mirar, CADA_MS);
        });
      })
      .catch((e) => {
        console.warn('No se pudo abrir la cámara', e);
        setEstado('sin-permiso');
      });

    return () => {
      vivo = false;
      clearInterval(reloj);
      flujo?.getTracks().forEach((t) => t.stop());
      video.remove();
      capa.remove();
    };
  }, []);

  const ok = estado === 'vigilando';
  return (
    <View style={st.marco}>
      <View ref={caja as never} style={horizontal ? [st.videoHorizontal, { height: Math.max(160, altoPantalla - 170) }] : st.video} />
      <View style={st.pie}>
        {(estado === 'arrancando' || estado === 'calibrando') && <ActivityIndicator color={colors.accent} />}
        <Text style={[st.texto, ok && { color: colors.green }]}>
          {!activo && ok ? 'Serie completa: pasa a la siguiente para seguir contando.' : TEXTOS[estado]}
          {ultimo !== null && ok ? `  Último: ${ultimo}` : ''}
        </Text>
        {(ok || estado === 'calibrando') && (
          <Pressable
            hitSlop={8}
            onPress={() => {
              vigia.current.reiniciar();
              marcas.current.length = 0;
              setEstado('buscando');
            }}
            accessibilityLabel="Volver a buscar la diana"
          >
            <Text style={st.boton}>Recolocar</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  marco: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000', borderWidth: 1, borderColor: colors.border },
  video: { width: '100%', aspectRatio: 3 / 4, position: 'relative' },
  videoHorizontal: { width: '100%', position: 'relative' },
  pie: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, backgroundColor: colors.card },
  texto: { flex: 1, color: colors.text, fontSize: 14 },
  boton: { color: colors.accent, fontWeight: '700' },
});
