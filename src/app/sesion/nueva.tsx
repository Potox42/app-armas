import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { FotoArma } from '@/components/FotoArma';
import { Button, Card, Screen, Segmented, s } from '@/components/ui';
import { useStore } from '@/data/store';
import type { Modalidad, Registro } from '@/data/types';
import { calibreEnMm, DIANAS, dianaPara } from '@/lib/diana';
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
  const [series, setSeries] = useState(String(ultima?.seriesPrevistas ?? 0) as '0' | '4' | '6');
  const [registro, setRegistro] = useState<Registro>(ultima?.registro ?? 'diana');

  const arma = armas.find((a) => a.id === armaId);
  const diana = DIANAS[dianaPara(modalidad, distancia, arma?.tipo)];
  // En aire comprimido el balín es de 4,5 mm aunque el arma no lo diga.
  const calibreMm = distancia === 10 ? diana.calibre : calibreEnMm(arma?.calibre, diana.calibre);

  const empezar = () => {
    if (!armaId) return;
    const id = store.nuevaSesion({
      armaId, modalidad, distancia, municion: municion.trim(), disparosPorSerie: Number(porSerie),
      seriesPrevistas: Number(series) || undefined, registro, diana: diana.id, calibreMm,
    });
    router.replace(`/sesion/${id}`);
  };

  return (
    <Screen title="Nueva sesión" back="/entrenar">
      <Text style={st.paso}>1. Arma</Text>
      {armas.length === 0 && (
        <Card style={{ gap: space.md }}>
          <Text style={s.muted}>Primero añade un arma.</Text>
          <Button title="Añadir arma" onPress={() => router.push('/arma/editar')} />
        </Card>
      )}
      {armas.map((a) => (
        <Pressable key={a.id} onPress={() => setArmaId(a.id)}>
          <Card style={[st.arma, a.id === armaId && st.elegida]}>
            <FotoArma arma={a} ancho={80} />
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

      <Text style={st.paso}>6. Número de series</Text>
      <Segmented
        value={series}
        onChange={setSeries}
        options={[{ value: '0', label: 'Libre' }, { value: '4', label: '4' }, { value: '6', label: '6' }]}
      />

      <Text style={st.paso}>7. Cómo apuntas los disparos</Text>
      <Segmented
        value={registro}
        onChange={setRegistro}
        options={[
          { value: 'camara', label: 'Cámara' },
          { value: 'foto', label: 'Foto' },
          { value: 'diana', label: 'Diana' },
          { value: 'teclado', label: 'Números' },
        ]}
      />
      <Text style={s.muted}>
        {registro === 'camara'
          ? 'Pon el móvil en el catalejo apuntando a la diana: la app ve cada impacto nuevo y lo apunta solo, con su puntuación y su sitio.'
          : registro === 'foto'
            ? 'Al acabar la serie haces una foto a la diana: la app propone los agujeros y su puntuación, y tú los revisas.'
            : registro === 'diana'
            ? 'Marcas dónde entró cada disparo: la app calcula la puntuación y tu agrupación.'
            : 'Más rápido: tocas la puntuación de cada disparo (10, 9, 8…). No guarda dónde entró.'}
      </Text>

      <Text style={[s.muted, { marginTop: space.sm }]}>
        Diana: {diana.nombre} · bala de {String(calibreMm).replace('.', ',')} mm{arma?.calibre && distancia !== 10 ? ` (${arma.calibre})` : ''}
      </Text>
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
