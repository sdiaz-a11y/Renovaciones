import { motion } from 'framer-motion'
import { Flame, Quote, Target, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Barras, BarrasEstado, Embudo, etapasEmbudo, LeyendaEstados, MiniEstados, type Fila } from '../components/graficas'
import { Contador, Feed, FilaContacto, Seccion, TarjetasEstado, VerTodo } from '../components/piezas'
import { useCRM } from '../lib/crm'
import { useNav } from '../lib/nav'
import { cuandoSeguimiento, hoy, num, pct } from '../lib/util'
import { MOTIVOS, type Contacto, type Motivo } from '../shared/modelo'

const REGIONES = ['México', 'EUA', 'LATAM y otros']

export function Panel() {
  const { contactos, meta, actividad, fuente, generado } = useCRM()
  const { ir } = useNav()

  const total = contactos.length
  const renovados = contactos.filter((c) => c.estado === 'renovado').length
  const interesados = contactos.filter((c) => c.estado === 'interesado').length
  const buscados = contactos.filter((c) => c.estado !== 'pendiente').length
  const etapas = useMemo(() => etapasEmbudo(contactos), [contactos])

  return (
    <div className="flex flex-col gap-5">
      {/* Encabezado */}
      <motion.header
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="panal relative overflow-hidden rounded-3xl bg-linear-to-br from-vino-950 via-vino-800 to-vino-600 p-6 text-white shadow-flotante sm:p-8"
      >
        <motion.img
          src="/abeja.png"
          alt=""
          className="pointer-events-none absolute -right-6 -bottom-10 w-56 opacity-[0.13] sm:w-72"
          animate={{ y: [0, -10, 0], rotate: [0, 3, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <p className="kicker !text-miel">Panel general · en vivo</p>
        <h1 className="mt-2 font-display text-4xl leading-[0.95] font-extrabold tracking-tight uppercase sm:text-6xl">
          Renovaciones
          <br />
          <span className="text-white/55">Club Sinergético</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm text-white/65">
          {num(total)} personas con membresía vencida. Base importada de “{fuente}” · {new Date(generado).toLocaleDateString('es-MX')}
        </p>

        <div className="relative mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Dato titulo="Renovados" grande>
            <Contador valor={renovados} className="text-miel" />
          </Dato>
          <Dato titulo="Tasa de renovación">
            <span className="num">{pct(renovados, total, 2)}</span>
          </Dato>
          <Dato titulo="Ya se les buscó">
            <span className="num">{pct(buscados, total)}</span>
            <span className="num ml-2 text-sm font-normal text-white/55">{num(buscados)}</span>
          </Dato>
          <Dato titulo="Interesados por cerrar" icono={<Flame size={14} className="text-[#ff9a6b]" />}>
            <Contador valor={interesados} />
          </Dato>
        </div>

        <div className="relative mt-5 rounded-2xl bg-white/8 p-4">
          {meta ? (
            <>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 font-semibold">
                  <Target size={16} className="text-miel" /> Meta: {num(meta)} renovaciones
                </span>
                <span className="num text-white/70">
                  {num(renovados)} / {num(meta)} · {pct(renovados, meta)}
                </span>
              </div>
              <div className="mt-2.5 h-3 overflow-hidden rounded-full bg-white/12">
                <motion.div
                  className="h-full rounded-full bg-linear-to-r from-miel to-[#ffd27a]"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (renovados / meta) * 100)}%` }}
                  transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </>
          ) : (
            <button onClick={() => ir('mensajes')} className="flex w-full items-center gap-2 text-left text-sm text-white/80 hover:text-white">
              <Target size={16} className="text-miel" /> Define una meta de renovaciones para ver el avance del equipo →
            </button>
          )}
        </div>
      </motion.header>

      <TarjetasEstado cs={contactos} alElegir={(e) => ir('contactos', { estados: [e] })} />

      <div className="grid gap-5 lg:grid-cols-12">
        <Seccion kicker="Dónde se pierde la renovación" titulo="Embudo" className="lg:col-span-7">
          <Embudo etapas={etapas} />
          <Conclusion etapas={etapas} />
        </Seccion>
        <Motivos contactos={contactos} />
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <Seccion kicker="Cómo va cada región" titulo="Estados por región" className="lg:col-span-7">
          <div className="mb-4">
            <LeyendaEstados />
          </div>
          <BarrasEstado
            filas={REGIONES.map((r) => ({ label: r, cs: contactos.filter((c) => c.region === r) })).filter((f) => f.cs.length)}
            alElegir={(region, estado) => ir('contactos', { region, estados: [estado] })}
          />
        </Seccion>
        <Agenda contactos={contactos} />
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <Regiones contactos={contactos} />
        <Rendimiento contactos={contactos} />
      </div>

      <Seccion kicker="Lo último" titulo="Actividad del equipo">
        <Feed actividad={actividad} max={15} />
      </Seccion>
    </div>
  )
}

function Dato({ titulo, children, grande, icono }: { titulo: string; children: React.ReactNode; grande?: boolean; icono?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
      <p className="flex items-center gap-1.5 text-xs font-medium text-white/60">
        {icono}
        {titulo}
      </p>
      <p className={`mt-1 font-display leading-none font-bold ${grande ? 'text-5xl' : 'text-4xl'}`}>{children}</p>
    </div>
  )
}

function Conclusion({ etapas }: { etapas: ReturnType<typeof etapasEmbudo> }) {
  const [, buscados, respondieron, positivos, renovados] = etapas
  if (!buscados?.valor) return null
  return (
    <div className="mt-5 flex gap-3 rounded-2xl bg-miel-claro/60 p-4 text-sm">
      <TrendingUp className="mt-0.5 shrink-0 text-miel-oscuro" size={18} />
      <p className="text-tinta">
        De cada <b>100</b> personas que se buscaron, solo <b className="num">{((respondieron.valor / buscados.valor) * 100).toFixed(1)}</b> dieron
        una respuesta. Cuando responden, <b className="num">{pct(positivos.valor, respondieron.valor || 1, 0)}</b> se interesa y{' '}
        <b className="num">{pct(renovados.valor, respondieron.valor || 1, 0)}</b> renueva: <b>lograr que contesten</b> es la palanca más grande.
      </p>
    </div>
  )
}

function Motivos({ contactos }: { contactos: Contacto[] }) {
  const { ir, abrirFicha } = useNav()
  const [activo, setActivo] = useState<Motivo | null>(null)
  const no = contactos.filter((c) => c.estado === 'no_interesado')
  const conteo = new Map<Motivo, number>()
  for (const c of no) conteo.set(c.motivo ?? 'sin_motivo', (conteo.get(c.motivo ?? 'sin_motivo') ?? 0) + 1)
  const filas: Fila[] = [...conteo.entries()]
    .sort((a, b) => (a[0] === 'sin_motivo' ? 1 : b[0] === 'sin_motivo' ? -1 : b[1] - a[1]))
    .map(([m, n]) => ({ clave: m, label: MOTIVOS[m], valor: n, apagado: m === 'sin_motivo' }))
  const citas = activo
    ? no
        .filter((c) => (c.motivo ?? 'sin_motivo') === activo)
        // la última nota escrita por una persona (no la etiqueta del motivo, que se guarda sola cuando no escriben nada)
        .map((c) => ({ c, t: [...c.notas].reverse().find((n) => n.t && n.t.length > 12 && n.h !== 'cambio' && !Object.values(MOTIVOS).includes(n.t))?.t }))
        .filter((x) => x.t)
        .slice(0, 4)
    : []
  const explicados = no.length - (conteo.get('sin_motivo') ?? 0)
  return (
    <Seccion
      kicker={`${num(no.length)} dijeron que no · ${num(explicados)} explicaron por qué`}
      titulo="¿Por qué no renuevan?"
      className="lg:col-span-5"
      accion={<VerTodo onClick={() => ir('contactos', { estados: ['no_interesado'] })} texto="Lista" />}
    >
      <Barras filas={filas} alElegir={(m) => setActivo((a) => (a === m ? null : (m as Motivo)))} activa={activo} />
      {activo ? (
        <div className="mt-4 flex flex-col gap-2">
          {citas.length ? (
            citas.map(({ c, t }) => (
              <button key={c.id} onClick={() => abrirFicha(c.id)} className="flex gap-2.5 rounded-xl bg-papel p-3 text-left text-sm hover:bg-vino-50">
                <Quote size={15} className="mt-0.5 shrink-0 text-serie" />
                <span>
                  {t} <span className="text-xs text-tenue">— {c.nombre.split(' ')[0]}</span>
                </span>
              </button>
            ))
          ) : (
            <p className="text-sm text-tenue">No hay notas para este motivo.</p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-tenue">Toca un motivo para leer lo que dijeron.</p>
      )}
    </Seccion>
  )
}

function Agenda({ contactos }: { contactos: Contacto[] }) {
  const { ir } = useNav()
  const h = hoy()
  const abiertos = (c: Contacto) => c.estado !== 'renovado' && c.estado !== 'no_interesado' && !c.noContactar
  const toca = contactos.filter((c) => c.seguimiento && c.seguimiento <= h && abiertos(c)).sort((a, b) => a.seguimiento!.localeCompare(b.seguimiento!))
  const atrasados = toca.filter((c) => c.seguimiento! < h).length
  const calientes = contactos.filter((c) => c.estado === 'interesado' && !c.seguimiento)
  return (
    <Seccion
      kicker={`${num(toca.length)} para hoy${atrasados ? ` · ${num(atrasados)} atrasados` : ''}`}
      titulo="Seguimientos"
      className="lg:col-span-5"
      accion={<VerTodo onClick={() => ir('seguimientos')} />}
    >
      {toca.length === 0 && calientes.length === 0 ? (
        <p className="py-6 text-center text-sm text-tenue">No hay seguimientos pendientes. Cuando alguien registre un resultado, aquí aparecerá a quién volver a buscar.</p>
      ) : (
        <div className="flex flex-col">
          {toca.slice(0, 5).map((c) => (
            <FilaContacto key={c.id} c={c} extra={<span className={c.seguimiento! < h ? 'font-semibold text-[#b8312f]' : ''}>{cuandoSeguimiento(c.seguimiento!)}</span>} />
          ))}
          {calientes.length > 0 && (
            <>
              <p className="kicker mt-3 mb-1 flex items-center gap-1.5 px-2">
                <Flame size={13} className="text-[#eb6834]" /> Interesados sin fecha de seguimiento ({calientes.length})
              </p>
              {calientes.slice(0, Math.max(2, 5 - toca.length)).map((c) => (
                <FilaContacto key={c.id} c={c} extra={c.asignado || 'Sin asignar'} />
              ))}
            </>
          )}
        </div>
      )}
    </Seccion>
  )
}

/** Cuántos vencidos hay en México, EUA y el resto de LATAM (lo único de ubicación que el Club trae limpio) */
function Regiones({ contactos }: { contactos: Contacto[] }) {
  const { ir } = useNav()
  const filas: Fila[] = REGIONES.map((r) => {
    const l = contactos.filter((c) => c.region === r)
    const pos = l.filter((c) => c.estado === 'interesado' || c.estado === 'renovado').length
    return { clave: r, label: r, valor: l.length, detalle: pos ? `${pos} ✓` : undefined }
  }).filter((f) => f.valor)
  return (
    <Seccion kicker="Dónde están" titulo="Vencidos por región" className="lg:col-span-6">
      {filas.length ? <Barras filas={filas} alElegir={(region) => ir('contactos', { region })} /> : <p className="text-sm text-tenue">Sin contactos todavía.</p>}
      <p className="mt-3 text-xs text-tenue">✓ = interesados o renovados. Toca una barra para ver esa región en Contactos.</p>
    </Seccion>
  )
}

function Rendimiento({ contactos }: { contactos: Contacto[] }) {
  const { ir } = useNav()
  const grupos = new Map<string, Contacto[]>()
  for (const c of contactos) {
    const quien = c.contacto || c.asignado
    if (quien) grupos.set(quien, [...(grupos.get(quien) ?? []), c])
  }
  const filas = [...grupos.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 9)
  return (
    <Seccion kicker="Quién está trabajando la base" titulo="Equipo" className="lg:col-span-6" accion={<VerTodo onClick={() => ir('equipo')} texto="Equipo" />}>
      <div className="mb-3">
        <LeyendaEstados />
      </div>
      <div className="flex flex-col">
        <div className="grid grid-cols-[minmax(0,7rem)_1fr_3.5rem_3.5rem] gap-3 px-2 pb-1.5 text-[11px] font-semibold text-tenue uppercase">
          <span>Persona</span>
          <span>Sus contactos</span>
          <span className="text-right">🔥</span>
          <span className="text-right">✓</span>
        </div>
        {filas.map(([n, cs]) => (
          <button
            key={n}
            onClick={() => ir('contactos', { responsable: n })}
            className="grid grid-cols-[minmax(0,7rem)_1fr_3.5rem_3.5rem] items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-papel"
          >
            <span className="truncate font-medium">{n}</span>
            <span className="flex items-center gap-2">
              <MiniEstados cs={cs} />
              <span className="num w-10 shrink-0 text-right text-xs text-tenue">{num(cs.length)}</span>
            </span>
            <span className="num text-right font-semibold">{cs.filter((c) => c.estado === 'interesado').length}</span>
            <span className="num text-right font-semibold">{cs.filter((c) => c.estado === 'renovado').length}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-tenue">Por quién hizo el último contacto (o a quién está asignado). 🔥 interesados · ✓ renovados.</p>
    </Seccion>
  )
}
