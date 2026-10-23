import { motion } from 'framer-motion'
import { CircleCheckBig } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Contacto } from '../shared/modelo'

/**
 * Doble verificación de "Renovado": marcarlo avisa al CRM del Club, así que se pide confirmar
 * con una casilla antes de poder enviarlo.
 */
export function ConfirmarRenovacion({ contactos, responder }: { contactos: Contacto[]; responder: (confirmado: boolean) => void }) {
  const [seguro, setSeguro] = useState(false)
  const varios = contactos.length > 1

  useEffect(() => {
    const t = (e: KeyboardEvent) => e.key === 'Escape' && responder(false)
    document.addEventListener('keydown', t)
    return () => document.removeEventListener('keydown', t)
  }, [responder])

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-vino-950/55 p-4 backdrop-blur-[2px]" onClick={() => responder(false)}>
      <motion.div
        role="alertdialog"
        aria-label="Confirmar renovación"
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="tarjeta w-full max-w-md p-5 shadow-flotante"
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

        <p className="mt-3 rounded-xl bg-miel/15 p-3 text-[13px] text-tinta-2">
          Esto <b>envía una solicitud al CRM del Club</b>. Un administrador de allá la aprueba y se dispara la renovación real (etiqueta, boletos, Kajabi, Skool). Si
          te equivocas después, tendrás que avisarles.
        </p>

        <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm font-semibold">
          <input type="checkbox" className="mt-0.5 size-4 accent-[#1baf7a]" checked={seguro} onChange={(e) => setSeguro(e.target.checked)} />
          {varios ? 'Verifiqué que todas estas personas sí renovaron' : 'Verifiqué que esta persona sí renovó'}
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-suave" onClick={() => responder(false)}>
            Cancelar
          </button>
          <button className="btn-primario" disabled={!seguro} onClick={() => responder(true)}>
            {varios ? `Sí, renovaron (${contactos.length})` : 'Sí, renovó'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
