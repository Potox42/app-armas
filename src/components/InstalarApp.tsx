import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, space } from '@/theme';
import { Icon } from './Icon';
import { Card } from './ui';

/** ¿Se está usando la web desde el navegador (no instalada en la pantalla de inicio)? */
export function enNavegador(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone;
  return !standalone;
}

// Web de venta (cambiar a https://tirador360.es cuando el dominio esté conectado).
export const WEB_VENTA = 'https://tirador3602164.live-website.com/';
const CLAVE_CODIGO = 'codigoAmigo';

function leerCodigo(): string {
  try { return localStorage.getItem(CLAVE_CODIGO) ?? ''; } catch { return ''; }
}
function guardarCodigo(c: string) {
  try { if (c) localStorage.setItem(CLAVE_CODIGO, c); else localStorage.removeItem(CLAVE_CODIGO); } catch { /* sin almacenamiento */ }
}

/** Mensaje para recomendar la app: enlace a la web de venta y, si lo hay, el código de descuento del 10 %. */
export function mensajeRecomendacion(codigo: string): { text: string; url: string } {
  const c = codigo.trim().toUpperCase();
  const url = c ? `${WEB_VENTA}?amigo=${encodeURIComponent(c)}` : WEB_VENTA;
  const text = c
    ? `Te recomiendo Tirador 360: armas, guías, licencias, munición y entrenamientos en el móvil. Con mi código ${c} tienes un 10 % de descuento:`
    : 'Te recomiendo Tirador 360: armas, guías, licencias, munición y entrenamientos en el móvil.';
  return { text, url };
}

const puedeCompartir = () => Platform.OS === 'web' && typeof navigator !== 'undefined' && !!navigator.share;

/** En la versión web abierta en el navegador: cómo instalarla en el móvil (pestaña Inicio). */
export function InstalarApp() {
  const [abierto, setAbierto] = useState(false);
  if (Platform.OS !== 'web' || !enNavegador()) return null;
  return (
    <Card style={{ gap: space.md }}>
      <View style={st.fila}>
        <View style={st.icono}><Icon name="share" size={22} /></View>
        <View style={{ flex: 1 }}>
          <Text style={st.titulo}>Instálala en tu móvil</Text>
          <Text style={st.texto}>Con su icono en la pantalla de inicio, a pantalla completa y sin barra de Safari.</Text>
        </View>
      </View>
      {abierto && (
        <View style={{ gap: space.sm }}>
          {[
            'En Safari, toca el botón Compartir (el cuadrado con la flecha hacia arriba).',
            'Baja y elige «Añadir a pantalla de inicio».',
            'Toca «Añadir» y abre la app desde su icono.',
          ].map((t, i) => (
            <View key={t} style={st.paso}>
              <Text style={st.num}>{i + 1}</Text>
              <Text style={[st.texto, { flex: 1 }]}>{t}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={st.fila}>
        <Pressable style={st.boton} onPress={() => setAbierto((x) => !x)}>
          <Text style={st.botonTexto}>{abierto ? 'Ocultar pasos' : 'Ver cómo'}</Text>
        </Pressable>
      </View>
    </Card>
  );
}

/**
 * Recomendarla (pestaña Perfil): se envía el enlace a la web de venta (no a la app) con el código de
 * recomendado, que da un 10 % de descuento a hasta tres tiradores. Sin «Compartir» del sistema, se copia.
 */
export function RecomendarApp() {
  const [codigo, setCodigo] = useState(leerCodigo);
  const [copiado, setCopiado] = useState(false);
  if (Platform.OS !== 'web') return null;

  const recomendar = () => {
    const m = mensajeRecomendacion(codigo);
    if (puedeCompartir()) {
      navigator.share({ title: 'Tirador 360', ...m }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(`${m.text} ${m.url}`).then(() => {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2500);
      }).catch(() => {});
    }
  };

  return (
    <Card style={{ gap: space.md }}>
      <View style={st.fila}>
        <View style={st.icono}><Icon name="share" size={22} /></View>
        <View style={{ flex: 1 }}>
          <Text style={st.titulo}>Recomiéndala a otros tiradores</Text>
          <Text style={st.texto}>Envía el enlace de la web. Con tu código de recomendado tienen un 10 % de descuento (hasta 3 tiradores).</Text>
        </View>
      </View>
      <TextInput
        style={st.campo}
        value={codigo}
        onChangeText={(t) => { const c = t.toUpperCase().replace(/\s/g, ''); setCodigo(c); guardarCodigo(c); }}
        placeholder="Tu código de recomendado (viene en el correo de compra)"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <View style={st.fila}>
        <Pressable style={st.boton} onPress={recomendar}>
          <Text style={st.botonTexto}>{copiado ? 'Mensaje copiado' : puedeCompartir() ? 'Recomendar' : 'Copiar mensaje'}</Text>
        </Pressable>
      </View>
    </Card>
  );
}

const st = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icono: {
    width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.accentSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  titulo: { color: colors.text, fontSize: 16, fontWeight: '700' },
  texto: { color: colors.textMuted, fontSize: 14 },
  campo: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.cardAlt,
    color: colors.text, paddingHorizontal: space.md, paddingVertical: 10, fontSize: 15,
  },
  paso: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  num: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accent, color: '#fff',
    textAlign: 'center', lineHeight: 24, fontWeight: '800', fontSize: 13, overflow: 'hidden',
  },
  boton: {
    flex: 1, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.cardAlt, alignItems: 'center',
  },
  botonTexto: { color: colors.text, fontWeight: '700', fontSize: 15 },
});

/**
 * En el iPhone, Safari y la app del icono de la pantalla de inicio guardan los datos por separado:
 * lo que se apunta en uno no aparece en el otro. Si ya está instalada, se avisa al abrirla en Safari.
 */
export function AvisoSafari() {
  if (!enNavegador() || !/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) return null;
  return (
    <Card style={{ gap: space.sm, borderColor: colors.orange }}>
      <Text style={st.titulo}>Estás en el navegador, no en la app del icono</Text>
      <Text style={st.texto}>
        En el iPhone, Safari y la app de la pantalla de inicio guardan los datos por separado: lo que apuntes aquí no
        aparecerá en el icono. Si ya la tienes instalada, ábrela desde su icono y usa siempre esa.
      </Text>
    </Card>
  );
}
