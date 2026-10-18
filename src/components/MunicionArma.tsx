import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Campo, CampoFecha, formSt } from '@/components/Formulario';
import { Icon } from '@/components/Icon';
import { Button, Card, Segmented, s } from '@/components/ui';
import { useStore } from '@/data/store';
import type { Arma, MovimientoMunicion } from '@/data/types';
import { confirmar } from '@/lib/confirmar';
import { formatear, hoyISO } from '@/lib/fechas';
import { estadoMunicion, LIMITES, type DepositoCalibre, type EstadoMunicion } from '@/lib/municion';
import { colors, radius, space } from '@/theme';

const color = (usado: number, max: number) => (usado > max ? colors.red : usado >= max * 0.8 ? colors.orange : colors.green);

/** Barras de cupo del año y de cartuchos en casa de un arma (lo que va asociado a su guía). */
export function ResumenMunicion({ m }: { m: EstadoMunicion }) {
  return (
    <View style={{ gap: space.md }}>
      {m.cupo !== null ? (
        <Barra
          titulo="Compradas este año"
          valor={`${m.comprados} de ${m.cupo}`}
          detalle={m.quedan ? `Te quedan ${m.quedan}` : 'Cupo gastado'}
          pct={m.comprados / m.cupo}
          tono={color(m.comprados, m.cupo)}
        />
      ) : (
        <Text style={s.muted}>Los cartuchos de caza no tienen límite de compra al año.</Text>
      )}
      <BarraDeposito d={{ enCasa: m.enCasa, maxDeposito: m.maxDeposito }} titulo="En casa" />
      {m.neto < 0 && (
        <Text style={{ color: colors.orange, fontSize: 12 }}>
          Has apuntado {-m.neto} cartuchos más de gasto que de compra en esta arma. Si los compraste con otra arma del mismo
          calibre, se descuentan en el total por calibre de Munición; para que cada arma cuadre, apunta el gasto en la que los compró.
        </Text>
      )}
    </View>
  );
}

/** Cartuchos en casa frente a lo que se puede guardar. */
export function BarraDeposito({ d, titulo }: { d: Pick<DepositoCalibre, 'enCasa' | 'maxDeposito'>; titulo: string }) {
  const sobran = d.enCasa - d.maxDeposito;
  return (
    <Barra
      titulo={titulo}
      valor={`${d.enCasa} de ${d.maxDeposito}`}
      detalle={sobran > 0 ? `Te sobran ${sobran}` : `Caben ${-sobran} más`}
      pct={d.maxDeposito ? d.enCasa / d.maxDeposito : 0}
      tono={sobran > 0 ? colors.red : d.enCasa >= d.maxDeposito * 0.8 ? colors.orange : colors.green}
    />
  );
}

function Barra({ titulo, valor, detalle, pct, tono }: { titulo: string; valor: string; detalle: string; pct: number; tono: string }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={st.barraFila}>
        <Text style={st.barraTitulo}>{titulo}</Text>
        <Text style={[st.barraValor, { color: tono }]}>{valor}</Text>
      </View>
      <View style={st.barra}><View style={[st.relleno, { width: `${Math.min(1, pct) * 100}%`, backgroundColor: tono }]} /></View>
      <Text style={[s.muted, { fontSize: 12 }]}>{detalle}</Text>
    </View>
  );
}

