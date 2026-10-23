import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, MessageCircle, Phone, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useCRM } from '../lib/crm'
import { iniciales, linkWhatsapp, rellenar } from '../lib/util'
import { ESTADO, type Contacto, type Estado } from '../shared/modelo'

export function EstadoChip({ estado, chico }: { estado: Estado; chico?: boolean }) {
  const e = ESTADO[estado]
  return (
    <span
      className={`pildora border-transparent text-tinta ${chico ? 'px-2 py-0.5 text-[11px]' : ''}`}
      style={{ backgroundColor: e.color + '24' }}
    >
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />
      {e.label}
    </span>
  )
}

export function Avatar({ nombre, estado, tam = 40, oscuro }: { nombre: string; estado?: Estado; tam?: number; oscuro?: boolean }) {
  const color = estado ? ESTADO[estado].color : '#9b2c22'
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-tinta"
      style={{
        width: tam,
        height: tam,
        fontSize: tam * 0.36,
        // Sobre fondos vino el tinte se pierde: base blanca con anillo del color del estado
        backgroundColor: oscuro ? '#fbf3f1' : color + '2e',
        boxShadow: `inset 0 0 0 ${oscuro ? 3 : 2}px ${color}${oscuro ? '' : '66'}`,
      }}
      aria-hidden
    >
      {iniciales(nombre)}
    </span>
  )
}

/** Cierra un menú al hacer clic afuera o presionar Escape */
function useFuera(abierto: boolean, cerrar: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!abierto) return
    const clic = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cerrar()
    }
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && cerrar()
    document.addEventListener('mousedown', clic)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', clic)
      document.removeEventListener('keydown', tecla)
    }
  }, [abierto, cerrar])
  return ref
}

/** WhatsApp con mensaje listo: clic principal = primera plantilla, flecha = elegir otra */
export function BotonWhatsapp({ c, compacto, alAbrir }: { c: Contacto; compacto?: boolean; alAbrir?: () => void }) {
  const { plantillas, sesion } = useCRM()
  const [abierto, setAbierto] = useState(false)
  const ref = useFuera(abierto, () => setAbierto(false))
  if (!c.wa) return null
  const sugerida =
    c.estado === 'interesado'
      ? plantillas.find((p) => p.id === 'interesado')
      : c.estado === 'sin_respuesta' || c.estado === 'contactado'
        ? plantillas.find((p) => p.id === 'seguimiento')
        : undefined
  const principal = sugerida ?? plantillas[0]
  const abrir = (texto?: string) => {
    window.open(linkWhatsapp(c.wa!, texto ? rellenar(texto, c, sesion.nombre) : undefined), '_blank', 'noopener')
    setAbierto(false)
    alAbrir?.()
  }
  if (compacto) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation()
          abrir(principal?.texto)
        }}
        title={`WhatsApp: ${principal?.titulo ?? 'abrir chat'}`}
        className="inline-flex size-9 items-center justify-center rounded-xl bg-wa/10 text-wa-oscuro transition hover:bg-wa hover:text-white"
        aria-label={`Escribir por WhatsApp a ${c.nombre}`}
      >
        <MessageCircle size={18} />
      </button>
    )
  }
  return (
    <div ref={ref} className="relative inline-flex">
      <button onClick={() => abrir(principal?.texto)} className="btn-wa rounded-r-none pr-3">
        <MessageCircle size={17} />
        WhatsApp
      </button>
      <button
        onClick={() => setAbierto((v) => !v)}
        className="btn-wa rounded-l-none border-l border-white/25 px-2"
        aria-label="Elegir mensaje"
        aria-expanded={abierto}
      >
        <ChevronDown size={16} />
      </button>
      <AnimatePresence>
        {abierto && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full left-0 z-30 mt-2 w-80 max-w-[85vw] overflow-hidden rounded-2xl border border-linea bg-white shadow-flotante"
          >
            <p className="kicker border-b border-linea px-4 py-2.5">Elige el mensaje</p>
            {plantillas.map((p) => (
              <button key={p.id} onClick={() => abrir(p.texto)} className="block w-full px-4 py-2.5 text-left hover:bg-vino-50">
                <span className="text-sm font-semibold">{p.titulo}</span>
                <span className="mt-0.5 line-clamp-2 block text-xs text-tinta-2">{rellenar(p.texto, c, sesion.nombre)}</span>
              </button>
            ))}
            <button onClick={() => abrir()} className="block w-full border-t border-linea px-4 py-2.5 text-left text-sm text-tinta-2 hover:bg-vino-50">
              Abrir el chat sin mensaje
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function BotonLlamar({ c }: { c: Contacto }) {
  if (!c.wa) return null
  return (
    <a href={`tel:+${c.wa}`} className="btn-suave">
      <Phone size={16} />
      Llamar
    </a>
  )
}

export function Modal({
  abierto,
  cerrar,
  titulo,
  children,
  ancho = 'max-w-lg',
}: {
  abierto: boolean
  cerrar: () => void
  titulo: string
  children: ReactNode
  ancho?: string
}) {
  useEffect(() => {
    if (!abierto) return
    const t = (e: KeyboardEvent) => e.key === 'Escape' && cerrar()
    document.addEventListener('keydown', t)
    return () => document.removeEventListener('keydown', t)
  }, [abierto, cerrar])
  return (
    <AnimatePresence>
      {abierto && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-vino-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && cerrar()}
        >
          <motion.div
            role="dialog"
            aria-modal
            aria-label={titulo}
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className={`max-h-[92vh] w-full ${ancho} overflow-y-auto rounded-t-3xl bg-white p-5 shadow-flotante sm:rounded-3xl sm:p-6`}
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="titulo-seccion">{titulo}</h2>
              <button onClick={cerrar} className="rounded-full p-1.5 text-tenue hover:bg-papel hover:text-tinta" aria-label="Cerrar">
                <X size={20} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Burbuja flotante para gráficas: sigue al cursor dentro del contenedor */
export interface Punta {
  x: number
  y: number
  contenido: ReactNode
}

export function Burbuja({ punta }: { punta: Punta | null }) {
  if (!punta) return null
  return (
    <div
      className="pointer-events-none absolute z-20 max-w-64 -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-xl bg-vino-950 px-3 py-2 text-xs text-white shadow-flotante"
      style={{ left: punta.x, top: punta.y }}
    >
      {punta.contenido}
    </div>
  )
}

export function Vacio({ icono, titulo, texto }: { icono: ReactNode; titulo: string; texto?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-vino-50 text-vino-600">{icono}</span>
      <p className="font-semibold">{titulo}</p>
      {texto && <p className="max-w-sm text-sm text-tinta-2">{texto}</p>}
    </div>
  )
}
