import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { DIANAS } from '@/lib/diana';
import { aMm, calibrar, Vigia, type Calibracion, type Gris } from '@/lib/impactos';
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

/**
 * Cámara elegida. Los iPhone Pro tienen tres cámaras traseras y Safari ofrece además cámaras
 * «virtuales» (dual, triple) que saltan solas de una a otra; pegadas al ocular del catalejo saltan
 * todo el rato (la de cerca, la ultra gran angular) y no se ve bien. Por eso se usa la normal (1×)
 * salvo que el tirador elija otra.
 */
const CLAVE_CAMARA = 'camaraId';
function leerCamara(): string {
  try {
    return localStorage.getItem(CLAVE_CAMARA) || '';
  } catch {
    return '';
  }
}
function guardarCamara(id: string) {
  try {
    if (id) localStorage.setItem(CLAVE_CAMARA, id);
    else localStorage.removeItem(CLAVE_CAMARA);
  } catch {}
}
interface Camara { id: string; nombre: string; virtual: boolean }

/** Aumento elegido (como en la cámara del iPhone: 0,5×, 1×, 2×, Tele…), guardado para la próxima vez. */
const CLAVE_ZOOM = 'camaraZoom';
function leerZoom(): number {
  try {
    return Number(localStorage.getItem(CLAVE_ZOOM)) || 1;
  } catch {
    return 1;
  }
}
function guardarZoom(z: number) {
  try {
    localStorage.setItem(CLAVE_ZOOM, String(z));
  } catch {}
}

/**
 * Niveles de aumento, de menos a más. Por debajo de 1× solo se puede con la cámara ultra gran angular
 * (la del 0,5× del iPhone); entre medias se amplía la imagen. La Tele es la cámara de 3× o 5×.
 */
interface Nivel { camara: string; zoom: number; texto: string }
function nivelesDe(camaras: Camara[], abierta: string): Nivel[] {
  const fisicas = camaras.filter((c) => !c.virtual);
  const ultra = fisicas.find((c) => nombreCorto(c.nombre) === '0,5×');
  const tele = fisicas.find((c) => nombreCorto(c.nombre) === 'Tele');
  const normal = fisicas.find((c) => nombreCorto(c.nombre) === '1×');
  const n: Nivel[] = [];
  if (ultra) n.push({ camara: ultra.id, zoom: 1, texto: '0,5×' }, { camara: ultra.id, zoom: 1.4, texto: '0,7×' });
  const id = normal?.id ?? (ultra || tele ? '' : abierta);
  if (normal || !ultra || !tele) {
    n.push({ camara: id, zoom: 1, texto: '1×' }, { camara: id, zoom: 1.5, texto: '1,5×' }, { camara: id, zoom: 2, texto: '2×' });
    if (!tele) n.push({ camara: id, zoom: 3, texto: '3×' });
  }
  if (tele) n.push({ camara: tele.id, zoom: 1, texto: 'Tele' }, { camara: tele.id, zoom: 1.5, texto: 'Tele 1,5×' }, { camara: tele.id, zoom: 2, texto: 'Tele 2×' });
  return n;
}

// Pantalla completa: si se ha usado, vuelve sola al empezar la serie siguiente (también en otra diana).
const pantallaCompleta = { seguir: false };
const leerGrande = () => pantallaCompleta.seguir;
const recordarGrande = () => {
  pantallaCompleta.seguir = true;
};
const esFrontal = (l: string) => /front|frontal|delantera|facetime/i.test(l);
const esVirtual = (l: string) => /dual|triple|doble/i.test(l);
/** Nombre corto para el botón, a partir del nombre que da Safari (en español o en inglés). */
function nombreCorto(l: string): string {
  if (esVirtual(l)) return 'Auto';
  if (/ultra/i.test(l)) return '0,5×';
  if (/tele/i.test(l)) return 'Tele';
  return '1×';
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
  buscando: 'Encaja el negro de la diana dentro del círculo blanco, entero y lo más grande posible. Si no la encuentro, toca su centro en la imagen.',
  calibrando: 'Diana encontrada. Mantén el móvil quieto…',
  vigilando: 'Listo: dispara. Si se salta un disparo, tócalo en la imagen.',
};

