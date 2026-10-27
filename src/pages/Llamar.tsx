import { AnimatePresence, motion } from 'framer-motion'
import { CalendarClock, Copy, ExternalLink, Flame, PhoneCall, RotateCcw, SkipForward, Sparkles, UserRoundX } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Resultado } from '../components/Resultado'
import { Avatar, BotonLlamar, BotonWhatsapp, EstadoChip, Vacio } from '../components/ui'
import { useCRM } from '../lib/crm'
import { useNav } from '../lib/nav'
import { copiar, cuandoSeguimiento, fechaCorta, haceCuanto, hoy, normalizar, num, ordenEstable, semilla } from '../lib/util'
import type { Contacto, Estado } from '../shared/modelo'

type Cola = 'agenda' | 'pendiente' | 'sin_respuesta' | 'contactado' | 'interesado'

const COLAS: { id: Cola; label: string; ayuda: string }[] = [
  { id: 'agenda', label: 'Seguimientos de hoy', ayuda: 'Los que quedaron para hoy o antes' },
  { id: 'pendiente', label: 'Nunca contactados', ayuda: 'Primera llamada o mensaje' },
  { id: 'sin_respuesta', label: 'Volver a intentar', ayuda: 'No contestaron la última vez' },
  { id: 'contactado', label: 'Conversaciones abiertas', ayuda: 'Ya se les escribió' },
  { id: 'interesado', label: 'Interesados', ayuda: 'Cerrar la renovación' },
]

const MEDIA_HORA = 30 * 60_000

