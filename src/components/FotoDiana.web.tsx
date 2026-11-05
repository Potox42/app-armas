import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button, Card, s } from '@/components/ui';
import { puntuar } from '@/lib/diana';
import { agujerosNuevos, aMm, buscarAgujeros, calibrar, centrarAnillos, type Calibracion, type Gris } from '@/lib/impactos';
import { colors, radius, space } from '@/theme';
import type { PropsFotoDiana } from './FotoDiana.types';

const LADO = 1000; // lado mayor de la imagen que se analiza

interface Marca { xPx: number; yPx: number; veces: number }
interface Grupo { xPx: number; yPx: number; radioPx: number }
interface Foto { lienzo: HTMLCanvasElement; g: Gris; cal: Calibracion; grupos: Grupo[]; comparada: boolean }

type Estado = 'inicio' | 'leyendo' | 'sin-diana' | 'revisar';

/**
 * Puntuar con una foto de la diana ya tirada: la app propone los agujeros y el tirador los revisa
 * (toca uno para quitarlo, toca en otro sitio para añadirlo) antes de apuntarlos en la serie.
 * Si hay foto de ANTES de la serie, se comparan las dos y solo salen los agujeros nuevos (sirve con
 * una diana ya usada). La foto de después de una serie es la de antes de la siguiente.
 * Todo se procesa en el móvil; las fotos no se guardan.
 */
