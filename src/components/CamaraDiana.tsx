import { Text } from 'react-native';
import { Card, s } from '@/components/ui';
import type { PropsCamaraDiana } from './CamaraDiana.types';

// En la app instalada (iOS/Android) la detección irá con la cámara nativa; de momento solo
// está en la versión web.
export function CamaraDiana(_props: PropsCamaraDiana) {
  return (
    <Card>
      <Text style={s.muted}>La detección con la cámara de momento solo funciona en la versión web. Marca los impactos tocando la diana.</Text>
    </Card>
  );
}
