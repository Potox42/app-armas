import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Chips } from '@/components/Chips';
import { FotoCampo, useFoto } from '@/components/FotoCampo';
import { Icon } from '@/components/Icon';
import { AvisosCalendario } from '@/components/AvisosCalendario';
import { DocumentoLicencia } from '@/components/DocumentoLicencia';
import { DatoTarjeta, EstadoTarjeta, Tarjeta } from '@/components/Tarjeta';
import { Badge, Button, Card, FakeQr, Screen, Segmented, nivelColor, s } from '@/components/ui';
import { useStore } from '@/data/store';
import { nivelPorDias } from '@/lib/avisos';
import { diasHasta, formatear, plazo } from '@/lib/fechas';
import { cupoArmasD, cupoArmasE, cupoArmasF, LIMITES_E, MAXIMO_D } from '@/lib/papeles';
import { colors, space } from '@/theme';

type Vista = 'licencias' | 'federacion' | 'otros';

export default function Cartera() {
  const store = useStore();
  const { datos } = store;
  const { vista: inicial } = useLocalSearchParams<{ vista?: Vista }>();
  const [vista, setVista] = useState<Vista>(inicial ?? 'licencias');
  const documentos = datos.documentos ?? [];
  const f = datos.federacion;
  const qr = useFoto(f.fotoQr);
  const hayFederacion = !!(f.numeroFederado || f.caducidadCarnet || f.fotoCarnet || f.fotoQr);

  return (
    <Screen
      title="Mi cartera"
      right={
        <Pressable
          hitSlop={12}
          accessibilityLabel={vista === 'licencias' ? 'Editar licencia' : vista === 'federacion' ? 'Editar federación' : 'Añadir documento'}
          onPress={() => router.push(vista === 'licencias' ? '/licencia' : vista === 'federacion' ? '/federacion' : '/documento/editar')}
        >
          <Icon name="plus" color={colors.text} />
        </Pressable>
      }
    >
      <Segmented
        value={vista}
        onChange={setVista}
        options={[
          { value: 'licencias', label: 'Licencias' },
          { value: 'federacion', label: 'Federación' },
          { value: 'otros', label: 'Otros' },
        ]}
      />

      {vista === 'licencias' && (
        <>
          <DocumentoLicencia permiso={datos.permiso} onPress={() => router.push('/licencia')} />
          {datos.permiso.licencias.length === 0 ? (
            <Card style={{ gap: space.md }}>
              <Text style={s.muted}>Escanea tu tarjeta de licencia de armas: leo cada licencia (E, F, D) con sus fechas y te aviso antes de que caduquen.</Text>
              <Button title="Escanear la licencia" onPress={() => router.push('/licencia')} />
            </Card>
          ) : (
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <FotoCampo
                etiqueta="Anverso"
                documento
                fotoId={datos.permiso.fotoAnverso}
                onChange={(fotoAnverso) => store.actualizarPermiso({ fotoAnverso })}
              />
              <FotoCampo
                etiqueta="Reverso"
                documento
                fotoId={datos.permiso.fotoReverso}
                onChange={(fotoReverso) => store.actualizarPermiso({ fotoReverso })}
              />
            </View>
          )}
          <ArmasLicenciaF />
          <ArmasLicenciaE />
          <ArmasLicenciaD />
        </>
      )}

      {vista === 'otros' && (
        <>
          {documentos.length === 0 && (
            <Card style={{ gap: space.sm }}>
              <Text style={s.text}>Otros papeles</Text>
              <Text style={s.muted}>
                Guarda aquí el seguro, el certificado médico o cualquier otro documento que quieras tener a mano. Si tiene
                fecha de caducidad, te aviso antes.
              </Text>
            </Card>
          )}
          {documentos.map((d) => (
            <Card key={d.id} style={{ gap: space.sm }} onPress={() => router.push({ pathname: '/documento/editar', params: { id: d.id } })}>
              <View style={st.doc}>
                <Icon name={d.tipo === 'Seguro' ? 'shield' : 'doc'} color={colors.accent} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.text}>{d.nombre}</Text>
                  <Text style={s.muted}>{d.tipo}{d.numero ? ` · ${d.numero}` : ''}</Text>
                </View>
                {d.caducidad ? <Badge nivel={nivelPorDias(diasHasta(d.caducidad))}>{plazo(d.caducidad)}</Badge> : null}
              </View>
              {(d.foto || d.fotoReverso) && (
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  {d.foto ? <MiniFoto id={d.foto} titulo={`${d.nombre} · anverso`} /> : null}
                  {d.fotoReverso ? <MiniFoto id={d.fotoReverso} titulo={`${d.nombre} · reverso`} /> : null}
                </View>
              )}
            </Card>
          ))}
          <Button title="+  Añadir documento" onPress={() => router.push('/documento/editar')} />
        </>
      )}

      {vista === 'federacion' && (
        <>
          {hayFederacion ? (
            <Tarjeta
              tono="morado"
              etiqueta={f.nombre}
              titulo={datos.nombre || 'Carnet de federado'}
              sello="FED"
              onPress={() => router.push('/federacion')}
              pie={f.caducidadCarnet
                ? <EstadoTarjeta color={nivelColor(nivelPorDias(diasHasta(f.caducidadCarnet)))} texto={plazo(f.caducidadCarnet)} />
                : undefined}
            >
              <DatoTarjeta etiqueta="Nº de federado" valor={f.numeroFederado || '—'} />
              <DatoTarjeta etiqueta="Categoría" valor={f.categoria || '—'} />
              <DatoTarjeta etiqueta="Válido hasta" valor={f.caducidadCarnet ? formatear(f.caducidadCarnet) : '—'} />
            </Tarjeta>
          ) : (
            <Card style={{ gap: space.md }}>
              <Text style={st.titulo}>{f.nombre}</Text>
              <Text style={s.muted}>Añade tu número de federado, la foto del carnet y el QR del recinto.</Text>
              <Button title="Añadir carnet de federado" onPress={() => router.push('/federacion')} />
            </Card>
          )}
          <Card style={{ flexDirection: 'row', gap: space.sm }}>
            <FotoCampo
              etiqueta="Foto del carnet"
              documento
              fotoId={f.fotoCarnet}
              onChange={(fotoCarnet) => store.guardarFederacion({ ...f, fotoCarnet })}
            />
          </Card>
          <Card style={{ alignItems: 'center', gap: space.md }}>
            <Text style={st.titulo}>Pase de acceso al recinto</Text>
            {qr ? (
              <Image source={{ uri: qr }} style={{ width: 200, height: 200 }} resizeMode="contain" />
            ) : store.esEjemplo ? (
              <FakeQr size={170} />
            ) : (
              <Text style={s.muted}>Aún no has guardado la captura del QR.</Text>
            )}
            {f.codigoPase ? <Text style={s.muted}>Código: {f.codigoPase}</Text> : null}
            {f.caducidadPase ? <Text style={s.muted}>Válido hasta {formatear(f.caducidadPase)}</Text> : null}
            <View style={{ alignSelf: 'stretch' }}>
              {qr || store.esEjemplo ? (
                <Button title="Mostrar en grande" onPress={() => router.push('/pase')} />
              ) : (
                <Button title="Añadir captura del QR" onPress={() => router.push('/federacion')} />
              )}
            </View>
          </Card>
        </>
      )}

      <AvisosCalendario />
    </Screen>
  );
}

