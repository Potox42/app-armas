import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { FotoArma } from '@/components/FotoArma';
import { Icon } from '@/components/Icon';
import { Button, Card, Screen, Segmented, s } from '@/components/ui';
import { nuevoId, useStore } from '@/data/store';
import type { Modalidad, Plantilla, Registro } from '@/data/types';
import { confirmar } from '@/lib/confirmar';
import { calibreEnMm, DIANAS, dianaPara } from '@/lib/diana';
import { colors, radius, space } from '@/theme';

const DISTANCIAS = [25, 50, 10];

// Programas de las pruebas ISSF (nº de series y disparos; los tiempos no se controlan aquí).
// Standard: 60 disparos en 12 series de 5 (en.wikipedia.org, «ISSF 25 meter standard pistol»).
const PROGRAMAS: Omit<Plantilla, 'id'>[] = [
  { nombre: 'Pistola 25 m · precisión 6×5', modalidad: 'Precisión', distancia: 25, disparosPorSerie: 5, seriesPrevistas: 6 },
  { nombre: 'Pistola standard 12×5', modalidad: 'Standard', distancia: 25, disparosPorSerie: 5, seriesPrevistas: 12 },
  { nombre: 'Pistola aire 10 m · 6×10', modalidad: 'Precisión', distancia: 10, disparosPorSerie: 10, seriesPrevistas: 6 },
];

export default function NuevaSesion() {
  const store = useStore();
  const armas = store.datos.armas;
  const ultima = store.datos.sesiones[0];
  const [armaId, setArmaId] = useState(ultima?.armaId ?? armas[0]?.id);
  const [modalidad, setModalidad] = useState<Modalidad>(ultima?.modalidad ?? 'Precisión');
  const [distancia, setDistancia] = useState(ultima?.distancia ?? 25);
  const [municion, setMunicion] = useState(ultima?.municion ?? '');
  const [porSerie, setPorSerie] = useState(String(ultima?.disparosPorSerie ?? 10) as '5' | '10' | '0');
  const [series, setSeries] = useState(String(ultima?.seriesPrevistas ?? 0));
  const [registro, setRegistro] = useState<Registro>(ultima?.registro ?? 'diana');
  const [nombrePlantilla, setNombrePlantilla] = useState<string | null>(null); // abierto: guardar como plantilla
  const plantillas = store.datos.plantillas ?? [];

  const aplicar = (p: Omit<Plantilla, 'id'>) => {
    if (p.armaId && armas.some((a) => a.id === p.armaId)) setArmaId(p.armaId);
    setModalidad(p.modalidad);
    setDistancia(p.distancia);
    if (p.municion !== undefined) setMunicion(p.municion);
    setPorSerie(String(p.disparosPorSerie) as '5' | '10' | '0');
    setSeries(String(p.seriesPrevistas ?? 0));
    if (p.registro) setRegistro(p.registro);
  };
  const guardarPlantilla = () => {
    const nombre = nombrePlantilla?.trim();
    if (!nombre) return;
    store.guardarPlantilla({
      id: nuevoId('plantilla'), nombre, armaId, modalidad, distancia, municion: municion.trim() || undefined,
      disparosPorSerie: Number(porSerie), seriesPrevistas: Number(series) || undefined, registro,
    });
    setNombrePlantilla(null);
  };

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
      <Text style={st.paso}>Empezar desde una plantilla</Text>
      <View style={st.plantillas}>
        {plantillas.map((p) => (
          <Pressable key={p.id} onPress={() => aplicar(p)} onLongPress={() => confirmar('Borrar plantilla', `Se borrará «${p.nombre}».`, () => store.borrarPlantilla(p.id))} style={[st.plantilla, st.propia]}>
            <Text style={st.plantillaTexto}>{p.nombre}</Text>
          </Pressable>
        ))}
        {PROGRAMAS.map((p) => (
          <Pressable key={p.nombre} onPress={() => aplicar(p)} style={st.plantilla}>
            <Text style={st.plantillaTexto}>{p.nombre}</Text>
          </Pressable>
        ))}
      </View>
      {plantillas.length > 0 && <Text style={[s.muted, { fontSize: 12 }]}>Mantén pulsada una plantilla tuya para borrarla.</Text>}

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
      <Segmented value={porSerie} onChange={setPorSerie} options={[{ value: '5', label: '5' }, { value: '10', label: '10' }, { value: '0', label: 'Libre' }]} />
      {porSerie === '0' && <Text style={s.muted}>Sin límite: tiras los que quieras en la diana y pulsas «Finalizar serie» cuando acabes.</Text>}

      <Text style={st.paso}>6. Número de series</Text>
      <Segmented
        value={series}
        onChange={setSeries}
        options={[{ value: '0', label: 'Libre' }, { value: '4', label: '4' }, { value: '6', label: '6' }, { value: '12', label: '12' }]}
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
        En la sesión apuntas todas las dianas del día: cuando cambies la hoja, pulsa «Cambiar de diana».
      </Text>
      <Text style={s.muted}>
        Diana: {diana.nombre} · bala de {String(calibreMm).replace('.', ',')} mm{arma?.calibre && distancia !== 10 ? ` (${arma.calibre})` : ''}
      </Text>
      <Button title="Empezar" onPress={empezar} />
      {nombrePlantilla === null ? (
        <Pressable onPress={() => setNombrePlantilla(`${arma ? `${arma.modelo} · ` : ''}${modalidad} ${distancia} m`)} style={st.guardar}>
          <Icon name="plus" size={16} color={colors.accent} />
          <Text style={{ color: colors.accent, fontWeight: '700' }}>Guardar esta configuración como plantilla</Text>
        </Pressable>
      ) : (
        <Card style={{ gap: space.sm }}>
          <Text style={s.text}>Nombre de la plantilla</Text>
          <TextInput value={nombrePlantilla} onChangeText={setNombrePlantilla} style={st.input} placeholderTextColor={colors.textMuted} />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}><Button title="Cancelar" variant="secondary" onPress={() => setNombrePlantilla(null)} /></View>
            <View style={{ flex: 1 }}><Button title="Guardar" onPress={guardarPlantilla} /></View>
          </View>
        </Card>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  paso: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: space.sm },
  arma: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  elegida: { borderColor: colors.accent, borderWidth: 2 },
  nombre: { color: colors.text, fontSize: 16, fontWeight: '700' },
  plantillas: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  plantilla: {
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardAlt,
  },
  propia: { borderColor: colors.accent },
  plantillaTexto: { color: colors.text, fontWeight: '700', fontSize: 13 },
  guardar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: space.md },
  input: {
    backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md,
    color: colors.text, paddingHorizontal: space.md, paddingVertical: 12, fontSize: 15,
  },
});
