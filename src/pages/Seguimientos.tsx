import { CalendarCheck, CalendarClock, Flame, TriangleAlert } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { FilaContacto } from '../components/piezas'
import { Vacio } from '../components/ui'
import { useCRM } from '../lib/crm'
import { cuandoSeguimiento, hoy, normalizar, num } from '../lib/util'
import type { Contacto } from '../shared/modelo'

export function Seguimientos() {
  const { contactos, esAdmin, equipo } = useCRM()
  const [persona, setPersona] = useState('')

  const grupos = useMemo(() => {
    const h = hoy()
    const semana = hoy(7)
    const p = normalizar(persona)
    const abiertos = contactos.filter(
      (c) =>
        c.estado !== 'renovado' &&
        c.estado !== 'no_interesado' &&
        !c.noContactar &&
        (!p || normalizar(c.asignado) === p || normalizar(c.contacto) === p),
    )
    const conFecha = abiertos.filter((c) => c.seguimiento).sort((a, b) => a.seguimiento!.localeCompare(b.seguimiento!))
    return {
      atrasados: conFecha.filter((c) => c.seguimiento! < h),
      hoy: conFecha.filter((c) => c.seguimiento === h),
      semana: conFecha.filter((c) => c.seguimiento! > h && c.seguimiento! <= semana),
      despues: conFecha.filter((c) => c.seguimiento! > semana),
      calientes: abiertos.filter((c) => c.estado === 'interesado' && !c.seguimiento),
    }
  }, [contactos, persona])

  const total = grupos.atrasados.length + grupos.hoy.length + grupos.semana.length + grupos.despues.length + grupos.calientes.length

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="kicker">A quién volver a buscar</p>
          <h1 className="font-display text-4xl leading-none font-extrabold tracking-tight uppercase">Seguimientos</h1>
        </div>
        {esAdmin && (
          <select className="campo w-auto min-w-48" value={persona} onChange={(e) => setPersona(e.target.value)}>
            <option value="">Todo el equipo</option>
            {equipo.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Cifra icono={<TriangleAlert size={16} />} titulo="Atrasados" valor={grupos.atrasados.length} tono="#e34948" />
        <Cifra icono={<CalendarCheck size={16} />} titulo="Para hoy" valor={grupos.hoy.length} tono="#9b2c22" />
        <Cifra icono={<CalendarClock size={16} />} titulo="Próximos 7 días" valor={grupos.semana.length} tono="#2a78d6" />
        <Cifra icono={<Flame size={16} />} titulo="Interesados sin fecha" valor={grupos.calientes.length} tono="#eb6834" />
      </div>

      {total === 0 ? (
        <div className="tarjeta">
          <Vacio
            icono={<CalendarCheck size={26} />}
            titulo="Nada pendiente por ahora"
            texto="Cuando registres un resultado (“No contestó”, “Le escribí”, “Le interesa”), el CRM agenda solo el siguiente seguimiento."
          />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Grupo titulo="Atrasados" cs={grupos.atrasados} rojo />
          <Grupo titulo="Para hoy" cs={grupos.hoy} />
          <Grupo titulo="Interesados sin fecha" cs={grupos.calientes} nota="Ponles fecha para no perderlos" />
          <Grupo titulo="Próximos 7 días" cs={grupos.semana} />
          <Grupo titulo="Más adelante" cs={grupos.despues} />
        </div>
      )}
    </div>
  )
}

function Cifra({ icono, titulo, valor, tono }: { icono: ReactNode; titulo: string; valor: number; tono: string }) {
  return (
    <div className="tarjeta p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-tinta-2">
        <span style={{ color: tono }}>{icono}</span>
        {titulo}
      </p>
      <p className="num mt-1.5 font-display text-4xl leading-none font-bold">{num(valor)}</p>
    </div>
  )
}

function Grupo({ titulo, cs, rojo, nota }: { titulo: string; cs: Contacto[]; rojo?: boolean; nota?: string }) {
  const [todos, setTodos] = useState(false)
  if (!cs.length) return null
  const lista = todos ? cs : cs.slice(0, 8)
  return (
    <section className="tarjeta p-4">
      <div className="mb-2 flex items-baseline justify-between px-2">
        <h2 className={`titulo-seccion text-xl ${rojo ? 'text-[#b8312f]' : ''}`}>
          {titulo} <span className="num font-sans text-sm font-normal text-tenue">{num(cs.length)}</span>
        </h2>
        {nota && <span className="text-xs text-tenue">{nota}</span>}
      </div>
      <div className="flex flex-col">
        {lista.map((c) => (
          <FilaContacto
            key={c.id}
            c={c}
            extra={
              <span>
                {c.seguimiento ? <span className={rojo ? 'font-semibold text-[#b8312f]' : ''}>{cuandoSeguimiento(c.seguimiento)}</span> : c.sede}
                {c.asignado && <span className="text-tenue"> · {c.asignado}</span>}
              </span>
            }
          />
        ))}
      </div>
      {cs.length > 8 && (
        <button onClick={() => setTodos((v) => !v)} className="mt-1 w-full rounded-lg py-2 text-xs font-semibold text-vino-600 hover:bg-papel">
          {todos ? 'Ver menos' : `Ver los ${num(cs.length)}`}
        </button>
      )}
    </section>
  )
}
