import { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, s } from '@/components/ui';
import { useStore } from '@/data/store';
import { abrirEnCalendario } from '@/lib/archivo';
import { caducidades, calendarioCaducidades, enlaceGoogleCalendar } from '@/lib/calendarioCaducidades';
import { formatear, hoyISO } from '@/lib/fechas';
import { colors, radius, space } from '@/theme';

/**
 * Manda las caducidades (licencias con su revista, carnet y pase) al calendario, que avisa aunque
 * la app esté cerrada: en la versión web la app no puede mandar notificaciones.
 * - Google Calendar: un botón por fecha (si el iPhone tiene la cuenta de Google, sale también allí).
 * - Calendario del iPhone: archivo .ics por la hoja «Compartir» (Mail → abrir adjunto → «Añadir todo»).
 */
export function AvisosCalendario() {
  const { datos } = useStore();
  const [hecho, setHecho] = useState<string | null>(null);
  const [anadidos, setAnadidos] = useState<string[]>([]);
  const { ics, eventos } = calendarioCaducidades(datos);
  const hoy = hoyISO();
  const lista = caducidades(datos).filter((c) => c.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (eventos === 0 || lista.length === 0) return null;

  const google = (id: string, url: string) => {
    Linking.openURL(url).catch((e) => console.error('No se pudo abrir Google Calendar', e));
    setAnadidos((x) => (x.includes(id) ? x : [...x, id]));
  };

  const iphone = () => {
    abrirEnCalendario('caducidades.ics', ics)
      .then(() => setHecho(Platform.OS === 'web'
        ? 'Elige Mail y envíatelo. Al abrir el adjunto en el iPhone toca «Añadir todo». Si cambias una fecha, vuelve a enviarlo.'
        : 'Si el iPhone pregunta, toca «Añadir todo». Si cambias una fecha, vuelve a añadirlos.'))
      .catch((e) => console.error('No se pudo compartir el calendario', e));
  };

  return (
    <Card style={{ gap: space.md }}>
      <Text style={s.text}>Avisos en el calendario</Text>
      <Text style={s.muted}>
        Google Calendar: toca «+ Google» en cada fecha y luego «Guardar». Si tu iPhone tiene la cuenta de Google, también saldrá en su Calendario.
      </Text>
      {lista.map((c) => {
        const ok = anadidos.includes(c.id);
        return (
          <View key={c.id} style={st.fila}>
            <View style={{ flex: 1 }}>
              <Text style={s.text}>Caduca {c.nombre}</Text>
              <Text style={s.muted}>{formatear(c.fecha)}</Text>
            </View>
            <Pressable onPress={() => google(c.id, enlaceGoogleCalendar(c))} style={[st.boton, ok && st.hecho]}>
              <Text style={st.textoBoton}>{ok ? '✓ Añadido' : '+ Google'}</Text>
            </Pressable>
          </View>
        );
      })}
      <Text style={s.muted}>
        Calendario del iPhone: {eventos} recordatorios a las 10:00 (3 meses antes, 1 mes antes y el día que caduca). Te avisan aunque no abras la app.
      </Text>
      <Button title={Platform.OS === 'web' ? 'Enviar archivo para el iPhone' : 'Añadir al calendario'} variant="secondary" onPress={iphone} />
      {hecho && <Text style={{ color: colors.green, fontSize: 13 }}>{hecho}</Text>}
    </Card>
  );
}

const st = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.sm },
  boton: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardAlt },
  hecho: { borderColor: colors.green },
  textoBoton: { color: colors.text, fontWeight: '700', fontSize: 14 },
});
