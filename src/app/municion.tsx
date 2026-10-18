import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { BarraDeposito, ResumenMunicion } from '@/components/MunicionArma';
import { Card, Screen, s } from '@/components/ui';
import { useStore } from '@/data/store';
import { depositoPorCalibre, estadoMunicion, LIMITES } from '@/lib/municion';
import { colors, space } from '@/theme';

/** Munición de todas tus armas: cupo del año y cartuchos en casa. */
export default function Municion() {
  const { datos } = useStore();
  const calibres = depositoPorCalibre(datos.armas);
  const total = calibres.reduce((t, g) => ({ enCasa: t.enCasa + g.enCasa, max: t.max + g.maxDeposito }), { enCasa: 0, max: 0 });
  return (
    <Screen title="Munición" kicker="Control" back="/">
      {calibres.length > 0 && (
        <Card style={{ gap: space.md }}>
          <Text style={st.nombre}>En casa</Text>
          {calibres.map((g) => (
            <BarraDeposito
              key={g.calibre}
              d={g}
              titulo={g.armas.length > 1 ? `${g.calibre} · ${g.armas.length} armas` : `${g.calibre} · ${`${g.armas[0].marca} ${g.armas[0].modelo}`.trim()}`}
            />
          ))}
          {calibres.length > 1 && (
            <Text style={s.muted}>Total: {total.enCasa} cartuchos en casa; podrías guardar hasta {total.max} entre todos los calibres.</Text>
          )}
          <Text style={[s.muted, { fontSize: 12 }]}>
            Las armas del mismo calibre comparten cartuchos, así que se suma lo que puede guardar cada una.
          </Text>
        </Card>
      )}
      {datos.armas.length === 0 && (
        <Card><Text style={s.muted}>Añade tus armas en la pestaña Armas para llevar el control de su munición.</Text></Card>
      )}
      {datos.armas.map((a) => {
        const m = estadoMunicion(a);
        return (
          <Card key={a.id} onPress={() => router.push({ pathname: '/arma/[id]', params: { id: a.id, vista: 'municion' } })} style={{ gap: space.md }}>
            <View>
              <Text style={st.clase}>{LIMITES[m.clase].nombre.toUpperCase()} · {a.calibre}</Text>
              <Text style={st.nombre}>{`${a.marca} ${a.modelo}`.trim()}</Text>
            </View>
            <ResumenMunicion m={m} />
            <Text style={st.enlace}>Apuntar compra o gasto ›</Text>
          </Card>
        );
      })}
      <Card style={{ gap: space.sm }}>
        <Text style={s.text}>Límites para particulares</Text>
        <Text style={s.muted}>
          Arma corta: 100 cartuchos al año y 150 en casa por arma. Arma larga rayada: 1.000 al año y 200 en casa. Cartuchos de
          caza: sin límite de compra y 5.000 en casa. Lo que compras y gastas dentro del club o la federación no cuenta. Con
          autorización de la Guardia Civil puedes comprar más: cámbialo en cada arma.
        </Text>
        <Text style={[s.muted, { fontSize: 12 }]}>
          Fuente: Reglamento de artículos pirotécnicos y cartuchería (Real Decreto 989/2015), según licenciaf.com y
          tirofato.com. Confírmalo en tu Intervención de Armas.
        </Text>
      </Card>
    </Screen>
  );
}

const st = StyleSheet.create({
  clase: { color: colors.kicker, fontSize: 10, fontWeight: '900', letterSpacing: 1.6 },
  nombre: { color: colors.text, fontSize: 18, fontWeight: '800' },
  enlace: { color: colors.accent, fontWeight: '700' },
});