export function FotoDiana({ modelo, calibre, faltan, anteriores = [], onApuntar }: PropsFotoDiana) {
  const [estado, setEstado] = useState<Estado>('inicio');
  const [foto, setFoto] = useState<Foto | null>(null);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [elegida, setElegida] = useState<number | null>(null);
  const [cerca, setCerca] = useState(false); // vista ampliada de la zona de los disparos
  const [antes, setAntes] = useState<Foto | null>(null);
  const caja = useRef<unknown>(null);
  const vista = useRef<{ x0: number; y0: number; lado: number } | null>(null);

  const leer = (archivo: File, esAntes: boolean) => {
    setEstado('leyendo');
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, LADO / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
      const lienzo = document.createElement('canvas');
      lienzo.width = w;
      lienzo.height = h;
      const ctx = lienzo.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      const px = ctx.getImageData(0, 0, w, h).data;
      const d = new Float32Array(w * h);
      for (let i = 0; i < d.length; i++) d[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
      const g: Gris = { w, h, d };
      // Se deja trabajar al navegador un momento para que se vea «Buscando agujeros…».
      setTimeout(() => {
        const bruta = calibrar(g, 0.75);
        const cal = bruta && centrarAnillos(g, bruta);
        if (!cal) {
          setEstado('sin-diana');
          return;
        }
        if (esAntes) {
          setAntes({ lienzo, g, cal, grupos: [], comparada: false });
          setEstado('inicio');
          return;
        }
        const comparada = !!antes;
        const agujeros = antes ? agujerosNuevos(antes.g, antes.cal, g, cal, modelo, calibre) : buscarAgujeros(g, cal, modelo, calibre);
        // Los grupos (muchos agujeros juntos) no se cuentan: se señalan para que el tirador marque los suyos.
        const grupos = agujeros.filter((a) => a.grupo).map((a) => ({ xPx: a.xPx, yPx: a.yPx, radioPx: a.grupo!.radioPx }));
        setFoto({ lienzo, g, cal, grupos, comparada });
        setMarcas(agujeros.filter((a) => !a.grupo).map((a) => ({ xPx: a.xPx, yPx: a.yPx, veces: a.veces })));
        setElegida(null);
        setEstado('revisar');
      }, 30);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setEstado('sin-diana');
    };
    img.src = url;
  };

  const pxMm = foto ? (foto.cal.rx + foto.cal.ry) / modelo.negro : 1;
  const rBala = (calibre / 2) * pxMm;
  const puntos = foto
    ? marcas.flatMap((m) => {
      const p = aMm(foto.cal, m.xPx, m.yPx, modelo);
      return Array.from({ length: m.veces }, () => p);
    })
    : [];
  const total = puntos.reduce((t, p) => t + puntuar(p.x, p.y, calibre, modelo), 0);

  // Dibujo de la foto recortada alrededor de la diana, con la elipse calibrada y los agujeros.
  useEffect(() => {
    const raiz = caja.current as HTMLElement | null;
    if (estado !== 'revisar' || !foto || !raiz) return;
    let lienzo = raiz.querySelector('canvas');
    if (!lienzo) {
      lienzo = document.createElement('canvas');
      Object.assign(lienzo.style, { width: '100%', height: '100%', display: 'block', touchAction: 'manipulation' });
      raiz.appendChild(lienzo);
    }
    const { cal } = foto;
    // Entera: se ve el negro con margen y cualquier agujero que quede fuera.
    // Ampliada: la zona del grupo de agujeros (o el centro del negro), para marcar disparos muy juntos.
    let vx = cal.cx, vy = cal.cy, mitad: number;
    const grupo = foto.grupos[0];
    if (cerca) {
      if (grupo) { vx = grupo.xPx; vy = grupo.yPx; }
      mitad = Math.max(grupo ? grupo.radioPx * 1.2 + rBala : 0.5 * Math.max(cal.rx, cal.ry), 8 * rBala);
    } else {
      mitad = Math.max(cal.rx, cal.ry) * 1.3;
      for (const m of marcas) mitad = Math.max(mitad, Math.hypot(m.xPx - cal.cx, m.yPx - cal.cy) + 4 * rBala);
      for (const g of foto.grupos) mitad = Math.max(mitad, Math.hypot(g.xPx - cal.cx, g.yPx - cal.cy) + g.radioPx + 4 * rBala);
    }
    vista.current = { x0: vx - mitad, y0: vy - mitad, lado: 2 * mitad };
    const css = raiz.getBoundingClientRect().width;
    lienzo.width = css * devicePixelRatio;
    lienzo.height = css * devicePixelRatio;
    const k = lienzo.width / (2 * mitad);
    const c = lienzo.getContext('2d')!;
    c.fillStyle = '#000';
    c.fillRect(0, 0, lienzo.width, lienzo.height);
    // Solo la parte del recorte que cae dentro de la foto: Safari en el iPhone no respeta las
    // proporciones si el recorte se sale de la imagen y la dibuja estirada.
    const sx0 = Math.max(0, vx - mitad), sy0 = Math.max(0, vy - mitad);
    const sx1 = Math.min(foto.lienzo.width, vx + mitad), sy1 = Math.min(foto.lienzo.height, vy + mitad);
    if (sx1 > sx0 && sy1 > sy0) {
      c.drawImage(
        foto.lienzo, sx0, sy0, sx1 - sx0, sy1 - sy0,
        (sx0 - (vx - mitad)) * k, (sy0 - (vy - mitad)) * k, (sx1 - sx0) * k, (sy1 - sy0) * k,
      );
    }
    const aPantalla = (x: number, y: number) => [(x - (vx - mitad)) * k, (y - (vy - mitad)) * k] as const;
    c.strokeStyle = '#2ECC71';
    c.lineWidth = 2 * devicePixelRatio;
    c.beginPath();
    const [ex, ey] = aPantalla(cal.cx, cal.cy);
    c.ellipse(ex, ey, cal.rx * k, cal.ry * k, 0, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = '#FF9F0A';
    c.lineWidth = 2 * devicePixelRatio;
    c.setLineDash([6 * devicePixelRatio, 4 * devicePixelRatio]);
    for (const g of foto.grupos) {
      const [gx, gy] = aPantalla(g.xPx, g.yPx);
      c.beginPath();
      c.arc(gx, gy, g.radioPx * k + rBala * k, 0, Math.PI * 2);
      c.stroke();
    }
    c.setLineDash([]);
    // Cada marca mide lo que una bala, para poder marcar disparos pegados.
    const r = Math.max(rBala * k, 4 * devicePixelRatio);
    // Los disparos ya apuntados en esta diana, en rojo; los agujeros nuevos que propone la foto, en verde.
    const radioNegro = modelo.negro / 2;
    c.fillStyle = 'rgba(255,59,48,0.85)';
    for (const d of anteriores) {
      if (d.sinPosicion) continue;
      const [x, y] = aPantalla(cal.cx + (d.x / radioNegro) * cal.rx, cal.cy + (d.y / radioNegro) * cal.ry);
      c.beginPath();
      c.arc(x, y, Math.max(r * 0.6, 3 * devicePixelRatio), 0, Math.PI * 2);
      c.fill();
    }
    c.font = `bold ${12 * devicePixelRatio}px -apple-system, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    marcas.forEach((m, j) => {
      const [x, y] = aPantalla(m.xPx, m.yPx);
      c.strokeStyle = j === elegida ? '#FFD60A' : '#2ECC71';
      c.lineWidth = (cerca ? 2 : 1.5) * devicePixelRatio;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = c.strokeStyle;
      c.beginPath();
      c.arc(x, y, 1.5 * devicePixelRatio, 0, Math.PI * 2);
      c.fill();
      if (m.veces > 1) {
        c.fillStyle = '#1E9E57';
        c.beginPath();
        c.arc(x + r, y - r, 8 * devicePixelRatio, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#fff';
        c.fillText(`×${m.veces}`, x + r, y - r);
      }
    });
    lienzo.onclick = (e) => {
      const caja = lienzo!.getBoundingClientRect();
      const v = vista.current!;
      const x = v.x0 + ((e.clientX - caja.left) / caja.width) * v.lado;
      const y = v.y0 + ((e.clientY - caja.top) / caja.height) * v.lado;
      // Cerca de una marca: se elige (para quitarla o decir cuántos disparos son). Si no, se añade.
      // Solo dentro de la propia marca, para poder añadir otra pegada a ella.
      const radioToque = Math.max(rBala * 0.8, (6 / caja.width) * v.lado);
      const i = marcas.findIndex((m) => Math.hypot(m.xPx - x, m.yPx - y) < radioToque);
      if (i >= 0) {
        setElegida(i === elegida ? null : i);
      } else {
        setMarcas([...marcas, { xPx: x, yPx: y, veces: 1 }]);
        setElegida(marcas.length);
      }
    };
  }, [estado, foto, marcas, elegida, rBala, cerca, anteriores, modelo.negro]);

  // El <input type="file"> abre en el iPhone «Hacer foto» o «Fototeca».
  const elegir = (esAntes = false) => {
    document.querySelectorAll('input[data-foto-diana]').forEach((x) => x.remove());
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.dataset.fotoDiana = '1';
    input.style.display = 'none';
    input.onchange = () => {
      const f = input.files?.[0];
      input.remove();
      if (f) leer(f, esAntes);
    };
    document.body.appendChild(input);
    input.click();
  };
  const cambiarElegida = (veces: number) => {
    if (elegida === null) return;
    if (veces <= 0) {
      setMarcas(marcas.filter((_, j) => j !== elegida));
      setElegida(null);
    } else {
      setMarcas(marcas.map((m, j) => (j === elegida ? { ...m, veces: Math.min(5, veces) } : m)));
    }
  };
  const otra = () => {
    setFoto(null);
    setMarcas([]);
    setElegida(null);
    setCerca(false);
    setEstado('inicio');
  };

  if (estado !== 'revisar') {
    return (
      <Card style={{ gap: space.md }}>
        <Text style={s.text}>Puntuar con una foto de la diana</Text>
        <Text style={s.muted}>
          Haz las fotos de frente, con buena luz y la diana entera (que se vea todo el círculo negro con algo de margen).
          Si la diana ya tiene agujeros, haz una foto antes de tirar y otra después: la app solo marcará los nuevos.
        </Text>
        {antes ? (
          <Text style={{ color: colors.green }}>✓ Tienes la foto de antes. Ahora tira la serie y haz la de después.</Text>
        ) : (
          <Button title="Foto de antes de tirar" variant="secondary" onPress={() => elegir(true)} />
        )}
        {estado === 'leyendo' && (
          <View style={st.fila}>
            <ActivityIndicator color={colors.accent} />
            <Text style={s.muted}>{antes ? 'Comparando con la foto de antes…' : 'Buscando agujeros…'}</Text>
          </View>
        )}
        {estado === 'sin-diana' && (
          <Text style={{ color: colors.orange }}>
            No encuentro el círculo negro de la diana. Repite la foto más de frente, con la diana entera y sin sombras fuertes.
          </Text>
        )}
        <Button
          title={estado === 'sin-diana' ? 'Repetir la foto' : antes ? 'Foto de después de tirar' : 'Hacer o elegir foto'}
          onPress={() => elegir(false)}
        />
        {antes && <Button title="Repetir la foto de antes" variant="secondary" onPress={() => elegir(true)} />}
      </Card>
    );
  }

  const n = puntos.length;
  return (
    <Card style={{ gap: space.md }}>
      <Text style={s.text}>
        {n} {n === 1 ? 'disparo' : 'disparos'} · {total} puntos
      </Text>
      <Text style={s.muted}>
        Revisa la foto: los agujeros nuevos van en verde. Toca un agujero sin marcar para añadirlo y toca un
        círculo verde pequeño para quitarlo o decir que entraron varios disparos juntos.
        {anteriores.some((d) => !d.sinPosicion) ? ' Los puntos rojos son los disparos que ya tenías apuntados en esta diana: no los vuelvas a marcar.' : ''}
        {' '}El círculo grande es el negro de la diana: si no encaja, repite la foto.
      </Text>
      {foto?.comparada && (
        <Text style={{ color: colors.green, fontSize: 13 }}>
          Comparada con la foto de antes: solo están marcados los agujeros nuevos.
        </Text>
      )}
      {foto && foto.grupos.length > 0 && (
        <Text style={{ color: colors.orange, fontSize: 13 }}>
          Dentro del círculo naranja hay muchos agujeros juntos y no los puedo contar uno a uno. Toca cada agujero
          de esta serie para marcarlo.
        </Text>
      )}
      {n !== faltan && faltan > 0 && (
        <Text style={{ color: colors.orange, fontSize: 13 }}>
          {n < faltan ? `Faltan ${faltan - n} para completar la serie.` : `Son ${n - faltan} más de los que quedan en la serie.`}
        </Text>
      )}
      <View ref={caja as never} style={st.foto} />
      <Button
        title={cerca ? 'Ver la diana entera' : 'Ampliar para marcar disparos juntos'}
        variant="secondary"
        onPress={() => setCerca(!cerca)}
      />
      {elegida !== null && marcas[elegida] && (
        <View style={st.fila}>
          <Text style={[s.text, { flex: 1 }]}>
            {marcas[elegida].veces === 1 ? '1 disparo' : `${marcas[elegida].veces} disparos`} en este agujero
          </Text>
          <Button title="−" variant="secondary" onPress={() => cambiarElegida(marcas[elegida].veces - 1)} />
          <Button title="+" variant="secondary" onPress={() => cambiarElegida(marcas[elegida].veces + 1)} />
          <Button title="Quitar" variant="secondary" onPress={() => cambiarElegida(0)} />
        </View>
      )}
      <Button title={`Apuntar ${n} ${n === 1 ? 'disparo' : 'disparos'}`} onPress={() => {
        onApuntar(puntos);
        // La foto de después de esta serie es la de antes de la siguiente.
        if (foto) setAntes({ ...foto, grupos: [], comparada: false });
        otra();
      }} />
      <Button title="Otra foto" variant="secondary" onPress={otra} />
    </Card>
  );
}

const st = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  foto: { width: '100%', aspectRatio: 1, borderRadius: radius.md, overflow: 'hidden', backgroundColor: '#000' },
});
