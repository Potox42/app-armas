import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { volver } from '@/lib/volver';
import { Chips } from '@/components/Chips';
import { Campo, CampoFecha, formSt } from '@/components/Formulario';
import { FotoCampo } from '@/components/FotoCampo';
import { Icon } from '@/components/Icon';
import { Button, Card, Screen, SectionTitle, s } from '@/components/ui';
import { nuevoId, useStore } from '@/data/store';
import type { Licencia, PermisoArmas, TipoLicencia } from '@/data/types';
import { confirmar } from '@/lib/confirmar';
import { formatear, sumarAnios } from '@/lib/fechas';
import { combinar, leerLicencia } from '@/lib/leerLicencia';
import { leerTextos, ocrDisponible } from '@/lib/ocr';
import { colors, radius, space } from '@/theme';

const TIPOS: TipoLicencia[] = ['E', 'F', 'D'];

/** La tarjeta de licencia de armas: fotos, NIF y una fila por cada licencia (E, F, D). */
export default function EditarLicencia() {
  const store = useStore();
  const [p, setP] = useState<PermisoArmas>(store.datos.permiso);
  const [intentado, setIntentado] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; ok: boolean } | null>(null);
  // Cambia al rellenar con lo leído, para que los campos de fecha muestren el valor nuevo.
  const [version, setVersion] = useState(0);

  const filas = p.licencias;
  // Las licencias F, D y E tienen 5 años de validez (Ministerio del Interior).
  const hasta = (l: Licencia) => l.caducidad || (l.expedicion ? sumarAnios(l.expedicion, 5) : '');
  const repetidas = TIPOS.filter((t) => filas.filter((l) => l.tipo === t).length > 1);
  const valida = filas.every((l) => l.expedicion) && repetidas.length === 0;

  const cambiarFila = (id: string, cambio: Partial<Licencia>) =>
    setP((x) => ({ ...x, licencias: x.licencias.map((l) => (l.id === id ? { ...l, ...cambio } : l)) }));

  const anadirFila = () => {
    const libre = TIPOS.find((t) => !filas.some((l) => l.tipo === t)) ?? 'F';
    setP((x) => ({ ...x, licencias: [...x.licencias, { id: nuevoId('lic'), tipo: libre, expedicion: '', caducidad: '' }] }));
  };

  const quitarFila = (l: Licencia) => {
    const armas = store.datos.armas.filter((a) => a.licenciaId === l.id).length;
    const quitar = () => setP((x) => ({ ...x, licencias: x.licencias.filter((y) => y.id !== l.id) }));
    if (!armas) return quitar();
    confirmar(
      `Quitar licencia ${l.tipo}`,
      `Tiene ${armas} arma(s) asociadas. Al guardar pasarán a otra licencia.`,
      quitar,
      'Quitar',
    );
  };

  const leer = async (foto: string) => {
    if (!ocrDisponible) return;
    setLeyendo(true);
    setAviso(null);
    const d = combinar((await leerTextos(foto)).map((t) => leerLicencia(t)));
    setLeyendo(false);

    const leido: string[] = [];
    let sinLetra = 0;
    setP((x) => {
      let licencias = [...x.licencias];
      const poner = (tipo: TipoLicencia, desde: string, hastaF: string) => {
        const i = licencias.findIndex((l) => l.tipo === tipo);
        const fila = { expedicion: desde, caducidad: hastaF };
        licencias = i >= 0
          ? licencias.map((l, j) => (j === i ? { ...l, ...fila } : l))
          : [...licencias, { id: nuevoId('lic'), tipo, ...fila }];
      };
      // Reverso: la tabla manda, una fila por licencia.
      for (const f of d.filas) {
        const tipo = f.tipo ?? TIPOS.find((t) => !licencias.some((l) => l.tipo === t));
        if (!f.tipo || f.dudosa) sinLetra++;
        if (tipo) poner(tipo, f.desde, f.hasta);
      }
      // Tarjetas sin tabla con un tipo y sus fechas.
      if (!d.filas.length && d.tipo && d.expedicion && d.caducidad) poner(d.tipo, d.expedicion, d.caducidad);
      if (d.categoria) licencias = licencias.map((l) => (l.tipo === 'F' ? { ...l, categoria: d.categoria } : l));
      return {
        ...x,
        numero: x.numero || d.nif || '',
        // Anverso: la fecha suelta es la de expedición de la tarjeta.
        expedicion: x.expedicion || (!d.filas.length && !d.caducidad ? d.expedicion : undefined),
        licencias,
      };
    });
    if (d.filas.length) leido.push(`${d.filas.length === 1 ? 'la licencia' : `${d.filas.length} licencias`} con sus fechas`);
    if (d.nif) leido.push('el NIF');
    if (!d.filas.length && d.expedicion) leido.push('la fecha de expedición');
    if (d.categoria) leido.push(`la categoría ${d.categoria} de la F`);
    setVersion((v) => v + 1);
    setAviso(leido.length
      ? {
          ok: true,
          texto: `He leído ${leido.length > 1 ? `${leido.slice(0, -1).join(', ')} y ${leido[leido.length - 1]}` : leido[0]}.${sinLetra ? ' En alguna fila no he leído bien la letra y la he deducido: revisa el tipo.' : ''} Revisa que esté bien antes de guardar.`,
        }
      : { ok: false, texto: 'No he podido leer los datos. Escríbelos a mano o repite la foto con más luz y más cerca.' });
  };

  const guardar = () => {
    setIntentado(true);
    if (!valida) return;
    store.guardarPermiso({
      ...p,
      numero: p.numero.trim(),
      licencias: filas.map((l) => ({ ...l, caducidad: hasta(l) })),
    });
    volver('/cartera');
  };

  return (
    <Screen title="Licencia de armas" back="/cartera">
      <Card style={{ gap: space.sm }}>
        <Text style={st.titulo}>Fotos de la tarjeta</Text>
        <Text style={s.muted}>
          {ocrDisponible
            ? 'Escanea las dos caras: del anverso leo el NIF y del reverso, cada licencia con sus fechas.'
            : 'Escanea las dos caras para tenerlas siempre a mano.'}
        </Text>
        <View style={formSt.fila}>
          <FotoCampo
            etiqueta="Anverso"
            documento
            fotoId={p.fotoAnverso}
            onChange={(fotoAnverso) => setP((x) => ({ ...x, fotoAnverso }))}
            onEscaneado={leer}
          />
          <FotoCampo
            etiqueta="Reverso"
            documento
            fotoId={p.fotoReverso}
            onChange={(fotoReverso) => setP((x) => ({ ...x, fotoReverso }))}
            onEscaneado={leer}
          />
        </View>
        {leyendo && (
          <View style={st.fila}>
            <ActivityIndicator color={colors.accent} />
            <Text style={s.muted}>Leyendo la tarjeta…</Text>
          </View>
        )}
        {aviso && <Text style={{ color: aviso.ok ? colors.green : colors.orange }}>{aviso.texto}</Text>}
      </Card>

      <Campo
        key={`nif-${version}`}
        etiqueta="NIF / NIE del titular"
        valor={p.numero}
        onChange={(numero) => setP((x) => ({ ...x, numero }))}
      />
      <CampoFecha
        key={`exp-${version}`}
        etiqueta="Fecha de expedición de la tarjeta"
        valor={p.expedicion ?? ''}
        onChange={(expedicion) => setP((x) => ({ ...x, expedicion }))}
      />

      <SectionTitle>Licencias de la tarjeta</SectionTitle>
      {filas.length === 0 && (
        <Text style={s.muted}>Escanea el reverso o añade cada licencia (E, F, D) con sus fechas.</Text>
      )}
      {filas.map((l) => (
        <Card key={`${l.id}-${version}`} style={{ gap: space.md }}>
          <View style={st.cabecera}>
            <View style={st.sello}><Text style={st.selloTexto}>{l.tipo}</Text></View>
            <Text style={[st.titulo, { flex: 1 }]}>Licencia {l.tipo}</Text>
            <Pressable hitSlop={12} onPress={() => quitarFila(l)} accessibilityLabel={`Quitar licencia ${l.tipo}`}>
              <Icon name="trash" color={colors.textMuted} size={20} />
            </Pressable>
          </View>
          <Chips
            opciones={TIPOS.map((t) => ({ value: t, label: t }))}
            valor={l.tipo}
            onChange={(tipo) => cambiarFila(l.id, { tipo })}
          />
          {repetidas.includes(l.tipo) && <Text style={st.error}>Ya hay otra fila con la licencia {l.tipo}.</Text>}
          {l.tipo === 'F' && (
            <View style={{ gap: 6 }}>
              <Text style={st.etiqueta}>Categoría</Text>
              <Chips
                opciones={['1', '2', '3'].map((c) => ({ value: c, label: `${c}ª` }))}
                valor={l.categoria}
                onChange={(categoria) => cambiarFila(l.id, { categoria })}
              />
            </View>
          )}
          <View style={formSt.fila}>
            <View style={{ flex: 1 }}>
              <CampoFecha
                etiqueta="Válida desde"
                valor={l.expedicion}
                obligatorio={intentado}
                onChange={(expedicion) => cambiarFila(l.id, { expedicion })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <CampoFecha
                etiqueta="Válida hasta"
                valor={l.caducidad}
                onChange={(caducidad) => cambiarFila(l.id, { caducidad })}
              />
            </View>
          </View>
          {!l.caducidad && hasta(l) && <Text style={s.muted}>Si la dejas vacía: {formatear(hasta(l))} (5 años).</Text>}
        </Card>
      ))}
      {filas.length < TIPOS.length && <Button title="Añadir licencia" variant="secondary" onPress={anadirFila} />}

      {intentado && !valida && <Text style={st.error}>Revisa las licencias: cada una necesita su fecha «válida desde» y no puede repetirse.</Text>}
      <Button title="Guardar" onPress={guardar} />
    </Screen>
  );
}

const st = StyleSheet.create({
  etiqueta: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  titulo: { color: colors.text, fontSize: 16, fontWeight: '700' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  sello: {
    width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  selloTexto: { color: '#fff', fontSize: 18, fontWeight: '900' },
  error: { color: colors.red, fontSize: 13 },
});
