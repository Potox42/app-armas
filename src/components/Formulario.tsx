import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { deTexto, formatear } from '@/lib/fechas';
import { colors, radius, space } from '@/theme';

export function Campo({ etiqueta, valor, onChange, placeholder, teclado, error, secreto }: {
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  teclado?: KeyboardTypeOptions;
  error?: string;
  secreto?: boolean;
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
        secureTextEntry={secreto}
        autoCapitalize={secreto ? 'none' : undefined}
        autoCorrect={secreto ? false : undefined}
        style={[st.input, error && { borderColor: colors.red }]}
      />
      {error && <Text style={st.error}>{error}</Text>}
    </View>
  );
}

/** «25102026» -> «25/10/2026»: las barras se ponen solas al escribir los números. */
export function conBarras(texto: string): string {
  const n = texto.replace(/\D/g, '').slice(0, 8);
  return [n.slice(0, 2), n.slice(2, 4), n.slice(4)].filter(Boolean).join('/');
}

/** Fecha dd/mm/aaaa escrita solo con números. Devuelve la fecha ISO, o '' si está vacía o mal escrita. */
export function CampoFecha({ etiqueta, valor, onChange, obligatorio }: {
  etiqueta: string;
  valor: string; // ISO o ''
  onChange: (iso: string) => void;
  obligatorio?: boolean;
}) {
  const [texto, setTexto] = useState(valor ? formatear(valor) : '');
  const iso = deTexto(texto);
  const error = texto && !iso ? 'Escribe día, mes y año: 8 números' : obligatorio && !texto ? 'Obligatoria' : undefined;
  return (
    <Campo
      etiqueta={etiqueta}
      valor={texto}
      placeholder="dd/mm/aaaa"
      teclado="number-pad"
      error={error}
      onChange={(t) => {
        const f = conBarras(t);
        setTexto(f);
        onChange(deTexto(f) ?? '');
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
