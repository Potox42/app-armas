import { Image, View } from 'react-native';
import type { Arma } from '@/data/types';
import { radius } from '@/theme';
import { useFoto } from './FotoCampo';
import { GunArt } from './ui';

/** Foto del arma si la hay; si no, su silueta. */
export function FotoArma({ arma, ancho }: { arma: Arma; ancho: number }) {
  const uri = useFoto(arma.foto);
  if (!uri) return <GunArt tipo={arma.tipo} width={ancho} />;
  return (
    <View style={{ width: ancho, height: ancho * 0.6, borderRadius: radius.sm, overflow: 'hidden' }}>
      <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
    </View>
  );
}
