import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { Button, s } from '@/components/ui';
import type { Datos, Sesion } from '@/data/types';
import { enviarEntrenosPdf, prepararPdf } from '@/lib/enviarPdf';
import { colors, space } from '@/theme';

/** Botón «Enviar en PDF»: crea el PDF del entreno (o de varios) y abre Compartir (WhatsApp, correo…). */
export function EnviarPdf({ datos, sesiones, titulo, variant = 'secondary' }: {
  datos: Datos;
  sesiones: Sesion[];
  titulo?: string;
  variant?: 'primary' | 'secondary';
}) {
  const [estado, setEstado] = useState<'listo' | 'creando' | 'otraVez' | 'descargado' | 'error'>('listo');
  // La librería del PDF se carga al abrir la pantalla: así «Compartir» se abre justo al tocar.
  useEffect(() => {
    prepararPdf().catch(() => {});
  }, []);
  if (!sesiones.length) return null;
  const n = sesiones.length;
  const enviar = () => {
    setEstado('creando');
    enviarEntrenosPdf(datos, sesiones)
      .then((r) => setEstado(r === 'otraVez' ? 'otraVez' : r === 'descargado' ? 'descargado' : 'listo'))
      .catch((e) => {
        console.error('No se pudo crear el PDF', e);
        setEstado('error');
      });
  };
  return (
    <View style={{ gap: space.xs }}>
      <Button
        title={estado === 'otraVez' ? 'PDF listo · toca para enviarlo' : estado === 'creando' ? 'Creando el PDF…' : titulo ?? (n === 1 ? 'Enviar en PDF' : `Enviar ${n} entrenos en PDF`)}
        variant={estado === 'otraVez' ? 'primary' : variant}
        onPress={estado === 'creando' ? () => {} : enviar}
      />
      <Text style={[s.muted, { fontSize: 12, textAlign: 'center' }, estado === 'error' && { color: colors.red }]}>
        {estado === 'error'
          ? 'No se ha podido crear el PDF. Inténtalo de nuevo.'
          : estado === 'descargado'
            ? 'PDF descargado: está en la carpeta de descargas.'
            : Platform.OS === 'web'
              ? 'Se abre Compartir: elige WhatsApp, Mail o «Guardar en Archivos».'
              : 'Se abre Compartir: elige WhatsApp, Mail o Archivos.'}
      </Text>
    </View>
  );
}
