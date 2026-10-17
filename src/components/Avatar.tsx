import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';
import { Icon } from './Icon';

function iniciales(nombre: string): string {
  return nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

/** Círculo con las iniciales del nombre (o un icono si no hay nombre). */
export function Avatar({ nombre, tamano = 48 }: { nombre: string; tamano?: number }) {
  const ini = iniciales(nombre);
  return (
    <View style={[st.circulo, { width: tamano, height: tamano, borderRadius: tamano / 2 }]}>
      {ini ? (
        <Text style={[st.texto, { fontSize: tamano * 0.4 }]}>{ini}</Text>
      ) : (
        <Icon name="user" color={colors.accent} size={tamano * 0.5} />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  circulo: {
    backgroundColor: colors.accentSoft, borderWidth: 2, borderColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  texto: { color: '#fff', fontWeight: '800' },
});