export function Llamar() {
  const { contactos, sesion, esAdmin, equipo, avisar } = useCRM()
  const { abrirFicha } = useNav()
  const [cola, setCola] = useState<Cola>('agenda')
  const [region, setRegion] = useState('')
  const [persona, setPersona] = useState(esAdmin ? '' : '')
  const [hechos, setHechos] = useState<Set<string>>(new Set())
  const [fiesta, setFiesta] = useState(0)

  const seed = useMemo(() => semilla(sesion.nombre), [sesion.nombre])
  const h = hoy()

  const disponibles = useMemo(() => {
    const ahora = Date.now()
    const p = normalizar(persona)
    const base = contactos.filter((c) => {
      if (c.noContactar || !c.wa) return false
      if (region && c.region !== region) return false
      if (p === '-' ? !!c.asignado : p && normalizar(c.asignado) !== p && normalizar(c.contacto) !== p) return false
      // Si otra persona lo acaba de trabajar, no se repite
      if (c.at && c.por !== sesion.nombre && ahora - Date.parse(c.at) < MEDIA_HORA) return false
      return true
    })
    const porCola: Record<Cola, Contacto[]> = {
      agenda: base
        .filter((c) => c.seguimiento && c.seguimiento <= h && c.estado !== 'renovado' && c.estado !== 'no_interesado')
        .sort((a, b) => a.seguimiento!.localeCompare(b.seguimiento!)),
      pendiente: base.filter((c) => c.estado === 'pendiente'),
      sin_respuesta: base.filter((c) => c.estado === 'sin_respuesta' && (!c.seguimiento || c.seguimiento <= h)),
      contactado: base.filter((c) => c.estado === 'contactado' && (!c.seguimiento || c.seguimiento <= h)),
      interesado: base
        .filter((c) => c.estado === 'interesado')
        .sort((a, b) => (a.seguimiento ?? '0').localeCompare(b.seguimiento ?? '0')),
    }
    // Orden distinto para cada persona del equipo: no se pisan llamando a los mismos
    for (const k of ['pendiente', 'sin_respuesta', 'contactado'] as const) {
      porCola[k].sort((a, b) => ordenEstable(a.id, seed) - ordenEstable(b.id, seed))
    }
    return porCola
  }, [contactos, h, persona, region, seed, sesion.nombre])

  // Al entrar, abre la primera cola que tenga gente (no una vacía)
  const elegida = useRef(false)
  useEffect(() => {
    if (elegida.current) return
    elegida.current = true
    const primera = COLAS.find((k) => disponibles[k.id].length > 0)
    if (primera) setCola(primera.id)
  }, [disponibles])

  const fila = disponibles[cola].filter((c) => !hechos.has(c.id))
  const actual = fila[0]
  const otra = COLAS.find((k) => k.id !== cola && disponibles[k.id].some((c) => !hechos.has(c.id)))

  const hoyMios = useMemo(() => {
    const inicio = new Date()
    inicio.setHours(0, 0, 0, 0)
    return contactos.filter((c) => c.por === sesion.nombre && c.at && Date.parse(c.at) >= inicio.getTime()).length
  }, [contactos, sesion.nombre])

  const siguiente = (id: string, estado?: Estado) => {
    setHechos((s) => new Set(s).add(id))
    if (estado === 'renovado') setFiesta((n) => n + 1)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="kicker">Uno por uno, sin perder tiempo</p>
          <h1 className="font-display text-4xl leading-none font-extrabold tracking-tight uppercase">Cola de llamadas</h1>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-miel-claro px-4 py-2 text-sm">
          <Sparkles size={16} className="text-miel-oscuro" />
          Hoy registraste <b className="num">{num(hoyMios)}</b> {hoyMios === 1 ? 'resultado' : 'resultados'}
        </div>
      </div>

      {/* Elegir cola */}
      <div className="scroll-fino -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {COLAS.map((k) => {
          const n = disponibles[k.id].filter((c) => !hechos.has(c.id)).length
          const on = cola === k.id
          return (
            <button
              key={k.id}
              ref={on ? (el) => el?.scrollIntoView({ inline: 'nearest', block: 'nearest' }) : undefined}
              onClick={() => setCola(k.id)}
              className={`shrink-0 rounded-2xl border px-4 py-3 text-left transition ${on ? 'border-vino-700 bg-vino-700 text-white shadow-tarjeta' : 'border-linea bg-white hover:border-vino-500/40'}`}
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                {k.id === 'interesado' && <Flame size={15} className={on ? 'text-miel' : 'text-[#eb6834]'} />}
                {k.id === 'agenda' && <CalendarClock size={15} className={on ? 'text-miel' : 'text-vino-600'} />}
                {k.label}
                <span className={`num rounded-full px-2 py-0.5 text-xs ${on ? 'bg-white/15' : 'bg-papel text-tinta-2'}`}>{num(n)}</span>
              </span>
              <span className={`mt-0.5 block text-xs ${on ? 'text-white/65' : 'text-tenue'}`}>{k.ayuda}</span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <select className="campo w-auto" value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="">Todas las regiones</option>
          <option>México</option>
          <option>EUA</option>
          <option>LATAM y otros</option>
        </select>
        {esAdmin && (
          <select className="campo w-auto" value={persona} onChange={(e) => setPersona(e.target.value)}>
            <option value="">De cualquier responsable</option>
            <option value="-">Solo sin asignar</option>
            {equipo.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        )}
        {hechos.size > 0 && (
          <button className="btn-suave" onClick={() => setHechos(new Set())}>
            <RotateCcw size={15} /> Reiniciar ({hechos.size})
          </button>
        )}
      </div>

      <div className="relative">
        <AnimatePresence mode="popLayout">
          {actual ? (
            <motion.div
              key={actual.id}
              initial={{ opacity: 0, x: 60, rotate: 1.5 }}
              animate={{ opacity: 1, x: 0, rotate: 0 }}
              exit={{ opacity: 0, x: -80, rotate: -2 }}
              transition={{ type: 'spring', damping: 26, stiffness: 260 }}
            >
              <Tarjeta
                c={actual}
                restantes={fila.length - 1}
                saltar={() => siguiente(actual.id)}
                hecho={(e) => siguiente(actual.id, e)}
                abrir={() => abrirFicha(actual.id)}
                copiado={async () => avisar((await copiar(actual.tel)) ? 'Número copiado' : 'No se pudo copiar')}
              />
            </motion.div>
          ) : (
            <motion.div key="vacio" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="tarjeta">
              <Vacio
                icono={<PhoneCall size={26} />}
                titulo={!contactos.length ? 'Todavía no tienes contactos' : hechos.size ? '¡Cola terminada!' : 'Nadie en esta cola por ahora'}
                texto={
                  !contactos.length
                    ? 'Pídele a tu líder que te asigne contactos desde la app de administradores.'
                    : otra
                      ? `Sigue con “${otra.label}”: ahí hay gente esperando.`
                      : 'No hay más contactos pendientes. Vuelve más tarde o revisa tus seguimientos.'
                }
              />
              {otra && contactos.length > 0 && (
                <div className="-mt-8 flex justify-center pb-8">
                  <button className="btn-primario" onClick={() => setCola(otra.id)}>
                    Ir a {otra.label}
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        <Fiesta n={fiesta} />
      </div>
    </div>
  )
}

function Tarjeta({
  c,
  restantes,
  saltar,
  hecho,
  abrir,
  copiado,
}: {
  c: Contacto
  restantes: number
  saltar: () => void
  hecho: (e: Estado) => void
  abrir: () => void
  copiado: () => void
}) {
  const notas = [...c.notas].reverse().filter((n) => n.t || n.e).slice(0, 3)
  return (
    <div className="grid overflow-hidden rounded-3xl border border-linea bg-white shadow-flotante lg:grid-cols-[1fr_1.1fr]">
      <div className="panal relative bg-linear-to-br from-vino-950 via-vino-800 to-vino-600 p-6 text-white sm:p-7">
        <img src="/abeja.png" alt="" className="pointer-events-none absolute -right-4 -bottom-6 w-40 opacity-10" />
        <p className="num text-xs font-semibold tracking-[0.14em] text-miel uppercase">Siguiente · quedan {num(restantes)}</p>
        <div className="mt-4 flex items-center gap-4">
          <Avatar nombre={c.nombre} estado={c.estado} tam={64} oscuro />
          <div className="min-w-0">
            <h2 className="font-display text-4xl leading-[0.95] font-extrabold">{c.nombre}</h2>
            <p className="mt-1.5 text-sm text-white/70">{[c.pais, c.region !== c.pais ? c.region : ''].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white p-0.5">
            <EstadoChip estado={c.estado} />
          </span>
          {c.seguimiento && (
            <span className="pildora border-miel/40 bg-miel/15 text-miel-claro">
              <CalendarClock size={13} /> {cuandoSeguimiento(c.seguimiento)}
            </span>
          )}
          {c.fecha && <span className="pildora border-white/20 text-white/70">Registro {fechaCorta(c.fecha)}</span>}
        </div>
        <button onClick={copiado} className="mt-5 flex items-center gap-2 font-mono text-xl tracking-wide text-white hover:text-miel">
          {c.tel} <Copy size={16} className="opacity-60" />
        </button>
        {c.email && <p className="mt-1 truncate text-sm text-white/55">{c.email}</p>}

        <div className="mt-5 flex flex-col gap-2">
          {notas.length ? (
            notas.map((n, i) => (
              <div key={i} className="rounded-xl bg-white/8 px-3 py-2 text-sm">
                <p className="text-[11px] text-white/50">
                  {n.por ? `${n.por} · ${haceCuanto(n.f)}` : `Excel · ${n.h}`}
                  {n.e && ` · ${n.e.replace('_', ' ')}`}
                </p>
                {n.t && <p className="text-white/90">{n.t}</p>}
              </div>
            ))
          ) : (
            <p className="text-sm text-white/50">Sin notas anteriores: es su primer contacto.</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 p-5 sm:p-7">
        <div>
          <p className="kicker mb-2">1 · Contáctalo</p>
          <div className="flex flex-wrap gap-2">
            <BotonWhatsapp c={c} />
            <BotonLlamar c={c} />
            <button onClick={abrir} className="btn-suave">
              <ExternalLink size={15} /> Ficha
            </button>
          </div>
        </div>
        <div>
          <p className="kicker mb-2">2 · ¿Qué pasó?</p>
          <Resultado c={c} grande alTerminar={(o) => hecho(o.estado)} />
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-linea pt-4">
          <span className="flex items-center gap-1.5 text-xs text-tenue">
            <UserRoundX size={14} /> ¿No es buen momento? Pásalo para después.
          </span>
          <button onClick={saltar} className="btn-suave">
            Saltar <SkipForward size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}

/** Celebración cuando alguien renueva */
function Fiesta({ n }: { n: number }) {
  return (
    <AnimatePresence>
      {n > 0 && (
        <motion.div
          key={n}
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ delay: 1.6, duration: 0.5 }}
        >
          {Array.from({ length: 18 }).map((_, i) => {
            const ang = (i / 18) * Math.PI * 2
            return (
              <motion.span
                key={i}
                className="absolute size-3 rounded-full"
                style={{ backgroundColor: i % 3 === 0 ? '#1baf7a' : i % 3 === 1 ? '#e0a43a' : '#9b2c22' }}
                initial={{ x: 0, y: 0, scale: 0 }}
                animate={{ x: Math.cos(ang) * 180, y: Math.sin(ang) * 140, scale: [0, 1.4, 0.6] }}
                transition={{ duration: 1.1, ease: 'easeOut' }}
              />
            )
          })}
          <motion.div
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 12 }}
            className="rounded-3xl bg-white px-8 py-5 text-center shadow-flotante"
          >
            <img src="/favicon.png" alt="" className="mx-auto size-14 rounded-2xl" />
            <p className="mt-2 font-display text-4xl font-extrabold text-vino-700 uppercase">¡Renovó!</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
