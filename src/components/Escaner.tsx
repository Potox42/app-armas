import { useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View, type LayoutRectangle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { bordesNativos, margenAbajo, margenArriba } from '@/lib/margenes';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { ajustarTarjeta } from '@/lib/ajustarTarjeta';
import { hayLinterna, linterna, subirResolucion } from '@/lib/camaraWeb';
import { colors, radius, space } from '@/theme';
import { Icon } from './Icon';
import { Button } from './ui';

// Proporción de una tarjeta tipo DNI o licencia (85,6 × 54 mm).
const TARJETA = 85.6 / 54;
const ANCHO_FINAL = 1400;

interface Props {
  visible: boolean;
  titulo: string;
  proporcion?: number; // ancho / alto del documento
  onFoto: (dataUri: string) => void;
  onCerrar: () => void;
}

/** Recuadro dentro de la vista: 88 % del ancho, con la proporción del documento, algo por encima del centro. */
function marco(vista: { width: number; height: number }, proporcion: number) {
  const width = vista.width * 0.88;
  const height = width / proporcion;
  return { x: (vista.width - width) / 2, y: (vista.height - height) * 0.42, width, height };
}

/**
 * Pasa el recuadro de la pantalla a píxeles de la foto. La vista previa llena la pantalla
 * recortando lo que sobra (como «cover»), así que hay que deshacer esa escala y ese desplazamiento.
 */
function recorteEnFoto(m: LayoutRectangle, vista: { width: number; height: number }, foto: { width: number; height: number }) {
  const escala = Math.max(vista.width / foto.width, vista.height / foto.height);
  const dx = (foto.width * escala - vista.width) / 2;
  const dy = (foto.height * escala - vista.height) / 2;
  const margen = 0.03; // un poco de aire alrededor por si la tarjeta no está perfecta
  const x = (m.x - m.width * margen + dx) / escala;
  const y = (m.y - m.height * margen + dy) / escala;
  const w = (m.width * (1 + 2 * margen)) / escala;
  const h = (m.height * (1 + 2 * margen)) / escala;
  const originX = Math.max(0, Math.round(x));
  const originY = Math.max(0, Math.round(y));
  return {
    originX,
    originY,
    width: Math.round(Math.min(w, foto.width - originX)),
    height: Math.round(Math.min(h, foto.height - originY)),
  };
}

/**
 * Recorta (si hay recuadro) y reduce la foto. El tamaño se lee de la propia imagen: en el iPhone,
 * la cámara web informa del tamaño en horizontal aunque la foto salga en vertical.
 */
async function aDataUri(uri: string, recuadro?: { marco: LayoutRectangle; vista: { width: number; height: number } }): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  if (recuadro) {
    const original = await ImageManipulator.manipulate(uri).renderAsync();
    ctx.crop(recorteEnFoto(recuadro.marco, recuadro.vista, { width: original.width, height: original.height }));
  }
  ctx.resize({ width: ANCHO_FINAL });
  const img = await ctx.renderAsync();
  const r = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: true });
  return `data:image/jpeg;base64,${r.base64}`;
}