/**
 * Armas con la licencia F frente a las que permite su clase (art. 132 del Reglamento de Armas).
 * Si no se sabe la clase, se pregunta aquí mismo.
 */
function ArmasLicenciaF() {
  const store = useStore();
  const cupo = cupoArmasF(store.datos);
  if (!cupo) return null;
  const { licencia, armas, maximo } = cupo;
  if (maximo === null) {
    return (
      <Card style={{ gap: space.sm }}>
        <Text style={s.text}>¿De qué clase es tu licencia F?</Text>
        <Text style={s.muted}>Así te digo cuántas armas de concurso permite y cuántas tienes ya.</Text>
        <Chips
          opciones={['1', '2', '3'].map((c) => ({ value: c, label: `${c}ª clase` }))}
          valor={undefined}
          onChange={(categoria) => store.guardarLicencia({ ...licencia, categoria })}
        />
      </Card>
    );
  }
  const lleno = armas >= maximo;
  return (
    <Card style={{ gap: space.sm }} onPress={() => router.push('/armas')}>
      <View style={st.doc}>
        <Text style={[s.text, { flex: 1 }]}>Armas con tu licencia F ({licencia.categoria}ª clase)</Text>
        <Text style={{ color: armas > maximo ? colors.red : lleno ? colors.orange : colors.green, fontSize: 18, fontWeight: '900' }}>
          {armas} de {maximo}
        </Text>
      </View>
      <Text style={[s.muted, { fontSize: 13 }]}>
        {armas > maximo
          ? `Tienes más armas apuntadas con la F de las que permite la ${licencia.categoria}ª clase. Revisa a qué licencia va cada una.`
          : `La ${licencia.categoria}ª clase permite ${maximo === 1 ? 'un arma' : `hasta ${maximo} armas`} de concurso (art. 132 del Reglamento de Armas).`}
        {' '}Para cada arma más hace falta autorización previa de la Intervención de Armas.
      </Text>
    </Card>
  );
}

