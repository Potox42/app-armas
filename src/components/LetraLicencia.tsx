import { StyleSheet, Text, View } from 'react-native';
import type { TipoLicencia } from '@/data/types';
import { colors } from '@/theme';

/** Cada licencia tiene su color, para distinguir de un vistazo qué armas van con cuál. */
export function tonoLicencia(tipo: TipoLicencia): { fuerte: string; suave: string } {
  if (tipo === 'F') return { fuerte: colors.accent, suave: colors.accentSoft };
  if (tipo === 'E') return { fuerte: colors.purple, suave: colors.purpleSoft };
  return { fuerte: colors.orange, suave: colors.orangeSoft };
}

/** Cuadradito con la letra de la licencia (F, E o D) en su color. */
export function LetraLicencia({ tipo, grande }: { tipo: TipoLicencia; grande?: boolean }) {
  const t = tonoLicencia(tipo);
  return (
    <View
      accessibilityLabel={`Licencia ${tipo}`}
      style={[st.caja, grande && st.grande, { backgroundColor: t.suave, borderColor: t.fuerte }]}
    >
      <Text style={[st.letra, grande && st.letraGrande, { color: t.fuerte }]}>{tipo}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  caja: { minWidth: 26, height: 26, paddingHorizontal: 6, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  grande: { minWidth: 38, height: 38, borderRadius: 10 },
  letra: { fontSize: 14, fontWeight: '900' },
  letraGrande: { fontSize: 20 },
});
