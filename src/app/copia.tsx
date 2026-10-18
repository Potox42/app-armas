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
import { bajarCopia, ErrorServidor, huella, infoServidor, subirCopia } from '@/lib/nube';
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
  const nube = store.ajustes.nube;
  const [urlS, setUrlS] = useState(nube?.url ?? '');
  const [claveS, setClaveS] = useState(nube?.clave ?? '');
  const [contraS, setContraS] = useState('');
  const [contraS2, setContraS2] = useState('');

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

  const fallo = (e: unknown, porDefecto: string) =>
    setError(e instanceof ErrorServidor || e instanceof ErrorCopia ? e.message : porDefecto);

  const activarServidor = async () => {
    setError(null);
    setHecho(null);
    if (!/^https:\/\//i.test(urlS.trim()) || !claveS.trim()) {
      setError('Escribe la dirección completa de copia.php (empieza por https://) y la clave del servidor.');
      return;
    }
    if (contraS.length < MIN_CONTRASENA || contraS2 !== contraS) {
      setError('Escribe la contraseña de la copia dos veces (mínimo 8 caracteres).');
      return;
    }
    setOcupado('Comprobando tu servidor…');
    try {
      await infoServidor({ url: urlS, clave: claveS });
      const config = { url: urlS.trim(), clave: claveS.trim(), contrasena: contraS };
      setOcupado('Subiendo la primera copia…');
      const ultima = await subirCopia(store.datos, config);
      store.guardarAjustes({ nube: { ...config, ultima, huella: huella(store.datos) }, ultimaCopia: ultima.slice(0, 10) });
      setContraS('');
      setContraS2('');
      setHecho('Copia automática activada. A partir de ahora se sube sola cada vez que cambien tus datos.');
    } catch (e) {
      fallo(e, 'No se pudo activar la copia automática.');
    } finally {
      setOcupado(null);
    }
  };

  const subirAhora = async () => {
    if (!nube) return;
    setError(null);
    setHecho(null);
    setOcupado('Subiendo la copia…');
    try {
      const ultima = await subirCopia(store.datos, nube);
      store.guardarAjustes({ nube: { ...nube, ultima, huella: huella(store.datos), error: undefined }, ultimaCopia: ultima.slice(0, 10) });
      setHecho('Copia subida a tu servidor.');
    } catch (e) {
      fallo(e, 'No se pudo subir la copia.');
    } finally {
      setOcupado(null);
    }
  };

  const traerDelServidor = async () => {
    setError(null);
    setHecho(null);
    if (!/^https:\/\//i.test(urlS.trim()) || !claveS.trim()) {
      setError('Escribe la dirección de copia.php y la clave del servidor.');
      return;
    }
    setOcupado('Descargando la copia de tu servidor…');
    try {
      setArchivo(await bajarCopia({ url: urlS, clave: claveS }));
      setHecho('Copia descargada. Escribe su contraseña abajo, en «Restaurar copia».');
    } catch (e) {
      fallo(e, 'No se pudo descargar la copia.');
    } finally {
      setOcupado(null);
    }
  };

  const desactivar = () =>
    confirmar('Desactivar la copia automática', 'Las copias que ya están en tu servidor no se borran.', () => {
      store.guardarAjustes({ nube: undefined });
      setHecho('Copia automática desactivada.');
    }, 'Desactivar');

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
        <Text style={st.titulo}>Copia automática en tu servidor</Text>
        {nube ? (
          <>
            <Text style={s.muted}>
              Activada. Cada vez que cambian tus datos, la app sube una copia cifrada a tu servidor (se guardan las 5 últimas).
            </Text>
            <Text style={s.text}>
              {nube.ultima
                ? `Última copia subida: ${formatear(nube.ultima.slice(0, 10))} a las ${new Date(nube.ultima).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
                : 'Aún no se ha subido ninguna copia.'}
            </Text>
            {nube.error && <Text style={{ color: colors.orange }}>La última vez no se pudo subir: {nube.error}</Text>}
            <Button title="Subir copia ahora" variant="secondary" onPress={subirAhora} />
            <Button title="Desactivar" variant="secondary" onPress={desactivar} />
          </>
        ) : (
          <>
            <Text style={s.muted}>
              La app cifra tus datos en el móvil con una contraseña y los sube sola a tu hosting. En el servidor solo queda un
              archivo ilegible. Necesitas haber subido copia.php a tu web.
            </Text>
            <Campo etiqueta="Dirección de copia.php" valor={urlS} onChange={setUrlS} placeholder="https://www.tudominio.es/tirador/copia.php" teclado="url" />
            <Campo etiqueta="Clave del servidor" valor={claveS} onChange={setClaveS} secreto />
            <Campo etiqueta="Contraseña de la copia" valor={contraS} onChange={setContraS} secreto />
            <Campo etiqueta="Repite la contraseña" valor={contraS2} onChange={setContraS2} secreto />
            <Text style={s.muted}>Apunta la contraseña en un sitio seguro: sin ella las copias no se pueden abrir.</Text>
            <Button title="Activar copia automática" onPress={activarServidor} />
            <Button title="Recuperar desde mi servidor" variant="secondary" onPress={traerDelServidor} />
          </>
        )}
      </Card>

      <Card style={{ gap: space.md }}>
        <Text style={st.titulo}>Crear copia en un archivo</Text>
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
