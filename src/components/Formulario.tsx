import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { deTexto, formatear } from '@/lib/fechas';
import { colors, radius, space } from '@/theme';

export function Campo({ etiqueta, valor, onChange, placeholder, teclado, error }: {
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  teclado?: KeyboardTypeOptions;
  error?: string;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={st.etiqueta}>{etiqueta}</Text>
      <TextInput
        value={valor}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={teclado}
        style={[st.input, error && { borderColor: colors.red }]}
      />
      {error && <Text style={st.error}>{error}</Text>}
    </View>
  );
}

/** Fecha escrita como dd/mm/aaaa. Devuelve la fecha ISO, o '' si está vacía o mal escrita. */
export function CampoFecha({ etiqueta, valor, onChange, obligatorio }: {
  etiqueta: string;
  valor: string; // ISO o ''
  onChange: (iso: string) => void;
  obligatorio?: boolean;
}) {
  const [texto, setTexto] = useState(valor ? formatear(valor) : '');
  const iso = deTexto(texto);
  const error = texto && !iso ? 'Escribe la fecha como dd/mm/aaaa' : obligatorio && !texto ? 'Obligatoria' : undefined;
  return (
    <Campo
      etiqueta={etiqueta}
      valor={texto}
      placeholder="dd/mm/aaaa"
      teclado="numbers-and-punctuation"
      error={error}
      onChange={(t) => {
        setTexto(t);
        onChange(deTexto(t) ?? '');
      }}
    />
  );
}

export const formSt = StyleSheet.create({
  fila: { flexDirection: 'row', gap: space.sm },
});

const st = StyleSheet.create({
  etiqueta: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  input: {
    backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md,
    color: colors.text, paddingHorizontal: space.md, paddingVertical: 12, fontSize: 15,
  },
  error: { color: colors.red, fontSize: 12 },
});
