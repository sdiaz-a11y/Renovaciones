import { AnimatePresence, motion } from 'framer-motion'
import { Ban, CircleCheckBig, Flame, MessageCircle, PhoneOff, ThumbsDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useCRM } from '../lib/crm'
import { hoy } from '../lib/util'
import { ESTADO, MOTIVOS, MOTIVOS_ELEGIBLES, type Contacto, type Edicion, type Estado, type Motivo } from '../shared/modelo'

interface Opcion {
  id: string
  label: string
  icono: ReactNode
  estado: Estado
  nota: string
  /** días para el próximo seguimiento (null = sin seguimiento) */
  dias: number | null
}

export const OPCIONES: Opcion[] = [
  { id: 'no_contesto', label: 'No contestó', icono: <PhoneOff size={18} />, estado: 'sin_respuesta', nota: 'No contestó', dias: 2 },
  { id: 'whatsapp', label: 'Le escribí', icono: <MessageCircle size={18} />, estado: 'contactado', nota: 'Se le envió WhatsApp', dias: 2 },
  { id: 'interesado', label: 'Le interesa', icono: <Flame size={18} />, estado: 'interesado', nota: 'Le interesa renovar', dias: 1 },
  { id: 'renovo', label: '¡Renovó!', icono: <CircleCheckBig size={18} />, estado: 'renovado', nota: 'Renovó 🎉', dias: null },
  { id: 'no_interesa', label: 'No le interesa', icono: <ThumbsDown size={18} />, estado: 'no_interesado', nota: '', dias: null },
  { id: 'invalido', label: 'Número inválido', icono: <Ban size={18} />, estado: 'invalido', nota: 'Número inválido', dias: null },
]

/**
 * Registrar el resultado de un intento en un solo clic:
 * cambia el estado, deja nota, marca quién contactó y agenda el siguiente seguimiento.
 */
export function Resultado({ c, alTerminar, grande }: { c: Contacto; alTerminar?: (o: Opcion) => void; grande?: boolean }) {
  const { actualizar, sesion, avisar } = useCRM()
  const [nota, setNota] = useState('')
  const [pidiendoMotivo, setPidiendoMotivo] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const registrar = async (o: Opcion, motivo?: Motivo) => {
    const texto = nota.trim() || o.nota || (motivo ? MOTIVOS[motivo] : '')
    const edicion: Edicion = {
      estado: o.estado,
      contacto: sesion.nombre,
      seguimiento: o.dias === null ? null : hoy(o.dias),
      ...(texto ? { nota: texto } : {}),
      ...(motivo ? { motivo } : {}),
    }
    setGuardando(true)
    const ok = await actualizar([c.id], edicion)
    setGuardando(false)
    if (!ok) return
    setNota('')
    setPidiendoMotivo(false)
    avisar(`${c.nombre.split(' ')[0]}: ${ESTADO[o.estado].label}${o.dias ? ` · seguimiento en ${o.dias} ${o.dias === 1 ? 'día' : 'días'}` : ''}`)
    alTerminar?.(o)
  }

  return (
    <div>
      <div className={`grid grid-cols-2 gap-2 ${grande ? 'sm:grid-cols-3' : 'sm:grid-cols-3'}`}>
        {OPCIONES.map((o) => {
          const color = ESTADO[o.estado].color
          return (
            <button
              key={o.id}
              disabled={guardando}
              onClick={() => (o.id === 'no_interesa' ? setPidiendoMotivo((v) => !v) : registrar(o))}
              className={`group flex items-center gap-2.5 rounded-xl border bg-white text-left font-semibold transition hover:-translate-y-0.5 hover:shadow-tarjeta disabled:opacity-50 ${
                grande ? 'px-3.5 py-3 text-sm' : 'px-3 py-2.5 text-[13px]'
              } ${pidiendoMotivo && o.id === 'no_interesa' ? 'border-tinta' : 'border-linea-2'}`}
            >
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-lg transition group-hover:scale-105"
                style={{ backgroundColor: color + '26', color: o.estado === 'pendiente' ? '#5c4f4d' : undefined }}
              >
                <span style={{ color: o.estado === 'sin_respuesta' ? '#8a5e00' : color }}>{o.icono}</span>
              </span>
              {o.label}
            </button>
          )
        })}
      </div>
      <AnimatePresence>
        {pidiendoMotivo && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <p className="kicker mt-4 mb-2">¿Por qué no quiere renovar?</p>
            <div className="flex flex-wrap gap-1.5">
              {MOTIVOS_ELEGIBLES.map((m) => (
                <button
                  key={m}
                  disabled={guardando}
                  onClick={() => registrar(OPCIONES.find((o) => o.id === 'no_interesa')!, m)}
                  className="pildora border-linea-2 bg-white hover:border-[#e34948] hover:bg-[#e34948]/10"
                >
                  {MOTIVOS[m]}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <textarea
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        rows={2}
        maxLength={600}
        placeholder="Nota opcional (qué te dijo, cuándo volver a llamar…)"
        className="campo mt-3 resize-none"
      />
    </div>
  )
}
