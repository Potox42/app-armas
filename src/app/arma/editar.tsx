import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Chips } from '@/components/Chips';
import { FotoCampo } from '@/components/FotoCampo';
import { Campo, CampoFecha, formSt } from '@/components/Formulario';
import { Button, Card, Screen, s } from '@/components/ui';
import { nuevoId, useStore } from '@/data/store';
import type { Arma, TipoArma } from '@/data/types';
import { confirmar } from '@/lib/confirmar';
import { formatear } from '@/lib/fechas';
import { combinarGuia, leerGuia } from '@/lib/leerGuia';
import { leerDocumento, ocrDisponible } from '@/lib/ocr';
import { volver } from '@/lib/volver';
import { colors, space } from '@/theme';

const TIPOS: TipoArma[] = ['Pistola', 'Revólver', 'Carabina', 'Rifle', 'Escopeta'];

export default function EditarArma() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const store = useStore();
  const existente = id ? store.arma(id) : undefined;
  const licencias = store.datos.permiso.licencias;

  const [a, setA] = useState<Arma>(existente ?? {
    id: nuevoId('arma'),
    marca: '', modelo: '', tipo: 'Pistola', calibre: '', numeroSerie: '', numeroGuia: '', fechaGuia: '',
    licenciaId: licencias[0]?.id ?? '', disparosTotales: 0, intervaloLimpieza: 500, limpiezas: [],
  });
  const [intentado, setIntentado] = useState(false);
  const cambiar = (c: Partial<Arma>) => setA((x) => ({ ...x, ...c }));
  const [leyendo, setLeyendo] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; ok: boolean } | null>(null);
  // Cambia al rellenar con lo leído, para que los campos muestren el valor nuevo.
  const [version, setVersion] = useState(0);

  const leer = async (foto: string) => {
    if (!ocrDisponible) return;
    setLeyendo(true);
    setAviso(null);
    const lecturas = await leerDocumento(foto);
    const g = combinarGuia(lecturas.map((l) => leerGuia(l.texto, undefined, l.palabras)));
    setLeyendo(false);
    if (!lecturas.length) {
      setAviso({ ok: false, texto: 'No he podido arrancar el lector de texto. Cierra la app del todo, vuelve a abrirla y repite la foto.' });
      return;
    }
    const licencia = g.licencia && licencias.find((l) => l.tipo === g.licencia);
    const nombres: [keyof typeof g, string][] = [
      ['marca', 'marca'], ['modelo', 'modelo'], ['tipo', 'tipo'], ['calibre', 'calibre'],
      ['numeroSerie', 'nº de identificación'], ['numeroGuia', 'nº de guía'], ['fechaGuia', 'fecha'], ['licencia', 'licencia'],
    ];
    const leidos = nombres.filter(([k]) => g[k] && (k !== 'licencia' || licencia)).map(([, n]) => n);
    if (!leidos.length) {
      setAviso({ ok: false, texto: 'No he podido leer los datos de la guía. Escríbelos a mano o repite la foto con más luz y más cerca.' });
      return;
    }
    // Solo se rellena lo que esté vacío, para no pisar lo que ya hayas escrito.
    setA((x) => ({
      ...x,
      marca: x.marca || g.marca || '',
      modelo: x.modelo || g.modelo || '',
      tipo: existente ? x.tipo : g.tipo ?? x.tipo,
      calibre: x.calibre || g.calibre || '',
      numeroSerie: x.numeroSerie || g.numeroSerie || '',
      numeroGuia: x.numeroGuia || g.numeroGuia || '',
      fechaGuia: x.fechaGuia || g.fechaGuia || '',
      licenciaId: licencia ? licencia.id : x.licenciaId,
    }));
    setVersion((v) => v + 1);
    const cuando = g.fechaGuia ? ` (expedida el ${formatear(g.fechaGuia)})` : '';
    setAviso({ ok: true, texto: `He leído: ${leidos.join(', ')}${cuando}. Revisa que esté bien antes de guardar.` });
  };

  const faltan = [
    !a.marca.trim() && 'marca',
    !a.numeroGuia.trim() && 'nº de guía',
    !a.licenciaId && 'licencia',
  ].filter(Boolean) as string[];

  const guardar = () => {
    setIntentado(true);
    if (faltan.length) return;
    store.guardarArma({ ...a, marca: a.marca.trim(), modelo: a.modelo.trim() });
    volver(existente ? `/arma/${existente.id}` : '/armas');
  };

  return (
    <Screen title={existente ? 'Editar arma' : 'Nueva arma'} back={existente ? `/arma/${existente.id}` : '/armas'}>
      <FotoCampo etiqueta="Foto del arma" fotoId={a.foto} onChange={(foto) => cambiar({ foto })} proporcion={2} />

      <View style={formSt.fila}>
        <View style={{ flex: 1 }}><Campo key={`marca-${version}`} etiqueta="Marca" valor={a.marca} onChange={(marca) => cambiar({ marca })} placeholder="Walther" /></View>
        <View style={{ flex: 1 }}><Campo key={`modelo-${version}`} etiqueta="Modelo (opcional)" valor={a.modelo} onChange={(modelo) => cambiar({ modelo })} placeholder="P22" /></View>
      </View>

      <Text style={st.etiqueta}>Tipo</Text>
      <Chips opciones={TIPOS.map((t) => ({ value: t, label: t }))} valor={a.tipo} onChange={(tipo) => cambiar({ tipo })} />

      <View style={formSt.fila}>
        <View style={{ flex: 1 }}><Campo key={`cal-${version}`} etiqueta="Calibre" valor={a.calibre} onChange={(calibre) => cambiar({ calibre })} placeholder=".22 LR" /></View>
        <View style={{ flex: 1 }}><Campo key={`serie-${version}`} etiqueta="Nº de identificación" valor={a.numeroSerie} onChange={(numeroSerie) => cambiar({ numeroSerie })} /></View>
      </View>

      <Card style={{ gap: space.md }}>
        <Text style={st.titulo}>Guía de pertenencia</Text>
        {ocrDisponible && <Text style={s.muted}>Escanéala y relleno por ti marca, modelo, calibre, nº de identificación, nº de guía y fecha.</Text>}
        <View style={formSt.fila}>
          <FotoCampo etiqueta="Anverso" documento fotoId={a.fotoGuiaAnverso} onChange={(fotoGuiaAnverso) => cambiar({ fotoGuiaAnverso })} onEscaneado={leer} />
          <FotoCampo etiqueta="Reverso" documento fotoId={a.fotoGuiaReverso} onChange={(fotoGuiaReverso) => cambiar({ fotoGuiaReverso })} onEscaneado={leer} />
        </View>
        {leyendo && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <ActivityIndicator color={colors.accent} />
            <Text style={s.muted}>Leyendo la guía…</Text>
          </View>
        )}
        {aviso && <Text style={{ color: aviso.ok ? colors.green : colors.orange }}>{aviso.texto}</Text>}
        <View style={formSt.fila}>
          <View style={{ flex: 1 }}><Campo key={`guia-${version}`} etiqueta="Nº de guía" valor={a.numeroGuia} onChange={(numeroGuia) => cambiar({ numeroGuia })} /></View>
          <View style={{ flex: 1 }}><CampoFecha key={`fecha-${version}`} etiqueta="Fecha de expedición" valor={a.fechaGuia} onChange={(fechaGuia) => cambiar({ fechaGuia })} /></View>
        </View>
        <Text style={st.etiqueta}>Licencia a la que va asociada</Text>
        {licencias.length === 0 ? (
          <Text style={s.muted}>Primero añade tus licencias en Cartera.</Text>
        ) : (
          <Chips
            opciones={licencias.map((l) => ({ value: l.id, label: `Licencia ${l.tipo}` }))}
            valor={a.licenciaId}
            onChange={(licenciaId) => cambiar({ licenciaId })}
          />
        )}
      </Card>

      <View style={formSt.fila}>
        <View style={{ flex: 1 }}>
          <Campo
            etiqueta="Disparos acumulados"
            valor={String(a.disparosTotales)}
            teclado="number-pad"
            onChange={(t) => cambiar({ disparosTotales: Number(t.replace(/\D/g, '')) || 0 })}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Campo
            etiqueta="Limpiar cada (disparos)"
            valor={String(a.intervaloLimpieza)}
            teclado="number-pad"
            onChange={(t) => cambiar({ intervaloLimpieza: Number(t.replace(/\D/g, '')) || 0 })}
          />
        </View>
      </View>

      {intentado && faltan.length > 0 && (
        <Text style={{ color: colors.red }}>Falta: {faltan.join(', ')}.</Text>
      )}
      <Button title="Guardar" onPress={guardar} />
      {existente && (
        <Button
          title="Borrar arma"
          variant="secondary"
          onPress={() => confirmar('Borrar arma', `Se borrará ${a.marca} ${a.modelo} y su historial de limpiezas.`, () => {
            store.borrarArma(a.id);
            router.replace('/armas');
          })}
        />
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  etiqueta: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  titulo: { color: colors.text, fontSize: 16, fontWeight: '700' },
});
