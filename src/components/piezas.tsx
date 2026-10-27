import { animate, motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useCRM } from '../lib/crm'
import { useNav } from '../lib/nav'
import { cuandoSeguimiento, haceCuanto, num, pct } from '../lib/util'
import { ESTADOS, type Actividad, type Contacto, type Estado } from '../shared/modelo'
import { contarEstados } from './graficas'
import { Avatar, BotonWhatsapp, EstadoChip } from './ui'

/** Número que sube animado al aparecer */
export function Contador({ valor, className }: { valor: number; className?: string }) {
  const [v, setV] = useState(0)
  const previo = useRef(0)
  useEffect(() => {
    const c = animate(previo.current, valor, {
      duration: 1.1,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (x) => setV(Math.round(x)),
    })
    previo.current = valor
    return () => c.stop()
  }, [valor])
  return <span className={`num ${className ?? ''}`}>{num(v)}</span>
}

export function Seccion({
  titulo,
  kicker,
  accion,
  children,
  className = '',
}: {
  titulo: string
  kicker?: string
  accion?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={`tarjeta p-5 ${className}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          {kicker && <p className="kicker mb-1">{kicker}</p>}
          <h2 className="titulo-seccion">{titulo}</h2>
        </div>
        {accion}
      </div>
      {children}
    </motion.section>
  )
}

export function VerTodo({ onClick, texto = 'Ver todos' }: { onClick: () => void; texto?: string }) {
  return (
    <button onClick={onClick} className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-vino-600 hover:text-vino-800">
      {texto} <ChevronRight size={14} />
    </button>
  )
}

/** Una tarjeta por estado: cuántos hay y qué porcentaje del total */
export function TarjetasEstado({ cs, alElegir }: { cs: Contacto[]; alElegir: (e: Estado) => void }) {
  const conteo = contarEstados(cs)
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
      {ESTADOS.map((e, i) => (
        <motion.button
          key={e.id}
          onClick={() => alElegir(e.id)}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 * i }}
          className="tarjeta group relative overflow-hidden p-4 text-left transition hover:-translate-y-0.5 hover:shadow-flotante"
        >
          <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: e.color }} />
          <span className="flex items-center gap-1.5 text-xs font-medium text-tinta-2">
            <span className="size-2 rounded-full" style={{ backgroundColor: e.color }} />
            {e.label}
          </span>
          <Contador valor={conteo[e.id]} className="mt-2 block font-display text-[34px] leading-none font-bold" />
          <span className="num mt-1 block text-xs text-tenue">{pct(conteo[e.id], cs.length)} del total</span>
        </motion.button>
      ))}
    </div>
  )
}

/** Fila compacta de contacto (seguimientos, listas cortas) */
export function FilaContacto({ c, extra }: { c: Contacto; extra?: ReactNode }) {
  const { abrirFicha } = useNav()
  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-papel">
      <button onClick={() => abrirFicha(c.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <Avatar nombre={c.nombre} estado={c.estado} tam={36} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{c.nombre}</span>
          <span className="flex items-center gap-2 text-xs text-tenue">
            <EstadoChip estado={c.estado} chico />
            {extra ?? (c.seguimiento ? cuandoSeguimiento(c.seguimiento) : c.pais)}
          </span>
        </span>
      </button>
      {!c.noContactar && <BotonWhatsapp c={c} compacto />}
    </div>
  )
}

export function Feed({ actividad, max = 12 }: { actividad: Actividad[]; max?: number }) {
  const { abrirFicha } = useNav()
  const { porId } = useCRM()
  const lista = [...actividad].reverse().slice(0, max)
  if (!lista.length) return <p className="py-6 text-center text-sm text-tenue">Aquí aparecerá lo que vaya haciendo el equipo.</p>
  return (
    <ol className="flex flex-col">
      {lista.map((a) => (
        <li key={`${a.v}-${a.id}-${a.at}`} className="flex gap-3 border-b border-linea py-2.5 last:border-0">
          <Avatar nombre={a.por} tam={30} />
          <div className="min-w-0 flex-1 text-sm">
            <p className="leading-snug">
              <span className="font-semibold">{a.por}</span>{' '}
              {a.nombre &&
                (a.id && porId.has(a.id) ? (
                  <button onClick={() => abrirFicha(a.id)} className="font-medium text-vino-600 hover:underline">
                    {a.nombre}
                  </button>
                ) : (
                  <span className="font-medium">{a.nombre}</span>
                ))}{' '}
              <span className="text-tinta-2">{a.texto}</span>
            </p>
            <p className="text-xs text-tenue">{haceCuanto(a.at)}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}
