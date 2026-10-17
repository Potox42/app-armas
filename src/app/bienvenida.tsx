import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Icon, type IconName } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui';
import { useStore } from '@/data/store';
import { colors, radius, space } from '@/theme';

const PUNTOS: { icon: IconName; titulo: string; texto: string }[] = [
  { icon: 'wallet', titulo: 'Tu cartera de tirador', texto: 'Permiso, licencias F, D y E, carnet y pase QR siempre a mano.' },
  { icon: 'shield', titulo: 'Armas y revistas', texto: 'Guías con foto, revistas cada 5 años y limpiezas por disparos.' },
  { icon: 'target', titulo: 'Entrena y mejora', texto: 'Marca tus impactos en la diana y sigue tu evolución.' },
  { icon: 'lock', titulo: 'Solo en tu móvil', texto: 'Datos cifrados, Face ID y copia de seguridad con contraseña.' },
];

export default function Bienvenida() {
  const store = useStore();
  const [nombre, setNombre] = useState(store.esEjemplo ? '' : store.datos.nombre);

  const terminar = (conEjemplo: boolean) => {
    if (!conEjemplo) store.empezarDeCero();
    if (nombre.trim() || !conEjemplo) store.guardarNombre(nombre.trim());
    store.guardarAjustes({ bienvenida: true });
    router.replace('/');
  };

  return (
    <SafeAreaView style={st.pantalla}>
      <ScrollView contentContainerStyle={st.contenido}>
        <View style={st.cabecera}>
          <Logo size={120} />
          <Text style={st.titulo}>Tirador Deportivo</Text>
          <Text style={st.lema}>Tu documentación y tus entrenamientos, en un solo sitio.</Text>
        </View>

        {PUNTOS.map((p) => (
          <View key={p.titulo} style={st.punto}>
            <View style={st.icono}><Icon name={p.icon} color={colors.accent} /></View>
            <View style={{ flex: 1 }}>
              <Text style={st.puntoTitulo}>{p.titulo}</Text>
              <Text style={st.puntoTexto}>{p.texto}</Text>
            </View>
          </View>
        ))}

        <Text style={st.etiqueta}>¿Cómo te llamas?</Text>
        <TextInput
          value={nombre}
          onChangeText={setNombre}
          placeholder="Tu nombre"
          placeholderTextColor={colors.textMuted}
          style={st.input}
          autoCapitalize="words"
        />

        <View style={{ gap: space.sm, marginTop: space.sm }}>
          <Button title="Empezar con mis datos" onPress={() => terminar(false)} />
          <Button title="Ver primero con datos de ejemplo" variant="secondary" onPress={() => terminar(true)} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg },
  contenido: { padding: space.xl, gap: space.lg, paddingBottom: space.xl * 2 },
  cabecera: { alignItems: 'center', gap: space.sm, marginTop: space.lg, marginBottom: space.md },
  titulo: { color: colors.text, fontSize: 28, fontWeight: '800', marginTop: space.md },
  lema: { color: colors.textMuted, fontSize: 15, textAlign: 'center' },
  punto: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  icono: {
    width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.accentSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  puntoTitulo: { color: colors.text, fontSize: 16, fontWeight: '700' },
  puntoTexto: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  etiqueta: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginTop: space.sm },
  input: {
    backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md,
    color: colors.text, paddingHorizontal: space.md, paddingVertical: 12, fontSize: 15,
  },
});
