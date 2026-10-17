import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';
import { Degradado } from './Degradado';
import { Icon } from './Icon';

function iniciales(nombre: string): string {
  return nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

/** Cuadro redondeado con las iniciales del nombre (o un icono si no hay nombre). */
export function Avatar({ nombre, tamano = 48 }: { nombre: string; tamano?: number }) {
  const ini = iniciales(nombre);
  return (
    <View style={[st.circulo, { width: tamano, height: tamano, borderRadius: tamano * 0.35 }]}>
      <Degradado desde="#4AA8FF" hasta="#215EC6" />
      {ini ? (
        <Text style={[st.texto, { fontSize: tamano * 0.4 }]}>{ini}</Text>
      ) : (
        <Icon name="user" color="#fff" size={tamano * 0.5} />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  circulo: {
    backgroundColor: colors.accent, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', zIndex: 0,
  },
  texto: { color: '#fff', fontWeight: '900' },
});
