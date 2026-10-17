import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@/components/Icon';
import { Card, GunArt, Screen, Segmented, s } from '@/components/ui';
import { useStore } from '@/data/store';
import { disparosDesdeLimpieza } from '@/lib/avisos';
import { colors, space } from '@/theme';

type Filtro = 'todas' | 'cortas' | 'largas';

export default function Armas() {
  const { datos } = useStore();
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const cortas = datos.armas.filter((a) => a.tipo === 'Pistola' || a.tipo === 'Revólver');
  const largas = datos.armas.filter((a) => !cortas.includes(a));
  const lista = filtro === 'todas' ? datos.armas : filtro === 'cortas' ? cortas : largas;

  return (
    <Screen title="Mis armas">
      <Segmented
        value={filtro}
        onChange={setFiltro}
        options={[
          { value: 'todas', label: `Todas (${datos.armas.length})` },
          { value: 'cortas', label: `Cortas (${cortas.length})` },
          { value: 'largas', label: `Largas (${largas.length})` },
        ]}
      />
      {lista.map((a) => {
        const limpiar = disparosDesdeLimpieza(a) >= a.intervaloLimpieza;
        return (
          <Card key={a.id} onPress={() => router.push(`/arma/${a.id}`)} style={st.item}>
            <GunArt tipo={a.tipo} width={110} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={st.nombre}>{a.marca} {a.modelo}</Text>
              <Text style={s.muted}>{a.tipo} · {a.calibre}</Text>
              <Text style={s.muted}>{a.disparosTotales.toLocaleString('es-ES')} disparos</Text>
              <Text style={{ color: limpiar ? colors.orange : colors.green, fontSize: 13, fontWeight: '600' }}>
                ● {limpiar ? 'Limpieza pendiente' : 'Operativa'}
              </Text>
            </View>
            <Icon name="chevron" color={colors.textMuted} />
          </Card>
        );
      })}
    </Screen>
  );
}

const st = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  nombre: { color: colors.text, fontSize: 17, fontWeight: '700' },
});
