import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { aMm, Vigia, type Calibracion, type Gris } from '@/lib/impactos';
import { colors, radius, space } from '@/theme';
import type { PropsCamaraDiana } from './CamaraDiana.types';

const ANCHO = 640; // ancho de la imagen que se analiza (más, para ver los agujeros de .22 por el catalejo)
const CADA_MS = 450; // cada cuánto se mira la diana
const ESPERA_MS = 400; // al girar el móvil, el iPhone tarda un poco en girar también la cámara

/** Giro manual guardado (grados), uno para vertical y otro para horizontal. */
const claveGiro = (horizontal?: boolean) => `camaraGiro-${horizontal ? 'h' : 'v'}`;
function leerGiro(horizontal?: boolean): number {
  try {
    return Number(localStorage.getItem(claveGiro(horizontal))) || 0;
  } catch {
    return 0;
  }
}
function guardarGiro(horizontal: boolean | undefined, grados: number) {
  try {
    localStorage.setItem(claveGiro(horizontal), String(grados));
  } catch {}
}

/** Cuánto está girada la pantalla respecto al móvil en vertical (90 o 270 en horizontal). */
function anguloPantalla(): number {
  const a = screen.orientation?.angle ?? Number((window as { orientation?: number }).orientation ?? 0);
  return ((a % 360) + 360) % 360;
}

type Estado = 'arrancando' | 'sin-permiso' | 'sin-camara' | 'buscando' | 'calibrando' | 'vigilando';

const TEXTOS: Record<Estado, string> = {
  arrancando: 'Abriendo la cámara…',
  'sin-permiso': 'No tengo permiso para la cámara. En Safari: aA › Ajustes del sitio web › Cámara › Permitir. Después toca Reintentar.',
  'sin-camara': 'No se ha podido abrir la cámara (puede que otra app la esté usando). Toca Reintentar.',
  buscando: 'Busco la diana: tiene que verse el círculo negro entero. Si no está en medio, toca su centro en la imagen.',
  calibrando: 'Diana encontrada. Mantén el móvil quieto…',
  vigilando: 'Listo: dispara. Si se salta un disparo, tócalo en la imagen.',
};

/**
 * Vídeo de la cámara trasera (con el móvil en el catalejo) que vigila la diana y avisa de cada
 * impacto nuevo con su posición en mm. Todo se procesa en el móvil; no se guarda el vídeo.
 */
