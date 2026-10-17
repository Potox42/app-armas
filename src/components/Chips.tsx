import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space } from '@/theme';

/** Opciones en fila que saltan de línea si no caben. */
export function Chips<T extends string>({ opciones, valor, onChange }: {
  opciones: { value: T; label: string }[];
  valor: T | undefined;
  onChange: (v: T) => void;
}) {
  return (
    <View style={st.fila}>
      {opciones.map((o) => {
        const activo = o.value === valor;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={[st.chip, activo && st.activo]}>
            <Text style={[st.texto, activo && { color: '#fff' }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingHorizontal: space.md, paddingVertical: 8, borderRadius: radius.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  activo: { backgroundColor: colors.accent, borderColor: colors.accent },
  texto: { color: colors.textMuted, fontWeight: '600', fontSize: 14 },
});
