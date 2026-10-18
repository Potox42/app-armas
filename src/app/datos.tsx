import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Icon, type IconName } from '@/components/Icon';
import { Button, Card, Screen, SectionTitle, s } from '@/components/ui';
import { useStore } from '@/data/store';
import type { Datos } from '@/data/types';
import { formatear } from '@/lib/fechas';
import { colors, space } from '@/theme';

const WEB = Platform.OS === 'web';

/** Fotos guardadas (documentos y armas). */
function contarFotos(d: Datos): number {
  const ids = [
    d.permiso.fotoAnverso, d.permiso.fotoReverso, d.federacion.fotoCarnet, d.federacion.fotoQr,
    ...d.armas.flatMap((a) => [a.foto, a.fotoGuiaAnverso, a.fotoGuiaReverso]),
    ...(d.documentos ?? []).map((x) => x.foto),
  ];
  return new Set(ids.filter(Boolean)).size;
}

/** «Tus datos»: dónde se guardan, cómo se protegen y qué no protege la app, sin letra pequeña. */
export default function TusDatos() {
  const store = useStore();
  const { datos, ajustes } = store;
  const cuentas: [string, number][] = [
    ['Licencias', datos.permiso.licencias.length],
    ['Armas', datos.armas.length],
    ['Entrenamientos', datos.sesiones.length],
    ['Competiciones', (datos.competiciones ?? []).length],
    ['Otros papeles', (datos.documentos ?? []).length],
    ['Fotos', contarFotos(datos)],
  ];
  const bloqueo = WEB ? !!ajustes.pin : ajustes.bloqueo;

  return (
    <Screen title="Tus datos" kicker="Privacidad" back="/perfil">
      <Punto icono="shield" titulo="Solo en este móvil">
        No hay cuenta ni servidor. La app no envía tus licencias, armas, fotos ni entrenamientos a ningún sitio.
        {WEB ? ' La app se descarga de GitHub Pages como cualquier página web, pero tus datos se quedan en el iPhone.' : ''}
      </Punto>
      <Punto icono="lock" titulo="Cifrados">
        {WEB
          ? 'Se guardan en el almacenamiento de Safari cifrados con AES-GCM de 256 bits. La clave la crea el propio móvil y no se puede copiar ni leer desde la página.'
          : 'Se guardan en una base de datos cifrada (SQLCipher). La clave está en el llavero del iPhone y solo sirve en este dispositivo.'}
      </Punto>
      <Punto icono="doc" titulo="Las fotos se leen en el móvil">
        La lectura de la licencia y de la guía y el recuento de la foto de la diana se hacen en el propio iPhone. La foto
        de la diana no se guarda.
      </Punto>

      <SectionTitle>Lo que no puede proteger</SectionTitle>
      <Punto icono="user" titulo="Tu móvil desbloqueado" aviso>
        Quien tenga tu iPhone desbloqueado y abra la app puede ver tus datos.{' '}
        {bloqueo
          ? `Tienes activado el bloqueo con ${WEB ? 'PIN' : 'Face ID'}.`
          : `Activa el bloqueo con ${WEB ? 'PIN' : 'Face ID'} en Perfil.`}
      </Punto>
      <Punto icono="trash" titulo="Si se borra la app, se borran los datos" aviso>
        {WEB
          ? 'Si quitas la app de la pantalla de inicio o borras los datos de Safari, se pierden. '
          : 'Si borras la app o cambias de móvil, se pierden. '}
        Nadie, tampoco yo, puede recuperarlos: solo tu copia de seguridad.
      </Punto>

      <SectionTitle>Copia de seguridad</SectionTitle>
      <Card style={{ gap: space.sm }}>
        <Text style={s.muted}>
          Es un archivo .tirador cifrado con AES-256-GCM. La clave sale de tu contraseña (PBKDF2-SHA256, 150.000
          vueltas): sin la contraseña no se puede abrir, y si la olvidas no hay forma de recuperarla.
        </Text>
        <Text style={s.text}>
          {ajustes.ultimaCopia ? `Última copia: ${formatear(ajustes.ultimaCopia)}` : 'Aún no has hecho ninguna copia desde este móvil.'}
        </Text>
        <Button title="Hacer una copia" variant="secondary" onPress={() => router.push('/copia')} />
      </Card>

      <SectionTitle>Qué hay guardado</SectionTitle>
      <Card style={{ paddingVertical: space.xs }}>
        {cuentas.map(([nombre, n], i) => (
          <View key={nombre} style={[st.fila, i > 0 && st.borde]}>
            <Text style={[s.text, { flex: 1 }]}>{nombre}</Text>
            <Text style={st.num}>{n}</Text>
          </View>
        ))}
      </Card>
      {store.esEjemplo && <Text style={[s.muted, { fontSize: 13 }]}>Ahora mismo son los datos de ejemplo.</Text>}
    </Screen>
  );
}

function Punto({ icono, titulo, aviso, children }: { icono: IconName; titulo: string; aviso?: boolean; children: ReactNode }) {
  return (
    <Card style={st.punto}>
      <Icon name={icono} color={aviso ? colors.orange : colors.green} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.text}>{titulo}</Text>
        <Text style={s.muted}>{children}</Text>
      </View>
    </Card>
  );
}

const st = StyleSheet.create({
  punto: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  fila: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.md },
  borde: { borderTopWidth: 1, borderTopColor: colors.border },
  num: { color: colors.text, fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