/** Cámara a pantalla completa con un recuadro para encuadrar un documento; devuelve la foto ya recortada. */
export function Escaner({ visible, titulo, proporcion = TARJETA, onFoto, onCerrar }: Props) {
  const [permiso, pedirPermiso] = useCameraPermissions();
  const camara = useRef<CameraView>(null);
  const [vista, setVista] = useState({ width: 0, height: 0 });
  const [lista, setLista] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [luz, setLuz] = useState(false);
  const [conLuz, setConLuz] = useState(false);

  const m = marco(vista, proporcion);

  const cerrar = () => {
    setLuz(false);
    setResultado(null);
    setError(null);
    onCerrar();
  };

  const disparar = async () => {
    if (!camara.current || procesando) return;
    setProcesando(true);
    setError(null);
    try {
      const foto = await camara.current.takePictureAsync({ quality: 0.9 });
      const recortada = await aDataUri(foto.uri, { marco: m, vista });
      setResultado((await ajustarTarjeta(recortada)) ?? recortada);
    } catch (e) {
      console.error(e);
      setError('No se pudo hacer la foto. Inténtalo otra vez.');
    } finally {
      setProcesando(false);
    }
  };

  const galeria = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.9 });
    if (r.canceled || !r.assets[0]) return;
    setProcesando(true);
    try {
      setResultado(await aDataUri(r.assets[0].uri));
    } finally {
      setProcesando(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={cerrar}>
      <View style={st.fondo}>
        {resultado ? (
          <SafeAreaView edges={bordesNativos()} style={[st.revision, margenArriba(space.xl), margenAbajo(space.xl)]}>
            <Text style={st.titulo}>¿Se lee bien?</Text>
            <Image source={{ uri: resultado }} style={[st.previa, { aspectRatio: proporcion }]} resizeMode="contain" />
            <View style={{ gap: space.sm, alignSelf: 'stretch' }}>
              <Button title="Usar esta foto" onPress={() => { onFoto(resultado); setResultado(null); }} />
              <Button title="Repetir" variant="secondary" onPress={() => setResultado(null)} />
            </View>
          </SafeAreaView>
        ) : !permiso?.granted ? (
          <SafeAreaView edges={bordesNativos()} style={[st.revision, margenArriba(space.xl), margenAbajo(space.xl)]}>
            <Text style={st.titulo}>Permiso de cámara</Text>
            <Text style={st.texto}>Para encuadrar el documento hace falta usar la cámara.</Text>
            <View style={{ gap: space.sm, alignSelf: 'stretch' }}>
              <Button title="Permitir cámara" onPress={pedirPermiso} />
              <Button title="Elegir de la galería" variant="secondary" onPress={galeria} />
              <Button title="Cancelar" variant="secondary" onPress={cerrar} />
            </View>
          </SafeAreaView>
        ) : (
          <View style={StyleSheet.absoluteFill} onLayout={(e) => setVista(e.nativeEvent.layout)}>
            {visible && (
              <CameraView
                ref={camara}
                style={StyleSheet.absoluteFill}
                facing="back"
                enableTorch={luz}
                onCameraReady={() => {
                  setLista(true);
                  subirResolucion().then(() => setConLuz(hayLinterna()));
                }}
              />
            )}
            {vista.width > 0 && (
              <>
                {/* Sombra alrededor del recuadro */}
                <View style={[st.sombra, { top: 0, left: 0, right: 0, height: m.y }]} />
                <View style={[st.sombra, { top: m.y + m.height, left: 0, right: 0, bottom: 0 }]} />
                <View style={[st.sombra, { top: m.y, left: 0, width: m.x, height: m.height }]} />
                <View style={[st.sombra, { top: m.y, left: m.x + m.width, right: 0, height: m.height }]} />
                <View style={[st.marco, { left: m.x, top: m.y, width: m.width, height: m.height }]}>
                  <View style={[st.esquina, { top: -3, left: -3, borderTopWidth: 5, borderLeftWidth: 5 }]} />
                  <View style={[st.esquina, { top: -3, right: -3, borderTopWidth: 5, borderRightWidth: 5 }]} />
                  <View style={[st.esquina, { bottom: -3, left: -3, borderBottomWidth: 5, borderLeftWidth: 5 }]} />
                  <View style={[st.esquina, { bottom: -3, right: -3, borderBottomWidth: 5, borderRightWidth: 5 }]} />
                </View>
                <Text style={[st.ayuda, { top: m.y - 64 }]}>{titulo}</Text>
                <Text style={[st.ayudaPeq, { top: m.y + m.height + 16 }]}>
                  Encaja el documento en el recuadro, con buena luz y sin reflejos
                </Text>
              </>
            )}
            {conLuz && (
              <SafeAreaView edges={bordesNativos(['top'])} style={[st.arriba, margenArriba(space.lg)]}>
                <Pressable
                  onPress={async () => setLuz(await linterna(!luz))}
                  accessibilityLabel={luz ? 'Apagar linterna' : 'Encender linterna'}
                  style={[st.luz, luz && st.luzOn]}
                >
                  <Icon name="flash" size={22} color={luz ? '#111' : '#fff'} />
                </Pressable>
              </SafeAreaView>
            )}
            <SafeAreaView edges={bordesNativos(['bottom'])} style={[st.barra, margenAbajo(space.lg)]}>
              <Pressable onPress={cerrar} hitSlop={12}><Text style={st.boton}>Cancelar</Text></Pressable>
              <Pressable
                onPress={disparar}
                disabled={!lista || procesando}
                accessibilityLabel="Hacer foto"
                style={[st.disparador, (!lista || procesando) && { opacity: 0.5 }]}
              >
                {procesando ? <ActivityIndicator color={colors.bg} /> : <View style={st.disparadorDentro} />}
              </Pressable>
              <Pressable onPress={galeria} hitSlop={12}><Text style={st.boton}>Galería</Text></Pressable>
            </SafeAreaView>
            {error && <Text style={[st.ayudaPeq, { bottom: 140, color: colors.red }]}>{error}</Text>}
          </View>
        )}
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: '#000' },
  sombra: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.6)' },
  marco: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', borderRadius: radius.md },
  esquina: { position: 'absolute', width: 28, height: 28, borderColor: colors.accent, borderRadius: 6 },
  ayuda: { position: 'absolute', left: space.lg, right: space.lg, textAlign: 'center', color: '#fff', fontSize: 20, fontWeight: '700' },
  ayudaPeq: { position: 'absolute', left: space.xl, right: space.xl, textAlign: 'center', color: 'rgba(255,255,255,0.85)', fontSize: 14 },
  barra: {
    position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.lg,
  },
  arriba: { position: 'absolute', top: 0, right: 0, padding: space.lg },
  luz: {
    width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
  },
  luzOn: { backgroundColor: '#FFD43B', borderColor: '#FFD43B' },
  boton: { color: '#fff', fontSize: 16, fontWeight: '600', minWidth: 72, textAlign: 'center' },
  disparador: {
    width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  disparadorDentro: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
  revision: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl, backgroundColor: colors.bg },
  titulo: { color: colors.text, fontSize: 22, fontWeight: '700' },
  texto: { color: colors.textMuted, fontSize: 15, textAlign: 'center' },
  previa: { width: '100%', aspectRatio: TARJETA, borderRadius: radius.md, backgroundColor: colors.card },
});
