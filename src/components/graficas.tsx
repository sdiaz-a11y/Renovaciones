import { motion } from 'framer-motion'
import { ArrowDown } from 'lucide-react'
import { useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { num, pct } from '../lib/util'
import { ESTADOS, type Contacto, type Estado } from '../shared/modelo'
import { Burbuja, type Punta } from './ui'

/** Rampa ordinal vino (validada con dataviz --ordinal): cada etapa del embudo más oscura */
const RAMPA = ['#e0899f', '#cc5f7d', '#b23a5a', '#8f2847', '#6b1a35']

function usePunta() {
  const ref = useRef<HTMLDivElement>(null)
  const [punta, setPunta] = useState<Punta | null>(null)
  const mostrar = (e: MouseEvent, contenido: ReactNode) => {
    const r = ref.current?.getBoundingClientRect()
    if (r) setPunta({ x: e.clientX - r.left, y: e.clientY - r.top, contenido })
  }
  return { ref, punta, mostrar, ocultar: () => setPunta(null) }
}

// ---------- Embudo ----------

export interface Etapa {
  label: string
  valor: number
  ayuda: string
}

export function etapasEmbudo(cs: Contacto[]): Etapa[] {
  const n = (f: (e: Estado) => boolean) => cs.filter((c) => f(c.estado)).length
  return [
    { label: 'Membresías vencidas', valor: cs.length, ayuda: 'Todas las personas en la base' },
    { label: 'Ya se les buscó', valor: n((e) => e !== 'pendiente'), ayuda: 'Se les llamó o escribió al menos una vez' },
    {
      label: 'Respondieron',
      valor: n((e) => e === 'interesado' || e === 'no_interesado' || e === 'renovado'),
      ayuda: 'Dieron una respuesta: sí, no o ya renovaron',
    },
    { label: 'Interesados o renovados', valor: n((e) => e === 'interesado' || e === 'renovado'), ayuda: 'Respuesta positiva' },
    { label: 'Renovaron', valor: n((e) => e === 'renovado'), ayuda: 'Renovación cerrada' },
  ]
}

export function Embudo({ etapas }: { etapas: Etapa[] }) {
  const { ref, punta, mostrar, ocultar } = usePunta()
  const total = etapas[0]?.valor || 1
  // La etapa donde más se pierde gente (menor conversión respecto a la anterior)
  let peor = 1
  for (let i = 1; i < etapas.length; i++) {
    const conv = etapas[i].valor / (etapas[i - 1].valor || 1)
    if (conv < etapas[peor].valor / (etapas[peor - 1].valor || 1)) peor = i
  }
  return (
    <div ref={ref} className="relative" onMouseLeave={ocultar}>
      <ol className="flex flex-col">
        {etapas.map((e, i) => {
          const conv = i > 0 ? e.valor / (etapas[i - 1].valor || 1) : 1
          return (
            <li key={e.label}>
              {i > 0 && (
                <div className={`flex items-center gap-1.5 py-1.5 pl-1 text-xs ${i === peor ? 'font-semibold text-[#b8312f]' : 'text-tenue'}`}>
                  <ArrowDown size={13} />
                  <span className="num">{pct(e.valor, etapas[i - 1].valor)}</span>
                  <span>{i === peor ? 'pasa a la siguiente etapa · aquí se pierde más gente' : 'pasa a la siguiente etapa'}</span>
                </div>
              )}
              <div
                className="group"
                onMouseMove={(ev) =>
                  mostrar(
                    ev,
                    <>
                      <p className="font-semibold">{e.label}</p>
                      <p className="num">
                        {num(e.valor)} personas · {pct(e.valor, total)} del total
                      </p>
                      {i > 0 && <p className="num text-white/70">{(conv * 100).toFixed(1)}% de la etapa anterior</p>}
                      <p className="mt-1 text-white/60">{e.ayuda}</p>
                    </>,
                  )
                }
              >
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-tinta">{e.label}</span>
                  <span className="num font-display text-xl font-bold text-tinta">
                    {num(e.valor)} <span className="font-sans text-xs font-normal text-tenue">{pct(e.valor, total)}</span>
                  </span>
                </div>
                <div className="h-3.5 overflow-hidden rounded-[4px] bg-papel">
                  <motion.div
                    className="h-full rounded-[4px] group-hover:brightness-110"
                    style={{ backgroundColor: RAMPA[i] }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max((e.valor / total) * 100, e.valor ? 0.8 : 0)}%` }}
                    transition={{ duration: 0.9, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </div>
            </li>
          )
        })}
      </ol>
      <Burbuja punta={punta} />
    </div>
  )
}

// ---------- Barras apiladas al 100% por estado ----------

export function LeyendaEstados({ conteo }: { conteo?: Record<Estado, number> }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-tinta-2">
      {ESTADOS.map((e) => (
        <li key={e.id} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: e.color }} />
          {e.label}
          {conteo && <span className="num text-tenue">{num(conteo[e.id] ?? 0)}</span>}
        </li>
      ))}
    </ul>
  )
}

export function contarEstados(cs: Contacto[]) {
  const r = Object.fromEntries(ESTADOS.map((e) => [e.id, 0])) as Record<Estado, number>
  for (const c of cs) r[c.estado]++
  return r
}

export function BarrasEstado({
  filas,
  alElegir,
}: {
  filas: { label: string; cs: Contacto[] }[]
  alElegir?: (label: string, estado: Estado) => void
}) {
  const { ref, punta, mostrar, ocultar } = usePunta()
  return (
    <div ref={ref} className="relative" onMouseLeave={ocultar}>
      <div className="flex flex-col gap-3.5">
        {filas.map((f) => {
          const conteo = contarEstados(f.cs)
          const total = f.cs.length || 1
          return (
            <div key={f.label}>
              <div className="mb-1.5 flex items-baseline justify-between text-sm">
                <span className="font-medium">{f.label}</span>
                <span className="num text-xs text-tenue">{num(f.cs.length)} personas</span>
              </div>
              <div className="flex h-7 gap-[2px] overflow-hidden rounded-[6px]">
                {ESTADOS.filter((e) => conteo[e.id] > 0).map((e) => (
                  <motion.button
                    key={e.id}
                    className="h-full min-w-[3px] first:rounded-l-[4px] last:rounded-r-[4px] hover:brightness-110"
                    style={{ backgroundColor: e.color }}
                    initial={{ flexGrow: 0 }}
                    animate={{ flexGrow: conteo[e.id] / total }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                    onMouseMove={(ev) =>
                      mostrar(
                        ev,
                        <>
                          <p className="font-semibold">
                            {f.label} · {e.label}
                          </p>
                          <p className="num">
                            {num(conteo[e.id])} · {pct(conteo[e.id], total)}
                          </p>
                          {alElegir && <p className="mt-1 text-white/60">Clic para ver la lista</p>}
                        </>,
                      )
                    }
                    onClick={() => alElegir?.(f.label, e.id)}
                    aria-label={`${f.label}: ${e.label} ${conteo[e.id]}`}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <Burbuja punta={punta} />
    </div>
  )
}

// ---------- Barras simples (una sola serie) ----------

export interface Fila {
  clave: string
  label: string
  valor: number
  detalle?: ReactNode
  apagado?: boolean
}

export function Barras({
  filas,
  alElegir,
  sufijo = 'personas',
  activa,
}: {
  filas: Fila[]
  alElegir?: (clave: string) => void
  sufijo?: string
  activa?: string | null
}) {
  const { ref, punta, mostrar, ocultar } = usePunta()
  const max = Math.max(1, ...filas.map((f) => f.valor))
  const total = filas.reduce((s, f) => s + f.valor, 0)
  return (
    <div ref={ref} className="relative" onMouseLeave={ocultar}>
      <ul className="flex flex-col gap-1">
        {filas.map((f, i) => (
          <li key={f.clave}>
            <button
              onClick={() => alElegir?.(f.clave)}
              onMouseMove={(ev) =>
                mostrar(
                  ev,
                  <>
                    <p className="font-semibold">{f.label}</p>
                    <p className="num">
                      {num(f.valor)} {sufijo} · {pct(f.valor, total)}
                    </p>
                  </>,
                )
              }
              className={`grid w-full grid-cols-[minmax(0,9.5rem)_1fr_auto] items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-papel ${
                activa === f.clave ? 'bg-papel ring-1 ring-linea-2' : ''
              }`}
            >
              <span className={`truncate ${f.apagado ? 'text-tenue' : 'text-tinta'}`}>{f.label}</span>
              <span className="h-2.5 overflow-hidden">
                <motion.span
                  className="block h-full rounded-r-[4px]"
                  style={{ backgroundColor: f.apagado ? '#c9bfbb' : 'var(--color-serie)' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(f.valor / max) * 100}%` }}
                  transition={{ duration: 0.7, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                />
              </span>
              <span className="num min-w-10 text-right text-xs font-semibold text-tinta-2">
                {num(f.valor)}
                {f.detalle && <span className="ml-1.5 font-normal text-tenue">{f.detalle}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Burbuja punta={punta} />
    </div>
  )
}

/** Barrita apilada sin ejes (para tablas) */
export function MiniEstados({ cs }: { cs: Contacto[] }) {
  const conteo = contarEstados(cs)
  const total = cs.length || 1
  return (
    <div className="flex h-2 w-full gap-px overflow-hidden rounded-full bg-papel" title={ESTADOS.map((e) => `${e.label}: ${conteo[e.id]}`).join('\n')}>
      {ESTADOS.filter((e) => conteo[e.id]).map((e) => (
        <span key={e.id} style={{ flexGrow: conteo[e.id] / total, backgroundColor: e.color }} />
      ))}
    </div>
  )
}
