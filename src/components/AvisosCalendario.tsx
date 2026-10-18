import { useState } from 'react';
import { Text } from 'react-native';
import { Button, Card, s } from '@/components/ui';
import { useStore } from '@/data/store';
import { abrirEnCalendario } from '@/lib/archivo';
import { calendarioCaducidades } from '@/lib/calendarioCaducidades';
import { colors, space } from '@/theme';

/**
 * Manda las caducidades (licencias con su revista, carnet y pase) al Calendario del iPhone,
 * que avisa aunque la app esté cerrada: en la versión web la app no puede mandar notificaciones.
 */
export function AvisosCalendario() {
  const { datos } = useStore();
  const [hecho, setHecho] = useState<string | null>(null);
  const { ics, eventos } = calendarioCaducidades(datos);
  if (eventos === 0) return null;

  const anadir = () => {
    abrirEnCalendario('caducidades.ics', ics)
      .then(() => setHecho('Si el iPhone pregunta, toca «Añadir todo». Si cambias una fecha, vuelve a añadirlos.'))
      .catch((e) => console.error('No se pudo abrir el calendario', e));
  };

  return (
    <Card style={{ gap: space.md }}>
      <Text style={s.text}>Avisos en el calendario del iPhone</Text>
      <Text style={s.muted}>
        {eventos} recordatorios a las 10:00: 3 meses antes, 1 mes antes y el día que caduca cada documento. Te avisan aunque no abras la app.
      </Text>
      <Button title="Añadir al calendario" variant="secondary" onPress={anadir} />
      {hecho && <Text style={{ color: colors.green, fontSize: 13 }}>{hecho}</Text>}
    </Card>
  );
}
