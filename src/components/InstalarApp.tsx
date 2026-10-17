import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space } from '@/theme';
import { Icon } from './Icon';
import { Card } from './ui';

/** ¿Se está usando la web desde el navegador (no instalada en la pantalla de inicio)? */
function enNavegador(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone;
  return !standalone;
}

const puedeCompartir = () => Platform.OS === 'web' && typeof navigator !== 'undefined' && !!navigator.share;

/**
 * En la versión web: cómo instalarla en el iPhone y un botón para pasársela a otros tiradores.
 * Una vez instalada, solo queda el botón de compartir.
 */
export function InstalarApp() {
  const [abierto, setAbierto] = useState(false);
  if (Platform.OS !== 'web') return null;
  const navegador = enNavegador();
  if (!navegador && !puedeCompartir()) return null;

  const compartir = () => {
    navigator.share?.({
      title: 'Tirador Deportivo',
      text: 'Licencias, armas y entrenamientos de tiro en el móvil.',
      url: window.location.origin + (process.env.EXPO_BASE_URL ?? '') + '/',
    }).catch(() => {});
  };

  return (
    <Card style={{ gap: space.md }}>
      <View style={st.fila}>
        <View style={st.icono}><Icon name="share" size={22} /></View>
        <View style={{ flex: 1 }}>
          <Text style={st.titulo}>{navegador ? 'Instálala en tu móvil' : 'Pásasela a otros tiradores'}</Text>
          <Text style={st.texto}>
            {navegador ? 'Con su icono en la pantalla de inicio, a pantalla completa y sin barra de Safari.' : 'Comparte el enlace por WhatsApp o mensaje.'}
          </Text>
        </View>
      </View>
      {navegador && abierto && (
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
        {navegador && (
          <Pressable style={st.boton} onPress={() => setAbierto((x) => !x)}>
            <Text style={st.botonTexto}>{abierto ? 'Ocultar pasos' : 'Ver cómo'}</Text>
          </Pressable>
        )}
        {puedeCompartir() && (
          <Pressable style={st.boton} onPress={compartir}>
            <Text style={st.botonTexto}>Compartir</Text>
          </Pressable>
        )}
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
