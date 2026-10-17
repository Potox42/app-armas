import { useEffect, useState } from 'react';
import { Alert, Image, Platform, Pressable, StyleSheet, Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { guardarFoto, leerFoto } from '@/data/db';
import { colors, radius } from '@/theme';
import { Escaner } from './Escaner';
import { Icon } from './Icon';

async function elegir(origen: 'camara' | 'galeria'): Promise<string | null> {
  const opciones: ImagePicker.ImagePickerOptions = { mediaTypes: 'images', quality: 0.6, base64: true };
  if (origen === 'camara') {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) return null;
  }
  const r = origen === 'camara'
    ? await ImagePicker.launchCameraAsync(opciones)
    : await ImagePicker.launchImageLibraryAsync(opciones);
  if (r.canceled || !r.assets[0]) return null;
  const a = r.assets[0];
  if (a.base64) return `data:${a.mimeType ?? 'image/jpeg'};base64,${a.base64}`;
  return a.uri.startsWith('data:') ? a.uri : null;
}

interface Props {
  fotoId?: string;
  etiqueta: string;
  onChange: (fotoId: string | undefined) => void;
  proporcion?: number; // ancho / alto
  documento?: boolean; // tarjeta o documento: se fotografía con el recuadro y se recorta
  onEscaneado?: (dataUri: string) => void; // para leer los datos de la foto recién hecha
}

/** Carga una foto guardada (o null mientras no hay). */
export function useFoto(fotoId?: string): string | null {
  const [cargada, setCargada] = useState<{ id: string; uri: string | null } | null>(null);
  useEffect(() => {
    if (!fotoId) return;
    let vivo = true;
    leerFoto(fotoId).then((uri) => vivo && setCargada({ id: fotoId, uri })).catch(() => {});
    return () => {
      vivo = false;
    };
  }, [fotoId]);
  return fotoId && cargada?.id === fotoId ? cargada.uri : null;
}

/** Hueco de foto: muestra la imagen guardada (cifrada) y permite hacer, elegir o quitar la foto. */
export function FotoCampo({ fotoId, etiqueta, onChange, proporcion = 1.58, documento, onEscaneado }: Props) {
  const uri = useFoto(fotoId);
  const [escaneando, setEscaneando] = useState(false);

  const guardar = async (datos: string) => {
    const id = `foto-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    // La foto anterior no se borra aquí: el formulario aún puede cancelarse sin guardar.
    await guardarFoto(id, datos);
    onChange(id);
  };

  const poner = async (origen: 'camara' | 'galeria') => {
    const datos = await elegir(origen);
    if (datos) await guardar(datos);
  };

  const escaneado = async (datos: string) => {
    setEscaneando(false);
    await guardar(datos);
    onEscaneado?.(datos);
  };

  const quitar = () => onChange(undefined);

  const tocar = () => {
    // En web no hay menú nativo: los documentos abren el escáner (que tiene «Galería») y el resto, el selector.
    if (Platform.OS === 'web') {
      if (documento) setEscaneando(true);
      else poner('galeria');
      return;
    }
    Alert.alert(etiqueta, undefined, [
      documento
        ? { text: 'Escanear con recuadro', onPress: () => setEscaneando(true) }
        : { text: 'Hacer foto', onPress: () => poner('camara') },
      { text: 'Elegir de la galería', onPress: () => poner('galeria') },
      ...(fotoId ? [{ text: 'Quitar foto', style: 'destructive' as const, onPress: quitar }] : []),
      { text: 'Cancelar', style: 'cancel' as const },
    ]);
  };

  return (
    <>
      <Escaner visible={escaneando} titulo={etiqueta} proporcion={proporcion} onFoto={escaneado} onCerrar={() => setEscaneando(false)} />
      <Pressable onPress={tocar} style={[st.hueco, { aspectRatio: proporcion }, uri && st.conFoto]}>
        {uri ? (
          <Image source={{ uri }} style={st.imagen} resizeMode="cover" accessibilityLabel={etiqueta} />
        ) : (
          <>
            <Icon name="doc" color={colors.textMuted} size={28} />
            <Text style={st.texto}>{etiqueta}</Text>
            <Text style={st.ayuda}>{documento ? 'Toca para escanear' : 'Toca para añadir foto'}</Text>
          </>
        )}
      </Pressable>
    </>
  );
}

const st = StyleSheet.create({
  hueco: {
    flex: 1, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border,
    backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center', gap: 4, overflow: 'hidden',
  },
  conFoto: { borderStyle: 'solid' },
  imagen: { width: '100%', height: '100%' },
  texto: { color: colors.text, fontWeight: '600', fontSize: 13 },
  ayuda: { color: colors.textMuted, fontSize: 11 },
});
