import { Text } from 'react-native';
import { Card, s } from '@/components/ui';
import type { PropsFotoDiana } from './FotoDiana.types';

// En la app instalada (iOS/Android) la lectura de la foto irá con el selector de imágenes nativo;
// de momento solo está en la versión web.
export function FotoDiana(_props: PropsFotoDiana) {
  return (
    <Card>
      <Text style={s.muted}>Puntuar con una foto de momento solo funciona en la versión web. Marca los impactos tocando la diana.</Text>
    </Card>
  );
}