export function CamaraDiana({ activo, horizontal, modelo, calibre, soloVer, alto, onImpacto }: PropsCamaraDiana) {
  const { height: altoPantalla } = useWindowDimensions();
  const caja = useRef<unknown>(null); // en la web, el elemento del DOM de la vista
  const [estado, setEstado] = useState<Estado>('arrancando');
  const [ultimo, setUltimo] = useState<number | null>(null);
  const [intento, setIntento] = useState(0); // «Reintentar» vuelve a pedir la cámara
  // Giro que añade la persona con el botón «Girar», por si el automático no acierta.
  const giroManual = useRef(leerGiro(horizontal));
  // Visor: aumento digital para ver mejor los agujeros pequeños.
  const [zoom, setZoom] = useState(1);
  const aumento = useRef(1);
  useEffect(() => {
    aumento.current = zoom;
  }, [zoom]);
  const vigia = useRef(new Vigia(modelo, calibre));
  const modeloRef = useRef(modelo);
  const marcas = useRef<{ x: number; y: number }[]>([]); // impactos vistos, en píxeles de la imagen analizada
  // Siempre la última versión de las props, sin reiniciar la cámara.
  const props = useRef({ activo, onImpacto, horizontal, soloVer });
  useEffect(() => {
    props.current = { activo, onImpacto, horizontal, soloVer };
  });

  useEffect(() => {
    const raiz = caja.current as unknown as HTMLElement | null;
    if (!raiz) return;
    const video = document.createElement('video');
    video.playsInline = true;
    video.muted = true;
    video.autoplay = true;
    video.setAttribute('playsinline', '');
    // El vídeo no recibe toques: en Safari, girado o ampliado, puede salirse de su caja aunque no se
    // vea y tapar lo que hay debajo (la diana donde se marcan los disparos).
    Object.assign(video.style, { position: 'absolute', left: '50%', top: '50%', objectFit: 'contain', display: 'block', pointerEvents: 'none' });
    Object.assign(raiz.style, { clipPath: 'inset(0)' });
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
    let forma = ''; // tamaño y giro de la imagen con los que se calibró
    let mapa: { ox: number; oy: number; k: number } | null = null; // de la imagen analizada a la capa

    // Un toque en la imagen: antes de encontrar la diana, dice dónde está; después, marca a mano un
    // disparo que la cámara no ha visto.
    const toque = (e: MouseEvent) => {
      if (!mapa || props.current.soloVer) return;
      const caja = capa.getBoundingClientRect();
      const x = ((e.clientX - caja.left) * devicePixelRatio - mapa.ox) / mapa.k;
      const y = ((e.clientY - caja.top) * devicePixelRatio - mapa.oy) / mapa.k;
      const v = vigia.current;
      if (!v.cal) {
        v.centro = { x, y };
        setEstado('buscando');
        return;
      }
      if (!props.current.activo) return;
      const mm = aMm(v.cal, x, y, modeloRef.current);
      impactos.push({ x, y });
      v.marcadoAMano();
      props.current.onImpacto(mm.x, mm.y);
    };
    raiz.addEventListener('click', toque);

    // Con el móvil en horizontal, el iPhone a veces sigue dando la imagen de la cámara en vertical
    // (sobre todo en la app de la pantalla de inicio): se gira aquí para que la diana se vea derecha.
    const giro = () => {
      const W = video.videoWidth, H = video.videoHeight;
      const auto = props.current.horizontal && H > W ? 360 - anguloPantalla() : 0;
      return (auto + giroManual.current) % 360;
    };
    // Tamaño de la imagen ya girada.
    const medidas = (g: number) => (g % 180 ? { W: video.videoHeight, H: video.videoWidth } : { W: video.videoWidth, H: video.videoHeight });

    // El vídeo se gira con CSS dentro de la caja; si va de lado, su ancho es el alto de la caja.
    const encajar = (g: number) => {
      const { width, height } = raiz.getBoundingClientRect();
      const [w, h] = g % 180 ? [height, width] : [width, height];
      Object.assign(video.style, { width: `${w}px`, height: `${h}px`, transform: `translate(-50%, -50%) rotate(${g}deg) scale(${aumento.current})` });
    };

    const dibujar = (g: number, cal?: Calibracion) => {
      const { W, H } = medidas(g);
      if (!W) return;
      // La capa usa las mismas coordenadas que el vídeo; se encaja igual (contain).
      const caja = capa.getBoundingClientRect();
      capa.width = caja.width * devicePixelRatio;
      capa.height = caja.height * devicePixelRatio;
      const k = Math.min(capa.width / W, capa.height / H);
      const ox = (capa.width - W * k) / 2, oy = (capa.height - H * k) / 2;
      const a = W / ANCHO; // de la imagen analizada al vídeo
      mapa = { ox, oy, k: a * k };
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
      if (!video.videoWidth || video.readyState < 2) return;
      const gr = giro();
      const { W, H } = medidas(gr);
      encajar(gr);
      if (props.current.soloVer) return;
      // Si la imagen cambia de forma o de giro, la calibración anterior ya no vale.
      const ahora = `${W}x${H}@${gr}`;
      if (forma && ahora !== forma) {
        vigia.current.reiniciar();
        impactos.length = 0;
      }
      forma = ahora;
      const h = Math.round((H / W) * ANCHO);
      lienzo.width = ANCHO;
      lienzo.height = h;
      const e = ANCHO / W; // de la imagen girada a la analizada
      ctx.save();
      ctx.translate(ANCHO / 2, h / 2);
      ctx.rotate((gr * Math.PI) / 180);
      ctx.drawImage(video, (-video.videoWidth * e) / 2, (-video.videoHeight * e) / 2, video.videoWidth * e, video.videoHeight * e);
      ctx.restore();
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
      dibujar(gr, r.cal ?? vigia.current.cal ?? undefined);
    };

    // Sin cámara en el navegador (o sin HTTPS), getUserMedia no existe: se trata como un permiso denegado.
    new Promise((ok) => setTimeout(ok, ESPERA_MS))
      .then(() => navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }))
      .then((s) => {
        if (!vivo) return s.getTracks().forEach((t) => t.stop());
        flujo = s;
        video.srcObject = s;
        encajar(giro());
        setEstado('buscando');
        reloj = setInterval(mirar, props.current.soloVer ? 250 : CADA_MS);
        // Si el vídeo no arranca solo (autoplay), no es un problema de permiso: se sigue intentando.
        video.play().catch((e) => console.warn('El vídeo no arranca solo', e));
      })
      .catch((e) => {
        console.warn('No se pudo abrir la cámara', e);
        const nombre = (e as { name?: string })?.name;
        setEstado(nombre === 'NotAllowedError' || nombre === 'SecurityError' || !navigator.mediaDevices ? 'sin-permiso' : 'sin-camara');
      });

    return () => {
      vivo = false;
      raiz.removeEventListener('click', toque);
      clearInterval(reloj);
      flujo?.getTracks().forEach((t) => t.stop());
      video.remove();
      capa.remove();
    };
  }, [intento]);

  const ok = estado === 'vigilando';
  const fallo = estado === 'sin-permiso' || estado === 'sin-camara';
  const enMarcha = estado !== 'arrancando' && !fallo;
  return (
    <View style={st.marco}>
      <View ref={caja as never} style={alto ? [st.videoHorizontal, { height: alto }] : horizontal ? [st.videoHorizontal, { height: Math.max(160, altoPantalla - 170) }] : st.video} />
      <View style={st.pie}>
        {(estado === 'arrancando' || estado === 'calibrando') && <ActivityIndicator color={colors.accent} />}
        <Text style={[st.texto, ok && { color: colors.green }]}>
          {soloVer
            ? enMarcha ? 'Visor del catalejo' : TEXTOS[estado]
            : !activo && ok ? 'Serie completa: pasa a la siguiente para seguir contando.' : TEXTOS[estado]}
          {ultimo !== null && ok ? `  Último: ${ultimo}` : ''}
        </Text>
        {soloVer && enMarcha && (
          <Pressable hitSlop={8} onPress={() => setZoom((z) => (z >= 3 ? 1 : z + 1))} accessibilityLabel="Ampliar la imagen">
            <Text style={st.boton}>Ampliar {zoom}×</Text>
          </Pressable>
        )}
        {!soloVer && (ok || estado === 'calibrando') && (
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
        {fallo && (
          <Pressable
            hitSlop={8}
            onPress={() => {
              setEstado('arrancando');
              setIntento((n) => n + 1);
            }}
            accessibilityLabel="Volver a pedir la cámara"
          >
            <Text style={st.boton}>Reintentar</Text>
          </Pressable>
        )}
        {enMarcha && (
          <Pressable
            hitSlop={8}
            onPress={() => {
              giroManual.current = (giroManual.current + 90) % 360;
              guardarGiro(horizontal, giroManual.current);
              setEstado('buscando');
            }}
            accessibilityLabel="Girar la imagen de la cámara"
          >
            <Text style={st.boton}>Girar</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  marco: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000', borderWidth: 1, borderColor: colors.border },
  video: { width: '100%', aspectRatio: 3 / 4, position: 'relative', overflow: 'hidden' },
  videoHorizontal: { width: '100%', position: 'relative', overflow: 'hidden' },
  pie: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, backgroundColor: colors.card },
  texto: { flex: 1, color: colors.text, fontSize: 14 },
  boton: { color: colors.accent, fontWeight: '700' },
});
