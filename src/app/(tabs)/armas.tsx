import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon } from '@/components/Icon';
import { FotoArma } from '@/components/FotoArma';
import { LetraLicencia, tonoLicencia } from '@/components/LetraLicencia';
import type { TipoLicencia } from '@/data/types';
import { Button, Card, Screen, Segmented, s } from '@/components/ui';
import { useStore } from '@/data/store';
import { disparosDesdeLimpieza } from '@/lib/avisos';
import { colors, space } from '@/theme';

type Filtro = 'todas' | 'cortas' | 'largas';

export default function Armas() {
  const { datos } = useStore();
  const [filtro, setFiltro] = useState<Filtro>('todas');
  // Desde la cartera se llega con ?licencia=F (o E, D): solo se ven las armas de esa licencia.
  const { licencia: tipoParam } = useLocalSearchParams<{ licencia?: TipoLicencia }>();
  const [tipoLic, setTipoLic] = useState<TipoLicencia | undefined>(tipoParam);
  useEffect(() => { setTipoLic(tipoParam); if (tipoParam) setFiltro('todas'); }, [tipoParam]);
  const licencia = tipoLic ? datos.permiso.licencias.find((l) => l.tipo === tipoLic) : undefined;
  const base = licencia ? datos.armas.filter((a) => a.licenciaId === licencia.id) : datos.armas;
  const cortas = base.filter((a) => a.tipo === 'Pistola' || a.tipo === 'Revólver');
  const largas = base.filter((a) => !cortas.includes(a));
  const lista = filtro === 'todas' ? base : filtro === 'cortas' ? cortas : largas;
  const tipoDe = (id: string) => datos.permiso.licencias.find((l) => l.id === id)?.tipo;
  const quitarFiltro = () => { setTipoLic(undefined); router.setParams({ licencia: undefined }); };

  return (
    <Screen
      title="Mis armas"
      right={
        <Pressable hitSlop={12} accessibilityLabel="Añadir arma" onPress={() => router.push('/arma/editar')}>
          <Icon name="plus" color={colors.text} />
        </Pressable>
      }
    >
      {licencia && (
        <View style={[st.aviso, { borderColor: tonoLicencia(licencia.tipo).fuerte, backgroundColor: tonoLicencia(licencia.tipo).suave }]}>
          <LetraLicencia tipo={licencia.tipo} />
          <Text style={[s.text, { flex: 1, fontWeight: '700' }]}>Armas con tu licencia {licencia.tipo}</Text>
          <Pressable hitSlop={10} onPress={quitarFiltro} accessibilityLabel="Ver todas las armas">
            <Text style={{ color: tonoLicencia(licencia.tipo).fuerte, fontWeight: '800' }}>Ver todas</Text>
          </Pressable>
        </View>
      )}
      <Segmented
        value={filtro}
        onChange={setFiltro}
        options={[
          { value: 'todas', label: `Todas (${base.length})` },
          { value: 'cortas', label: `Cortas (${cortas.length})` },
          { value: 'largas', label: `Largas (${largas.length})` },
        ]}
      />
      {licencia && base.length === 0 && datos.armas.length > 0 && (
        <Card style={{ gap: space.md }}>
          <Text style={s.muted}>No tienes armas apuntadas con la licencia {licencia.tipo}. Puedes cambiar la licencia de un arma al editarla.</Text>
          <Button title="Ver todas las armas" variant="secondary" onPress={quitarFiltro} />
        </Card>
      )}
      {datos.armas.length === 0 && (
        <Card style={{ gap: space.md }}>
          <Text style={s.muted}>Aún no has añadido armas. Añade cada una con su guía de pertenencia.</Text>
          <Button title="Añadir arma" onPress={() => router.push('/arma/editar')} />
        </Card>
      )}
      {lista.map((a) => {
        const limpiar = disparosDesdeLimpieza(a) >= a.intervaloLimpieza;
        const tipo = tipoDe(a.licenciaId);
        return (
          <Card key={a.id} onPress={() => router.push(`/arma/${a.id}`)} style={st.item}>
            <FotoArma arma={a} ancho={110} />
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Text style={[st.nombre, { flexShrink: 1 }]}>{a.marca} {a.modelo}</Text>
                {tipo ? <LetraLicencia tipo={tipo} /> : null}
              </View>
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
      {datos.armas.length > 0 && (
        <Button title="Añadir otra arma" variant="secondary" onPress={() => router.push('/arma/editar')} />
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  nombre: { color: colors.text, fontSize: 17, fontWeight: '700' },
  aviso: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1.5, borderRadius: 14, padding: space.md },
});
