import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button, Card, s } from '@/components/ui';
import { puntuar } from '@/lib/diana';
import { aMm, buscarAgujeros, calibrar, type Calibracion, type Gris } from '@/lib/impactos';
import { colors, radius, space } from '@/theme';
import type { PropsFotoDiana } from './FotoDiana.types';

const LADO = 1000; // lado mayor de la imagen que se analiza

interface Marca { xPx: number; yPx: number; veces: number }
interface Grupo { xPx: number; yPx: number; radioPx: number }
interface Foto { lienzo: HTMLCanvasElement; cal: Calibracion; grupos: Grupo[] }

type Estado = 'inicio' | 'leyendo' | 'sin-diana' | 'revisar';

/**
 * Puntuar con una foto de la diana ya tirada: la app propone los agujeros y el tirador los revisa
 * (toca uno para quitarlo, toca en otro sitio para añadirlo) antes de apuntarlos en la serie.
 * Todo se procesa en el móvil; la foto no se guarda.
 */
export function FotoDiana({ modelo, calibre, faltan, onApuntar }: PropsFotoDiana) {
  const [estado, setEstado] = useState<Estado>('inicio');
  const [foto, setFoto] = useState<Foto | null>(null);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [elegida, setElegida] = useState<number | null>(null);
  const caja = useRef<unknown>(null);
  const vista = useRef<{ x0: number; y0: number; lado: number } | null>(null);

  const leer = (archivo: File) => {
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
        const cal = calibrar(g, 0.75);
        if (!cal) {
          setEstado('sin-diana');
          return;
        }
        const agujeros = buscarAgujeros(g, cal, modelo, calibre);
        // Los grupos (muchos agujeros juntos) no se cuentan: se señalan para que el tirador marque los suyos.
        const grupos = agujeros.filter((a) => a.grupo).map((a) => ({ xPx: a.xPx, yPx: a.yPx, radioPx: a.grupo!.radioPx }));
        setFoto({ lienzo, cal, grupos });
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
    // Se ve el negro con margen y cualquier agujero que quede fuera.
    let mitad = Math.max(cal.rx, cal.ry) * 1.3;
    for (const m of marcas) mitad = Math.max(mitad, Math.hypot(m.xPx - cal.cx, m.yPx - cal.cy) + 4 * rBala);
    for (const g of foto.grupos) mitad = Math.max(mitad, Math.hypot(g.xPx - cal.cx, g.yPx - cal.cy) + g.radioPx + 4 * rBala);
    vista.current = { x0: cal.cx - mitad, y0: cal.cy - mitad, lado: 2 * mitad };
    const css = raiz.getBoundingClientRect().width;
    lienzo.width = css * devicePixelRatio;
    lienzo.height = css * devicePixelRatio;
    const k = lienzo.width / (2 * mitad);
    const c = lienzo.getContext('2d')!;
    c.fillStyle = '#000';
    c.fillRect(0, 0, lienzo.width, lienzo.height);
    c.drawImage(foto.lienzo, cal.cx - mitad, cal.cy - mitad, 2 * mitad, 2 * mitad, 0, 0, lienzo.width, lienzo.height);
    const aPantalla = (x: number, y: number) => [(x - (cal.cx - mitad)) * k, (y - (cal.cy - mitad)) * k] as const;
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
    const r = Math.max(rBala * k * 1.4, 7 * devicePixelRatio);
    c.font = `bold ${12 * devicePixelRatio}px -apple-system, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    marcas.forEach((m, j) => {
      const [x, y] = aPantalla(m.xPx, m.yPx);
      c.strokeStyle = j === elegida ? '#FFD60A' : '#FF3B30';
      c.lineWidth = 2.5 * devicePixelRatio;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.stroke();
      if (m.veces > 1) {
        c.fillStyle = '#FF3B30';
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
      const radioToque = Math.max(rBala * 2, (14 / caja.width) * v.lado);
      const i = marcas.findIndex((m) => Math.hypot(m.xPx - x, m.yPx - y) < radioToque);
      if (i >= 0) {
        setElegida(i === elegida ? null : i);
      } else {
        setMarcas([...marcas, { xPx: x, yPx: y, veces: 1 }]);
        setElegida(marcas.length);
      }
    };
  }, [estado, foto, marcas, elegida, rBala]);

  // El <input type="file"> abre en el iPhone «Hacer foto» o «Fototeca».
  const elegir = () => {
    document.querySelectorAll('input[data-foto-diana]').forEach((x) => x.remove());
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.dataset.fotoDiana = '1';
    input.style.display = 'none';
    input.onchange = () => {
      const f = input.files?.[0];
      input.remove();
      if (f) leer(f);
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
    setEstado('inicio');
  };

  if (estado !== 'revisar') {
    return (
      <Card style={{ gap: space.md }}>
        <Text style={s.text}>Puntuar con una foto de la diana</Text>
        <Text style={s.muted}>
          Haz la foto de frente, con buena luz y la diana entera (que se vea todo el círculo negro con algo de margen).
          La app propone los agujeros y tú los revisas antes de apuntarlos.
        </Text>
        {estado === 'leyendo' && (
          <View style={st.fila}>
            <ActivityIndicator color={colors.accent} />
            <Text style={s.muted}>Buscando agujeros…</Text>
          </View>
        )}
        {estado === 'sin-diana' && (
          <Text style={{ color: colors.orange }}>
            No encuentro el círculo negro de la diana. Repite la foto más de frente, con la diana entera y sin sombras fuertes.
          </Text>
        )}
        <Button title={estado === 'sin-diana' ? 'Repetir la foto' : 'Hacer o elegir foto'} onPress={elegir} />
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
        Revisa la foto: toca un agujero sin marcar para añadirlo y toca un círculo rojo para quitarlo o decir que
        entraron varios disparos juntos. El círculo verde es el negro de la diana: si no encaja, repite la foto.
      </Text>
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
      <Button title={`Apuntar ${n} ${n === 1 ? 'disparo' : 'disparos'}`} onPress={() => { onApuntar(puntos); otra(); }} />
      <Button title="Otra foto" variant="secondary" onPress={otra} />
    </Card>
  );
}

const st = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  foto: { width: '100%', aspectRatio: 1, borderRadius: radius.md, overflow: 'hidden', backgroundColor: '#000' },
});