/** Miniatura de la foto de un documento: al tocarla se ve a pantalla completa. */
function MiniFoto({ id, titulo }: { id: string; titulo: string }) {
  const uri = useFoto(id);
  return (
    <Pressable
      style={st.mini}
      accessibilityLabel={titulo}
      onPress={() => router.push({ pathname: '/ver-foto', params: { id, titulo } })}
    >
      {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : null}
    </Pressable>
  );
}

/** Color del contador: verde si cabe, naranja si está justo en el límite, rojo si se pasa. */
function colorCupo(n: number, max: number) {
  return n > max ? colors.red : n === max ? colors.orange : colors.green;
}

/**
 * Armas con la licencia E: hasta 6 escopetas y 6 armas largas rayadas para tiro deportivo,
 * 12 en total (art. 101 del Reglamento de Armas).
 */
function ArmasLicenciaE() {
  const store = useStore();
  const cupo = cupoArmasE(store.datos);
  if (!cupo) return null;
  const { escopetas, rayadas, total } = cupo;
  const pasado = escopetas > LIMITES_E.escopetas || rayadas > LIMITES_E.rayadas || total > LIMITES_E.total;
  const filas: [string, number, number][] = [
    ['Escopetas', escopetas, LIMITES_E.escopetas],
    ['Armas largas rayadas', rayadas, LIMITES_E.rayadas],
  ];
  return (
    <Card style={{ gap: space.sm }} onPress={() => router.push('/armas')}>
      <View style={st.doc}>
        <Text style={[s.text, { flex: 1 }]}>Armas con tu licencia E</Text>
        <Text style={{ color: colorCupo(total, LIMITES_E.total), fontSize: 18, fontWeight: '900' }}>
          {total} de {LIMITES_E.total}
        </Text>
      </View>
      {filas.map(([nombre, n, max]) => (
        <View key={nombre} style={st.doc}>
          <Text style={[s.muted, { flex: 1 }]}>{nombre}</Text>
          <Text style={{ color: colorCupo(n, max), fontSize: 15, fontWeight: '800' }}>
            {n} de {max}
          </Text>
        </View>
      ))}
      <Text style={[s.muted, { fontSize: 13 }]}>
        {pasado
          ? 'Tienes más armas apuntadas con la E de las que permite. Revisa a qué licencia va cada una.'
          : 'La licencia E permite hasta 6 escopetas y 6 armas largas rayadas para tiro deportivo, 12 en total (art. 101 del Reglamento de Armas).'}
      </Text>
    </Card>
  );
}

/** Armas con la licencia D: hasta cinco armas largas rayadas para caza mayor. */
function ArmasLicenciaD() {
  const store = useStore();
  const cupo = cupoArmasD(store.datos);
  if (!cupo) return null;
  const { armas } = cupo;
  return (
    <Card style={{ gap: space.sm }} onPress={() => router.push('/armas')}>
      <View style={st.doc}>
        <Text style={[s.text, { flex: 1 }]}>Armas con tu licencia D</Text>
        <Text style={{ color: colorCupo(armas, MAXIMO_D), fontSize: 18, fontWeight: '900' }}>
          {armas} de {MAXIMO_D}
        </Text>
      </View>
      <Text style={[s.muted, { fontSize: 13 }]}>
        {armas > MAXIMO_D
          ? 'Tienes más armas apuntadas con la D de las que permite. Revisa a qué licencia va cada una.'
          : 'La licencia D permite hasta 5 armas largas rayadas para caza mayor.'}
      </Text>
    </Card>
  );
}

const st = StyleSheet.create({
  doc: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  mini: { flex: 1, aspectRatio: 1.58, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  titulo: { color: colors.text, fontSize: 16, fontWeight: '700' },
  cabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
