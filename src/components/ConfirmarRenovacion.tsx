import { motion } from 'framer-motion'
import { CircleCheckBig, FileText, Paperclip, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { esComprobanteValido } from '../lib/comprobante'
import { LIMITES, type Contacto } from '../shared/modelo'

/** Lo que la persona dejó en la ventana: una nota y, si quiso, el comprobante de pago */
export interface Confirmacion {
  nota: string
  archivo: File | null
}

const NOTA_POR_DEFECTO = 'Renovó 🎉'

/**
 * Doble verificación de "Renovado": marcarlo avisa al CRM del Club, así que se pide confirmar
 * con una casilla antes de poder enviarlo. Aquí mismo se puede escribir una nota y subir el comprobante de pago.
 */
export function ConfirmarRenovacion({
  contactos,
  notaInicial,
  responder,
}: {
  contactos: Contacto[]
  notaInicial: string
  responder: (r: Confirmacion | null) => void
}) {
  const [seguro, setSeguro] = useState(false)
  const [nota, setNota] = useState(notaInicial === NOTA_POR_DEFECTO ? '' : notaInicial)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [error, setError] = useState('')
  const entrada = useRef<HTMLInputElement>(null)
  const varios = contactos.length > 1

  useEffect(() => {
    const t = (e: KeyboardEvent) => e.key === 'Escape' && responder(null)
    document.addEventListener('keydown', t)
    return () => document.removeEventListener('keydown', t)
  }, [responder])

  const elegir = (f?: File) => {
    if (!f) return
    if (!esComprobanteValido(f)) return setError('Sube una foto o un PDF')
    setError('')
    setArchivo(f)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center overflow-y-auto bg-vino-950/55 p-4 backdrop-blur-[2px] sm:items-center" onClick={() => responder(null)}>
      <motion.div
        role="alertdialog"
        aria-label="Confirmar renovación"
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="tarjeta my-auto w-full max-w-md p-5 shadow-flotante"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#1baf7a]/15 text-[#1baf7a]">
            <CircleCheckBig size={22} />
          </span>
          <h2 className="font-display text-2xl leading-none font-bold">Confirma la renovación</h2>
        </div>

        {varios ? (
          <div className="mt-4 text-sm">
            <p>
              Vas a marcar a <b>{contactos.length} personas</b> como renovadas:
            </p>
            <ul className="mt-2 max-h-32 overflow-y-auto rounded-xl bg-papel p-2.5 text-tinta-2">
              {contactos.slice(0, 8).map((c) => (
                <li key={c.id} className="truncate">
                  {c.nombre}
                </li>
              ))}
              {contactos.length > 8 && <li className="text-tenue">y {contactos.length - 8} más…</li>}
            </ul>
          </div>
        ) : (
          <p className="mt-4 text-sm">
            ¿Confirmas que <b>{contactos[0]?.nombre}</b> ya renovó?
            {contactos[0]?.email && <span className="block text-tenue">{contactos[0].email}</span>}
          </p>
        )}

        {!varios && (
          <div className="mt-4">
            <span className="kicker mb-1.5 block">Comprobante de pago (opcional)</span>
            <input ref={entrada} type="file" accept="image/*,application/pdf" hidden onChange={(e) => elegir(e.target.files?.[0])} />
            {archivo ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-linea-2 bg-white p-2.5 text-sm">
                <FileText size={18} className="shrink-0 text-tenue" />
                <span className="min-w-0 flex-1 truncate">{archivo.name}</span>
                <button className="rounded-full p-1 text-tenue hover:bg-papel hover:text-tinta" onClick={() => setArchivo(null)} aria-label="Quitar archivo">
                  <X size={15} />
                </button>
              </div>
            ) : (
              <button className="btn-suave w-full justify-center" onClick={() => entrada.current?.click()}>
                <Paperclip size={16} /> Subir foto o PDF del comprobante
              </button>
            )}
            {error && <p className="mt-1.5 text-xs font-semibold text-[#c0302f]">{error}</p>}
          </div>
        )}

        <label className="mt-4 block">
          <span className="kicker mb-1.5 block">Notas (opcional)</span>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={2}
            maxLength={LIMITES.texto}
            placeholder="Cómo pagó, qué plan, algo que el Club deba saber…"
            className="campo resize-none"
          />
        </label>

        <p className="mt-3 rounded-xl bg-miel/15 p-3 text-[13px] text-tinta-2">
          Esto <b>envía una solicitud al CRM del Club</b> (con tu nota). Un administrador de allá la aprueba y se dispara la renovación real (etiqueta, boletos, Kajabi, Skool). Si
          te equivocas después, tendrás que avisarles. El comprobante se guarda aquí, en la ficha del cliente.
        </p>

        <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm font-semibold">
          <input type="checkbox" className="mt-0.5 size-4 accent-[#1baf7a]" checked={seguro} onChange={(e) => setSeguro(e.target.checked)} />
          {varios ? 'Verifiqué que todas estas personas sí renovaron' : 'Verifiqué que esta persona sí renovó'}
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-suave" onClick={() => responder(null)}>
            Cancelar
          </button>
          <button className="btn-primario" disabled={!seguro} onClick={() => responder({ nota, archivo })}>
            {varios ? `Sí, renovaron (${contactos.length})` : 'Sí, renovó'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