/** Textos cortos para cuando van encima de la imagen (en horizontal), para que tapen poco. */
const CORTOS: Partial<Record<Estado, string>> = {
  buscando: 'Encaja la diana. Si no la encuentro, toca su centro.',
  calibrando: 'Diana encontrada. Quieto…',
  vigilando: 'Listo. Si falta un disparo, tócalo.',
};

/**
 * Vídeo de la cámara trasera (con el móvil en el catalejo) que vigila la diana y avisa de cada
 * impacto nuevo con su posición en mm. Todo se procesa en el móvil; no se guarda el vídeo.
 */
export function CamaraDiana({ activo, horizontal, modelo, calibre, soloVer, alto, disparos = [], marcador, serie, onImpacto }: PropsCamaraDiana) {
  const { height: altoPantalla } = useWindowDimensions();
  const caja = useRef<unknown>(null); // en la web, el elemento del DOM de la vista
  // Pantalla completa: el vídeo y sus marcas se pasan a una capa que tapa toda la pantalla (sin
  // cerrar la cámara, así no hay que volver a buscar la diana).
  const [quiereGrande, setQuiereGrande] = useState(leerGrande);
  const [reducidaEn, setReducidaEn] = useState<number | undefined | null>(null); // serie en la que se ha reducido
  // Al completar la serie se vuelve al tamaño normal para ver los resultados; en la siguiente, otra
  // vez a pantalla completa.
  const grande = quiereGrande && activo && !soloVer && reducidaEn !== serie;
  const reducir = () => setReducidaEn(serie);
  const contenedor = useRef<HTMLElement | null>(null); // donde está ahora el vídeo
  const nodoGrande = useRef<HTMLElement | null>(null); // la caja de pantalla completa, si está abierta
  const elementos = useRef<{ video: HTMLVideoElement; capa: HTMLCanvasElement } | null>(null);
  const toqueRef = useRef<((e: MouseEvent) => void) | null>(null);
  const pasarA = (destino: HTMLElement | null) => {
    const el = elementos.current;
    if (!destino || !el) return;
    destino.appendChild(el.video);
    destino.appendChild(el.capa);
    contenedor.current = destino;
    el.video.play().catch(() => {});
  };
  const enPantalla = useCallback((nodo: unknown) => {
    const n = nodo as HTMLElement | null;
    const pequena = caja.current as HTMLElement | null;
    nodoGrande.current = n;
    if (n) {
      Object.assign(n.style, { clipPath: 'inset(0)' });
      n.addEventListener('click', (e) => toqueRef.current?.(e));
      pasarA(n);
    } else {
      pasarA(pequena);
    }
  }, []);
  const [estado, setEstado] = useState<Estado>('arrancando');
  const [ultimo, setUltimo] = useState<number | null>(null);
  const [intento, setIntento] = useState(0); // «Reintentar» vuelve a pedir la cámara
  // Giro que añade la persona con el botón «Girar», por si el automático no acierta.
  const giroManual = useRef(leerGiro(horizontal));
  // Aumento digital (sobre la cámara elegida) para ver mejor los agujeros pequeños.
  const [zoom, setZoom] = useState(leerZoom);
  const aumento = useRef(1);
  // Cámaras traseras disponibles y la elegida.
  const [camaras, setCamaras] = useState<Camara[]>([]);
  const [camaraId, setCamaraId] = useState(leerCamara);
  const [enUso, setEnUso] = useState(''); // nombre de la cámara abierta
  useEffect(() => {
    aumento.current = zoom;
  }, [zoom]);
  const vigia = useRef(new Vigia(modelo, calibre));
  const modeloRef = useRef(modelo);
  // Siempre la última versión de las props, sin reiniciar la cámara.
  const props = useRef({ activo, onImpacto, horizontal, soloVer, disparos });
  useEffect(() => {
    props.current = { activo, onImpacto, horizontal, soloVer, disparos };
  });
  // Se pintan los disparos apuntados en la sesión (no los que ha visto la cámara): así, al pulsar
  // Deshacer, la marca desaparece también de la imagen. Lo que se ve ahora pasa a ser la referencia,
  // para que la cámara no vuelva a contar el agujero que se acaba de quitar.
  const cuantos = useRef(disparos.length);
  useEffect(() => {
    if (disparos.length < cuantos.current) vigia.current.marcadoAMano();
    cuantos.current = disparos.length;
  }, [disparos.length]);

  useEffect(() => {
    const raiz = caja.current as unknown as HTMLElement | null;
    if (!raiz) return;
    contenedor.current = raiz;
    // Otra cámara (al cambiar el aumento entre 0,5×, 1× y Tele) ve la diana de otro tamaño: se vuelve
    // a buscar. Los disparos ya apuntados se guardan en mm y se pintan en su sitio al encontrarla.
    vigia.current.reiniciar();
    // La caja en la que está el vídeo ahora (la pequeña o la de pantalla completa).
    const marco = () => contenedor.current ?? raiz;
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
    const destino = nodoGrande.current ?? raiz;
    destino.appendChild(video);
    destino.appendChild(capa);
    contenedor.current = destino;
    elementos.current = { video, capa };
    const lienzo = document.createElement('canvas');
    const ctx = lienzo.getContext('2d', { willReadFrequently: true })!;
    let flujo: MediaStream | null = null;
    let reloj: ReturnType<typeof setInterval> | undefined;
    let vivo = true;
    let forma = ''; // tamaño y giro de la imagen con los que se calibró
    let mapa: { ox: number; oy: number; k: number } | null = null; // de la imagen analizada a la capa
    // Qué punto de la imagen (en fracción del ancho y del alto) queda en medio al ampliar: la diana
    // si se encuentra, o donde toque el tirador. Así al ampliar no se pierde la diana.
    let foco: { fx: number; fy: number; mano: boolean } = { fx: 0.5, fy: 0.5, mano: false };
    let ultimoFoco = 0;

    // Un toque en la imagen: antes de encontrar la diana, dice dónde está; después, marca a mano un
    // disparo que la cámara no ha visto.
    const toque = (e: MouseEvent) => {
      if (props.current.soloVer) {
        // En el visor, el toque dice qué se quiere ver en medio al ampliar.
        const f = fraccion(e.clientX, e.clientY);
        if (f) { foco = { ...f, mano: true }; encajar(giro()); }
        return;
      }
      if (!mapa) return;
      // La capa puede estar ampliada (Ampliar): se pasa del toque a sus píxeles en proporción.
      const caja = capa.getBoundingClientRect();
      const x = (((e.clientX - caja.left) / caja.width) * capa.width - mapa.ox) / mapa.k;
      const y = (((e.clientY - caja.top) / caja.height) * capa.height - mapa.oy) / mapa.k;
      const v = vigia.current;
      if (!v.cal) {
        v.centro = { x, y };
        setEstado('buscando');
        return;
      }
      if (!props.current.activo) return;
      // Sobre la diana donde está ahora (si el móvil se ha movido un poco, no donde se fijó).
      const mm = aMm(v.actual ?? v.cal, x, y, modeloRef.current);
      v.marcadoAMano();
      props.current.onImpacto(mm.x, mm.y);
    };
    raiz.addEventListener('click', toque);
    toqueRef.current = toque;

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
    // Escala de la imagen girada a la caja (contain) y desplazamiento para centrar el foco al ampliar.
    const vista = (g: number) => {
      const { width, height } = marco().getBoundingClientRect();
      const { W, H } = medidas(g);
      const k = W && H ? Math.min(width / W, height / H) : 1;
      const z = aumento.current;
      const tx = z > 1 ? -(foco.fx - 0.5) * W * k * z : 0, ty = z > 1 ? -(foco.fy - 0.5) * H * k * z : 0;
      return { width, height, W, H, k, z, tx, ty };
    };
    const encajar = (g: number) => {
      const { width, height, z, tx, ty } = vista(g);
      const [w, h] = g % 180 ? [height, width] : [width, height];
      Object.assign(video.style, { width: `${w}px`, height: `${h}px`, transform: `translate(-50%, -50%) translate(${tx}px, ${ty}px) rotate(${g}deg) scale(${z})` });
      // Las marcas se amplían igual que el vídeo.
      Object.assign(capa.style, { transformOrigin: '50% 50%', transform: `translate(${tx}px, ${ty}px) scale(${z})` });
    };
    // De un toque en pantalla al punto de la imagen girada (en fracción), con el aumento puesto.
    const fraccion = (cx: number, cy: number) => {
      const r = marco().getBoundingClientRect();
      const { W, H, k, z, tx, ty } = vista(giro());
      if (!W || !H) return null;
      const fx = (cx - r.left - r.width / 2 - tx) / (z * k * W) + 0.5;
      const fy = (cy - r.top - r.height / 2 - ty) / (z * k * H) + 0.5;
      return { fx: Math.max(0, Math.min(1, fx)), fy: Math.max(0, Math.min(1, fy)) };
    };
    // En el visor, cada poco se busca la diana en una imagen pequeña para centrarla al ampliar.
    const buscarFoco = (g: number) => {
      const ahora = Date.now();
      if (foco.mano || ahora - ultimoFoco < 1000) return;
      ultimoFoco = ahora;
      const { W, H } = medidas(g);
      const ancho = 320, alto = Math.round((H / W) * ancho), e = ancho / W;
      lienzo.width = ancho;
      lienzo.height = alto;
      ctx.save();
      ctx.translate(ancho / 2, alto / 2);
      ctx.rotate((g * Math.PI) / 180);
      ctx.drawImage(video, (-video.videoWidth * e) / 2, (-video.videoHeight * e) / 2, video.videoWidth * e, video.videoHeight * e);
      ctx.restore();
      const px = ctx.getImageData(0, 0, ancho, alto).data;
      const d = new Float32Array(ancho * alto);
      for (let i = 0; i < d.length; i++) d[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
      const cal = calibrar({ w: ancho, h: alto, d }, 0.7);
      if (cal) foco = { fx: cal.cx / ancho, fy: cal.cy / alto, mano: false };
    };

    const dibujar = (g: number, cal?: Calibracion) => {
      const { W, H } = medidas(g);
      if (!W) return;
      // La capa usa las mismas coordenadas que el vídeo; se encaja igual (contain). Su tamaño es el de
      // la caja (la capa ampliada mide más en pantalla).
      const caja = marco().getBoundingClientRect();
      capa.width = caja.width * devicePixelRatio;
      capa.height = caja.height * devicePixelRatio;
      const k = Math.min(capa.width / W, capa.height / H);
      const ox = (capa.width - W * k) / 2, oy = (capa.height - H * k) / 2;
      const a = W / ANCHO; // de la imagen analizada al vídeo
      mapa = { ox, oy, k: a * k };
      const c = capa.getContext('2d')!;
      c.clearRect(0, 0, capa.width, capa.height);
      if (!cal && !props.current.soloVer) {
        // Guía mientras busca: el negro tiene que quedar entero dentro de este círculo (es la zona en
        // la que se busca). Si el tirador ha tocado el centro de la diana, el círculo va ahí.
        const h = Math.round((H / W) * ANCHO);
        const centro = vigia.current.centro ?? { x: ANCHO / 2, y: h / 2 };
        const r = 0.46 * Math.min(ANCHO, h) * a * k;
        const x = ox + centro.x * a * k, y = oy + centro.y * a * k;
        const dpr = devicePixelRatio;
        c.save();
        c.shadowColor = 'rgba(0,0,0,0.7)';
        c.shadowBlur = 4 * dpr;
        c.strokeStyle = 'rgba(255,255,255,0.9)';
        c.lineWidth = 2.5 * dpr;
        c.setLineDash([10 * dpr, 8 * dpr]);
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        c.stroke();
        c.setLineDash([]);
        const cruz = Math.min(18 * dpr, r * 0.15);
        c.beginPath();
        c.moveTo(x - cruz, y); c.lineTo(x + cruz, y);
        c.moveTo(x, y - cruz); c.lineTo(x, y + cruz);
        c.stroke();
        c.restore();
      }
      if (cal) {
        c.strokeStyle = vigia.current.cal ? '#2ECC71' : '#F5A623';
        c.lineWidth = 3 * devicePixelRatio;
        c.beginPath();
        c.ellipse(ox + cal.cx * a * k, oy + cal.cy * a * k, cal.rx * a * k, cal.ry * a * k, 0, 0, Math.PI * 2);
        c.stroke();
      }
      c.fillStyle = '#FF3B30';
      const cal0 = vigia.current.actual ?? vigia.current.cal, radio = (modeloRef.current ?? DIANAS.precision).negro / 2;
      for (const d of cal0 ? props.current.disparos.filter((d) => !d.sinPosicion) : []) {
        const p = { x: cal0!.cx + (d.x / radio) * cal0!.rx, y: cal0!.cy + (d.y / radio) * cal0!.ry };
        c.beginPath();
        c.arc(ox + p.x * a * k, oy + p.y * a * k, 6 * devicePixelRatio, 0, Math.PI * 2);
        c.fill();
      }
    };

    const mirar = () => {
      if (!video.videoWidth || video.readyState < 2) return;
      const gr = giro();
      const { W, H } = medidas(gr);
      if (props.current.soloVer) {
        if (aumento.current > 1) buscarFoco(gr);
        encajar(gr);
        return;
      }
      // Al ampliar, en medio queda la diana encontrada (salvo que el tirador haya tocado otro sitio).
      const fija = vigia.current.actual ?? vigia.current.cal;
      if (fija && !foco.mano) foco = { fx: fija.cx / ANCHO, fy: fija.cy / Math.round((H / W) * ANCHO), mano: false };
      encajar(gr);
      // Si la imagen cambia de forma o de giro, la calibración anterior ya no vale.
      const ahora = `${W}x${H}@${gr}`;
      if (forma && ahora !== forma) {
        vigia.current.reiniciar();
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
        setUltimo(r.impacto.valor);
        props.current.onImpacto(r.impacto.x, r.impacto.y);
      }
      dibujar(gr, r.cal ?? vigia.current.actual ?? vigia.current.cal ?? undefined);
    };

    // Sin cámara en el navegador (o sin HTTPS), getUserMedia no existe: se trata como un permiso denegado.
    new Promise((ok) => setTimeout(ok, ESPERA_MS))
      .then(() => navigator.mediaDevices.getUserMedia({
        video: { ...(camaraId ? { deviceId: { exact: camaraId } } : { facingMode: 'environment' }), width: { ideal: 1920 }, height: { ideal: 1440 } },
        audio: false,
      }))
      .then(async (s) => {
        if (!vivo) return s.getTracks().forEach((t) => t.stop());
        // Con el permiso dado, Safari ya dice el nombre de cada cámara.
        try {
          const lista = (await navigator.mediaDevices.enumerateDevices())
            .filter((d) => d.kind === 'videoinput' && d.label && !esFrontal(d.label))
            .map((d) => ({ id: d.deviceId, nombre: d.label, virtual: esVirtual(d.label) }));
          if (!vivo) return s.getTracks().forEach((t) => t.stop());
          setCamaras(lista);
          // Sin elegir ninguna, si ha salido una virtual (que salta de cámara) se pasa a la normal.
          const actual = s.getVideoTracks()[0]?.label ?? '';
          const normal = lista.find((c) => !c.virtual && nombreCorto(c.nombre) === '1×');
          if (!camaraId && esVirtual(actual) && normal) {
            s.getTracks().forEach((t) => t.stop());
            setCamaraId(normal.id);
            return;
          }
        } catch (e) {
          console.warn('No se pudo ver la lista de cámaras', e);
        }
        flujo = s;
        setEnUso(s.getVideoTracks()[0]?.label ?? '');
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
        // La cámara guardada ya no existe (otro móvil, otra versión): se vuelve a la de siempre.
        if (camaraId && (nombre === 'OverconstrainedError' || nombre === 'NotFoundError')) {
          guardarCamara('');
          setCamaraId('');
          return;
        }
        setEstado(nombre === 'NotAllowedError' || nombre === 'SecurityError' || !navigator.mediaDevices ? 'sin-permiso' : 'sin-camara');
      });

    return () => {
      vivo = false;
      raiz.removeEventListener('click', toque);
      clearInterval(reloj);
      flujo?.getTracks().forEach((t) => t.stop());
      video.remove();
      capa.remove();
      elementos.current = null;
      toqueRef.current = null;
    };
  }, [intento, camaraId]);

  const ok = estado === 'vigilando';
  const fallo = estado === 'sin-permiso' || estado === 'sin-camara';
  const enMarcha = estado !== 'arrancando' && !fallo;
  const encima = horizontal || !!alto || grande; // los mandos van sobre la imagen
  const texto = soloVer
    ? enMarcha ? 'Visor del catalejo' : TEXTOS[estado]
    : !activo && ok ? 'Serie completa: pasa a la siguiente para seguir contando.' : (encima && CORTOS[estado]) || TEXTOS[estado];

  // Aumento: se pasa de un nivel al siguiente con − y +; si cambia de cámara, se abre la otra.
  const abierta = camaras.find((c) => c.id === camaraId)?.id ?? camaras.find((c) => c.nombre === enUso)?.id ?? camaraId;
  const niveles = nivelesDe(camaras, abierta);
  const actual = (() => {
    const i = niveles.findIndex((n) => (n.camara === abierta || (!n.camara && !camaraId)) && n.zoom === zoom);
    if (i >= 0) return i;
    const j = niveles.findIndex((n) => n.camara === abierta || (!n.camara && !camaraId));
    return j >= 0 ? j : 0;
  })();
  const irA = (i: number) => {
    const n = niveles[Math.max(0, Math.min(niveles.length - 1, i))];
    if (!n) return;
    setZoom(n.zoom);
    guardarZoom(n.zoom);
    if (n.camara !== abierta && n.camara !== camaraId) {
      guardarCamara(n.camara);
      setEstado('arrancando');
      setCamaraId(n.camara);
    }
  };

  const mandos = (
    <>
      {enMarcha && niveles.length > 1 && (
        <View style={st.zoom}>
          <Pastilla titulo="−" onPress={() => irA(actual - 1)} etiqueta="Alejar la imagen" encima={encima} desactivado={actual <= 0} />
          <Text style={st.zoomTexto}>{niveles[actual]?.texto ?? `${zoom}×`}</Text>
          <Pastilla titulo="+" onPress={() => irA(actual + 1)} etiqueta="Acercar la imagen" encima={encima} desactivado={actual >= niveles.length - 1} />
        </View>
      )}
      {!soloVer && (ok || estado === 'calibrando') && (
        <Pastilla titulo="Recolocar" etiqueta="Volver a buscar la diana" encima={encima} onPress={() => {
          vigia.current.reiniciar();
          setEstado('buscando');
        }} />
      )}
      {fallo && (
        <Pastilla titulo="Reintentar" etiqueta="Volver a pedir la cámara" encima={encima} onPress={() => {
          setEstado('arrancando');
          setIntento((n) => n + 1);
        }} />
      )}
      {enMarcha && (
        <Pastilla titulo="Girar" etiqueta="Girar la imagen de la cámara" encima={encima} onPress={() => {
          giroManual.current = (giroManual.current + 90) % 360;
          guardarGiro(horizontal, giroManual.current);
          setEstado('buscando');
        }} />
      )}
      {!soloVer && !grande && activo && (
        <Pastilla titulo="⤢ Pantalla completa" etiqueta="Ver la cámara a pantalla completa" encima={encima} onPress={() => {
          recordarGrande();
          setQuiereGrande(true);
          setReducidaEn(null);
        }} />
      )}
    </>
  );
  const estadoVista = (
    <>
      {(estado === 'arrancando' || estado === 'calibrando') && <ActivityIndicator color={colors.accent} />}
      <Text style={[st.texto, encima && st.textoEncima, ok && { color: colors.green }]} numberOfLines={encima ? 2 : undefined}>
        {texto}
        {ultimo !== null && ok ? `  Último: ${ultimo}` : ''}
      </Text>
    </>
  );

  return (
    <View style={st.marco}>
      <View ref={caja as never} style={alto ? [st.videoHorizontal, { height: alto }] : horizontal ? [st.videoHorizontal, { height: Math.max(160, altoPantalla - 110) }] : st.video} />
      {encima ? (
        // Encima de la imagen, arriba el estado y abajo a la derecha los mandos: tapan lo menos posible.
        <>
          <View style={st.estadoEncima} pointerEvents="none">{estadoVista}</View>
          <View style={st.mandosEncima}>{mandos}</View>
        </>
      ) : (
        <View style={st.pie}>
          {estadoVista}
          <View style={st.mandosPie}>{mandos}</View>
        </View>
      )}
      <Modal visible={grande} animationType="none" transparent={false} onRequestClose={reducir}>
        <View style={st.grande}>
          <View ref={enPantalla as never} style={StyleSheet.absoluteFill} />
          <View style={[st.estadoEncima, st.margenSeguro]} pointerEvents="none">
            {estadoVista}
            {!!marcador && <Text style={st.marcador}>{marcador}</Text>}
          </View>
          <Pressable onPress={reducir} hitSlop={16} accessibilityLabel="Salir de pantalla completa" style={[st.pastilla, st.reducir]}>
            <Text style={[st.boton, st.reducirTexto]}>Reducir</Text>
          </Pressable>
          <View style={[st.mandosEncima, st.margenSeguro]}>{mandos}</View>
        </View>
      </Modal>
    </View>
  );
}

function Pastilla({ titulo, etiqueta, onPress, encima, desactivado = false }: {
  titulo: string; etiqueta: string; onPress: () => void; encima: boolean; desactivado?: boolean;
}) {
  return (
    <Pressable
      hitSlop={6}
      disabled={desactivado}
      onPress={onPress}
      accessibilityLabel={etiqueta}
      style={[encima ? st.pastilla : st.pastillaPie, desactivado && { opacity: 0.35 }]}
    >
      <Text style={st.boton}>{titulo}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  marco: { position: 'relative', borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000', borderWidth: 1, borderColor: colors.border },
  video: { width: '100%', aspectRatio: 3 / 4, position: 'relative', overflow: 'hidden' },
  videoHorizontal: { width: '100%', position: 'relative', overflow: 'hidden' },
  pie: { gap: space.sm, padding: space.md, backgroundColor: colors.card },
  mandosPie: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  estadoEncima: {
    position: 'absolute', top: 6, left: 6, maxWidth: '70%', flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.md, backgroundColor: 'rgba(8, 16, 30, 0.6)', flexWrap: 'wrap',
  },
  mandosEncima: {
    position: 'absolute', right: 6, bottom: 6, left: 6, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: 6,
  },
  pastilla: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(8, 16, 30, 0.6)' },
  pastillaPie: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.cardAlt },
  zoom: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  zoomTexto: { color: '#fff', fontWeight: '700', fontSize: 13, minWidth: 44, textAlign: 'center' },
  texto: { flexShrink: 1, color: colors.text, fontSize: 14 },
  textoEncima: { fontSize: 12, color: '#fff' },
  boton: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  grande: { flex: 1, backgroundColor: '#000' },
  marcador: { color: '#fff', fontSize: 13, fontWeight: '700', width: '100%' },
  // Grande y fácil de pulsar con el móvil en el catalejo.
  reducir: {
    position: 'absolute', top: 8, right: 'max(8px, env(safe-area-inset-right))' as never,
    minWidth: 120, minHeight: 52, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(8, 16, 30, 0.8)', borderWidth: 2, borderColor: colors.accent,
  },
  reducirTexto: { fontSize: 18 },
  margenSeguro: { left: 'max(6px, env(safe-area-inset-left))' as never, right: 'max(6px, env(safe-area-inset-right))' as never },
});
