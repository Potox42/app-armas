import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, GunArt, Screen, Segmented, s } from '@/components/ui';
import { useStore } from '@/data/store';
import type { Modalidad } from '@/data/types';
import { colors, radius, space } from '@/theme';

const DISTANCIAS = [25, 50, 10];

export default function NuevaSesion() {
  const store = useStore();
  const armas = store.datos.armas;
  const ultima = store.datos.sesiones[0];
  const [armaId, setArmaId] = useState(ultima?.armaId ?? armas[0]?.id);
  const [modalidad, setModalidad] = useState<Modalidad>(ultima?.modalidad ?? 'Precisión');
  const [distancia, setDistancia] = useState(ultima?.distancia ?? 25);
  const [municion, setMunicion] = useState(ultima?.municion ?? '');
  const [porSerie, setPorSerie] = useState(String(ultima?.disparosPorSerie ?? 10) as '5' | '10');

  const empezar = () => {
    if (!armaId) return;
    const id = store.nuevaSesion({
      armaId, modalidad, distancia, municion: municion.trim(), disparosPorSerie: Number(porSerie),
    });
    router.replace(`/sesion/${id}`);
  };

  return (
    <Screen title="Nueva sesión" back>
      <Text style={st.paso}>1. Arma</Text>
      {armas.map((a) => (
        <Pressable key={a.id} onPress={() => setArmaId(a.id)}>
          <Card style={[st.arma, a.id === armaId && st.elegida]}>
            <GunArt tipo={a.tipo} width={80} />
            <View>
              <Text style={st.nombre}>{a.marca} {a.modelo}</Text>
              <Text style={s.muted}>{a.tipo} · {a.calibre}</Text>
            </View>
          </Card>
        </Pressable>
      ))}

      <Text style={st.paso}>2. Modalidad</Text>
      <Segmented
        value={modalidad}
        onChange={setModalidad}
        options={(['Precisión', 'Tiro rápido', 'Standard', 'Otra'] as Modalidad[]).map((m) => ({ value: m, label: m }))}
      />

      <Text style={st.paso}>3. Distancia</Text>
      <Segmented
        value={String(distancia)}
        onChange={(v) => setDistancia(Number(v))}
        options={DISTANCIAS.map((d) => ({ value: String(d), label: `${d} metros` }))}
      />

      <Text style={st.paso}>4. Munición</Text>
      <TextInput
        value={municion}
        onChangeText={setMunicion}
        placeholder="Ej.: RWS R50 .22 LR"
        placeholderTextColor={colors.textMuted}
        style={st.input}
      />

      <Text style={st.paso}>5. Disparos por serie</Text>
      <Segmented value={porSerie} onChange={setPorSerie} options={[{ value: '5', label: '5' }, { value: '10', label: '10' }]} />

      <Text style={[s.muted, { marginTop: space.sm }]}>Diana: pistola precisión ISSF (25 m / 50 m)</Text>
      <Button title="Empezar" onPress={empezar} />
    </Screen>
  );
}

const st = StyleSheet.create({
  paso: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: space.sm },
  arma: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  elegida: { borderColor: colors.accent, borderWidth: 2 },
  nombre: { color: colors.text, fontSize: 16, fontWeight: '700' },
  input: {
    backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md,
    color: colors.text, paddingHorizontal: space.md, paddingVertical: 12, fontSize: 15,
  },
});
