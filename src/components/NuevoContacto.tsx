import { useState } from 'react'
import { useCRM } from '../lib/crm'
import { useNav } from '../lib/nav'
import { aWhatsapp } from '../shared/modelo'
import { Modal } from './ui'

const LADAS = [
  ['52', 'México +52'],
  ['1', 'EUA / Canadá +1'],
  ['57', 'Colombia +57'],
  ['593', 'Ecuador +593'],
  ['51', 'Perú +51'],
  ['56', 'Chile +56'],
  ['54', 'Argentina +54'],
  ['502', 'Guatemala +502'],
  ['34', 'España +34'],
]
const PAIS: Record<string, string> = { '52': 'México', '1': 'Estados Unidos', '57': 'Colombia', '593': 'Ecuador', '51': 'Perú', '56': 'Chile', '54': 'Argentina', '502': 'Guatemala', '34': 'España' }

export function NuevoContactoModal({ abierto, cerrar }: { abierto: boolean; cerrar: () => void }) {
  const { nuevo, esAdmin, equipo, sesion, avisar } = useCRM()
  const { abrirFicha } = useNav()
  const vacio = { nombre: '', lada: '52', telefono: '', email: '', sede: '', asignado: esAdmin ? '' : sesion.nombre, nota: '' }
  const [d, setD] = useState(vacio)
  const [guardando, setGuardando] = useState(false)
  const set = (k: keyof typeof vacio) => (e: { target: { value: string } }) => setD((x) => ({ ...x, [k]: e.target.value }))
  const wa = d.telefono ? aWhatsapp(d.lada, d.telefono) : null
  const valido = d.nombre.trim() && (wa || (d.email.includes('@') && !d.telefono))

  return (
    <Modal abierto={abierto} cerrar={cerrar} titulo="Agregar contacto">
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!valido) return
          setGuardando(true)
          const c = await nuevo({ ...d, pais: PAIS[d.lada] })
          setGuardando(false)
          if (c) {
            avisar(`${c.nombre} agregado`)
            setD(vacio)
            cerrar()
            abrirFicha(c.id)
          }
        }}
      >
        <label className="sm:col-span-2">
          <span className="kicker mb-1 block">Nombre *</span>
          <input className="campo" value={d.nombre} onChange={set('nombre')} required maxLength={80} autoFocus />
        </label>
        <label>
          <span className="kicker mb-1 block">País</span>
          <select className="campo" value={d.lada} onChange={set('lada')}>
            {LADAS.map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="kicker mb-1 block">WhatsApp</span>
          <input className="campo" value={d.telefono} onChange={set('telefono')} inputMode="tel" placeholder={d.lada === '52' || d.lada === '1' ? '10 dígitos' : 'Número'} />
          {d.telefono && !wa && <span className="mt-1 block text-xs text-[#b8312f]">Revisa el número</span>}
        </label>
        <label className="sm:col-span-2">
          <span className="kicker mb-1 block">Correo</span>
          <input className="campo" type="email" value={d.email} onChange={set('email')} />
        </label>
        <label>
          <span className="kicker mb-1 block">Ciudad / sede</span>
          <input className="campo" value={d.sede} onChange={set('sede')} maxLength={60} />
        </label>
        <label>
          <span className="kicker mb-1 block">Asignado a</span>
          {esAdmin ? (
            <>
              <input className="campo" value={d.asignado} onChange={set('asignado')} list="nuevo-equipo" maxLength={60} />
              <datalist id="nuevo-equipo">
                {equipo.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </>
          ) : (
            <input className="campo bg-papel" value={sesion.nombre} disabled />
          )}
        </label>
        <label className="sm:col-span-2">
          <span className="kicker mb-1 block">Nota</span>
          <textarea className="campo resize-none" rows={2} value={d.nota} onChange={set('nota')} maxLength={600} />
        </label>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" className="btn-suave" onClick={cerrar}>
            Cancelar
          </button>
          <button className="btn-primario" disabled={!valido || guardando}>
            Agregar
          </button>
        </div>
      </form>
    </Modal>
  )
}
