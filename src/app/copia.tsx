import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Campo } from '@/components/Formulario';
import { Button, Card, Screen, s } from '@/components/ui';
import { guardarFoto } from '@/data/db';
import { useStore } from '@/data/store';
import { compartirArchivo, elegirArchivo } from '@/lib/archivo';
import { confirmar } from '@/lib/confirmar';
import { abrirCopia, crearCopia, ErrorCopia, MIN_CONTRASENA } from '@/lib/copia';
import { formatear, hoyISO } from '@/lib/fechas';
import { colors, space } from '@/theme';

export default function Copia() {
  const store = useStore();
  const [clave, setClave] = useState('');
  const [repetida, setRepetida] = useState('');
  const [archivo, setArchivo] = useState<string | null>(null);
  const [claveCopia, setClaveCopia] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);

  const errorClave = clave && clave.length < MIN_CONTRASENA ? `Mínimo ${MIN_CONTRASENA} caracteres` : undefined;
  const errorRepetida = repetida && repetida !== clave ? 'No coincide' : undefined;

  const exportar = async () => {
    setError(null);
    setHecho(null);
    if (clave.length < MIN_CONTRASENA || repetida !== clave) {
      setError('Escribe la contraseña dos veces (mínimo 8 caracteres).');
      return;
    }
    setOcupado('Cifrando tus datos…');
    try {
      const texto = await crearCopia(store.datos, clave);
      await compartirArchivo(`tirador-${hoyISO()}.tirador`, texto);
      store.guardarAjustes({ ultimaCopia: hoyISO() });
      setHecho('Copia creada. Guárdala en Archivos o iCloud Drive y apunta la contraseña en un sitio seguro.');
      setClave('');
      setRepetida('');
    } catch (e) {
      console.error(e);
      setError('No se pudo crear la copia.');
    } finally {
      setOcupado(null);
    }
  };

  const elegir = async () => {
    setError(null);
    setHecho(null);
    try {
      setArchivo(await elegirArchivo());
    } catch {
      setError('No se pudo leer el archivo.');
    }
  };

  const restaurar = async () => {
    if (!archivo) return;
    setError(null);
    setOcupado('Descifrando la copia…');
    try {
      const { datos, fotos } = await abrirCopia(archivo, claveCopia);
      setOcupado(null);
      confirmar(
        'Restaurar copia',
        `Se sustituirán los datos de este móvil por los de la copia (${datos.armas.length} armas, ${datos.permiso.licencias.length} licencias, ${datos.sesiones.length} entrenamientos).`,
        () => {
          (async () => {
            for (const [id, f] of Object.entries(fotos)) await guardarFoto(id, f);
            store.restaurar(datos);
            router.replace('/');
          })().catch(() => setError('No se pudieron guardar los datos de la copia.'));
        },
        'Restaurar',
      );
    } catch (e) {
      setError(e instanceof ErrorCopia ? e.message : 'No se pudo abrir la copia.');
      setOcupado(null);
    }
  };

  return (
    <Screen title="Copia de seguridad" back="/perfil">
      <Text style={s.muted}>
        Tus datos solo están en este móvil. Con una copia cifrada puedes recuperarlos si cambias de iPhone o lo pierdes.
      </Text>
      <Text style={s.text}>
        {store.ajustes.ultimaCopia ? `Última copia: ${formatear(store.ajustes.ultimaCopia)}` : 'Aún no has guardado ninguna copia desde este móvil.'}
      </Text>

      <Card style={{ gap: space.md }}>
        <Text style={st.titulo}>Crear copia</Text>
        <Text style={s.muted}>
          Elige una contraseña para la copia. Sin ella no se puede abrir: ni nosotros podemos recuperarla.
        </Text>
        <Campo etiqueta="Contraseña" valor={clave} onChange={setClave} secreto error={errorClave} />
        <Campo etiqueta="Repite la contraseña" valor={repetida} onChange={setRepetida} secreto error={errorRepetida} />
        <Button title="Crear y guardar copia" onPress={exportar} />
      </Card>

      <Card style={{ gap: space.md }}>
        <Text style={st.titulo}>Restaurar copia</Text>
        {!archivo ? (
          <Button title="Elegir archivo .tirador" variant="secondary" onPress={elegir} />
        ) : (
          <>
            <Text style={s.muted}>Archivo elegido. Escribe su contraseña.</Text>
            <Campo etiqueta="Contraseña de la copia" valor={claveCopia} onChange={setClaveCopia} secreto />
            <Button title="Restaurar" onPress={restaurar} />
            <Button title="Elegir otro archivo" variant="secondary" onPress={elegir} />
          </>
        )}
      </Card>

      {ocupado && (
        <View style={st.fila}>
          <ActivityIndicator color={colors.accent} />
          <Text style={s.muted}>{ocupado}</Text>
        </View>
      )}
      {error && <Text style={{ color: colors.red }}>{error}</Text>}
      {hecho && <Text style={{ color: colors.green }}>{hecho}</Text>}
    </Screen>
  );
}

const st = StyleSheet.create({
  titulo: { color: colors.text, fontSize: 16, fontWeight: '700' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