/** Pestaña «Munición» de un arma: resumen, apuntar compras y gastos, historial y cupo autorizado. */
export function MunicionArma({ arma }: { arma: Arma }) {
  const store = useStore();
  const m = estadoMunicion(arma);
  const limite = LIMITES[m.clase];
  const [tipo, setTipo] = useState<MovimientoMunicion['tipo']>('compra');
  const [cartuchos, setCartuchos] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [enRecinto, setEnRecinto] = useState(false);
  const [nota, setNota] = useState('');
  const [version, setVersion] = useState(0); // para vaciar la fecha tras guardar
  const [ajustes, setAjustes] = useState(false);
  const n = Number(cartuchos.replace(/\D/g, '')) || 0;

  const apuntar = () => {
    if (!n || !fecha) return;
    store.anadirMunicion(arma.id, {
      fecha, tipo, cartuchos: n, enRecinto: tipo === 'compra' && enRecinto ? true : undefined, nota: nota.trim() || undefined,
    });
    setCartuchos('');
    setNota('');
    setEnRecinto(false);
    setFecha(hoyISO());
    setVersion((v) => v + 1);
  };

  const supera = tipo === 'compra' && !enRecinto && m.quedan !== null && n > m.quedan;

  return (
    <>
      <Card style={{ gap: space.md }}>
        <ResumenMunicion m={m} />
      </Card>

      <Card style={{ gap: space.md }}>
        <Segmented
          value={tipo}
          onChange={setTipo}
          options={[{ value: 'compra', label: 'He comprado' }, { value: 'gasto', label: 'He gastado' }]}
        />
        <View style={formSt.fila}>
          <View style={{ flex: 1 }}>
            <Campo etiqueta="Cartuchos" valor={cartuchos} onChange={setCartuchos} teclado="number-pad" placeholder="50" />
          </View>
          <View style={{ flex: 1.2 }}>
            <CampoFecha key={`f-${version}`} etiqueta="Fecha" valor={fecha} onChange={setFecha} />
          </View>
        </View>
        {tipo === 'compra' && (
          <View style={st.interruptor}>
            <View style={{ flex: 1 }}>
              <Text style={s.text}>Comprada y gastada en el club</Text>
              <Text style={[s.muted, { fontSize: 12 }]}>No cuenta para el cupo ni entra en casa.</Text>
            </View>
            <Switch value={enRecinto} onValueChange={setEnRecinto} trackColor={{ true: colors.green, false: colors.cardAlt }} />
          </View>
        )}
        <Campo etiqueta="Nota (opcional)" valor={nota} onChange={setNota} placeholder={tipo === 'compra' ? 'Armería, marca…' : 'Entrenamiento, tirada…'} />
        {supera && (
          <Text style={{ color: colors.orange, fontSize: 13 }}>
            Con esta compra pasarías el cupo del año ({m.cupo}). Si tienes autorización para más, cámbialo abajo.
          </Text>
        )}
        <Button title={tipo === 'compra' ? 'Apuntar compra' : 'Apuntar gasto'} onPress={apuntar} />
      </Card>

      {(arma.municion ?? []).length > 0 && (
        <Card style={{ paddingVertical: space.xs }}>
          {(arma.municion ?? []).map((x, i) => (
            <View key={x.id} style={[st.mov, i > 0 && st.movBorde]}>
              <View style={[st.movIcono, { backgroundColor: x.tipo === 'gasto' ? colors.redSoft : x.enRecinto ? colors.purpleSoft : colors.greenSoft }]}>
                <Text style={{ color: x.tipo === 'gasto' ? colors.red : x.enRecinto ? colors.purple : colors.green, fontWeight: '900' }}>
                  {x.tipo === 'gasto' ? '−' : '+'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.text}>
                  {x.tipo === 'gasto' ? 'Gasto' : x.enRecinto ? 'Compra en el club' : 'Compra'} · {x.cartuchos}
                </Text>
                <Text style={s.muted}>{formatear(x.fecha)}{x.nota ? ` · ${x.nota}` : ''}</Text>
              </View>
              <Pressable
                hitSlop={10}
                accessibilityLabel="Borrar movimiento"
                onPress={() => confirmar('Borrar', `Se borrará este movimiento de ${x.cartuchos} cartuchos.`, () => store.borrarMunicion(arma.id, x.id))}
              >
                <Icon name="trash" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
          ))}
        </Card>
      )}

      <Pressable onPress={() => setAjustes((v) => !v)}>
        <Text style={st.enlace}>{ajustes ? 'Ocultar límites' : 'Límites de esta arma'}</Text>
      </Pressable>
      {ajustes && (
        <Card style={{ gap: space.md }}>
          <Text style={s.muted}>
            Por defecto, {limite.nombre}:{' '}
            {limite.anual === null ? 'sin límite al año' : `${limite.anual} cartuchos al año`} y {limite.deposito} en casa. Si la
            Guardia Civil te ha autorizado más, escríbelo aquí.
          </Text>
          <View style={formSt.fila}>
            {limite.anual !== null && (
              <View style={{ flex: 1 }}>
                <CampoLimite
                  etiqueta="Cupo al año"
                  inicial={m.cupo ?? 0}
                  onChange={(v) => store.guardarArma({ ...arma, cupoAnual: v && v !== limite.anual ? v : undefined })}
                />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <CampoLimite
                etiqueta="Máximo en casa"
                inicial={m.maxDeposito}
                onChange={(v) => store.guardarArma({ ...arma, maxDeposito: v && v !== limite.deposito ? v : undefined })}
              />
            </View>
          </View>
        </Card>
      )}
    </>
  );
}

/** Número que se guarda al escribirlo; vacío vuelve al límite por defecto. */
function CampoLimite({ etiqueta, inicial, onChange }: { etiqueta: string; inicial: number; onChange: (v: number) => void }) {
  const [texto, setTexto] = useState(String(inicial));
  return (
    <Campo
      etiqueta={etiqueta}
      valor={texto}
      teclado="number-pad"
      onChange={(t) => {
        const limpio = t.replace(/\D/g, '');
        setTexto(limpio);
        onChange(Number(limpio) || 0);
      }}
    />
  );
}

const st = StyleSheet.create({
  barraFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  barraTitulo: { color: colors.text, fontSize: 15, fontWeight: '700' },
  barraValor: { fontSize: 15, fontWeight: '900', fontVariant: ['tabular-nums'] },
  barra: { height: 8, borderRadius: 4, backgroundColor: colors.cardAlt, overflow: 'hidden' },
  relleno: { height: 8, borderRadius: 4 },
  interruptor: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  mov: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  movBorde: { borderTopWidth: 1, borderTopColor: colors.border },
  movIcono: { width: 32, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  enlace: { color: colors.accent, fontWeight: '700', textAlign: 'center', paddingVertical: space.sm },
});
