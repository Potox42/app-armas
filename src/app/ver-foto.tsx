import { Image, Pressable, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useFoto } from '@/components/FotoCampo';
import { volver } from '@/lib/volver';

/** Foto de un documento a pantalla completa (para enseñarla en el control del campo). */
export default function VerFoto() {
  const { id, titulo } = useLocalSearchParams<{ id: string; titulo?: string }>();
  const uri = useFoto(id);
  return (
    <Pressable style={st.fondo} onPress={() => volver('/campo')}>
      {titulo ? <Text style={st.titulo}>{titulo}</Text> : null}
      {uri ? <Image source={{ uri }} style={st.imagen} resizeMode="contain" /> : <Text style={st.texto}>Cargando…</Text>}
      <Text style={st.cerrar}>Toca para cerrar</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 12 },
  titulo: { color: '#fff', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  imagen: { width: '100%', flex: 1 },
  texto: { color: '#aaa' },
  cerrar: { color: '#888', paddingBottom: 24 },
});
