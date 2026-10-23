import { motion } from 'framer-motion'
import { ArrowRight, CalendarCheck, Flame, PhoneCall, Trophy, UserRoundPlus } from 'lucide-react'
import { useMemo } from 'react'
import { contarEstados, LeyendaEstados } from '../components/graficas'
import { Contador, Feed, FilaContacto, Seccion, VerTodo } from '../components/piezas'
import { useCRM } from '../lib/crm'
import { useNav } from '../lib/nav'
import { cuandoSeguimiento, hoy, num, pct, primerNombre } from '../lib/util'
import { ESTADOS } from '../shared/modelo'

export function Inicio() {
  const { contactos, sesion, actividad } = useCRM()
  const { ir } = useNav()
  const h = hoy()

  const d = useMemo(() => {
    const abiertos = contactos.filter((c) => c.estado !== 'renovado' && c.estado !== 'no_interesado' && !c.noContactar)
    return {
      conteo: contarEstados(contactos),
      agenda: abiertos.filter((c) => c.seguimiento && c.seguimiento <= h).sort((a, b) => a.seguimiento!.localeCompare(b.seguimiento!)),
      calientes: abiertos.filter((c) => c.estado === 'interesado'),
      buscados: contactos.filter((c) => c.estado !== 'pendiente').length,
    }
  }, [contactos, h])

  const total = contactos.length
  const avance = total ? d.buscados / total : 0
  const fecha = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="flex flex-col gap-5">
      <motion.header
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="panal relative overflow-hidden rounded-3xl bg-linear-to-br from-vino-950 via-vino-800 to-vino-600 p-6 text-white shadow-flotante sm:p-8"
      >
        <motion.img
          src="/abeja.png"
          alt=""
          className="pointer-events-none absolute -right-4 -bottom-8 w-44 opacity-[0.14] sm:w-60"
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <p className="kicker !text-miel first-letter:uppercase">{fecha}</p>
        <h1 className="mt-2 font-display text-5xl leading-[0.95] font-extrabold tracking-tight sm:text-6xl">Hola, {primerNombre(sesion.nombre)} 👋</h1>
        <p className="mt-2 max-w-lg text-white/70">
          {total ? (
            <>
              Tienes <b className="num text-white">{num(total)}</b> personas asignadas.{' '}
              {d.agenda.length ? (
                <>
                  Hoy te toca darle seguimiento a <b className="num text-white">{num(d.agenda.length)}</b>.
                </>
              ) : (
                'No tienes seguimientos pendientes para hoy.'
              )}
            </>
          ) : (
            'Todavía no tienes contactos asignados. Tu líder te los asigna desde la app de administradores.'
          )}
        </p>

        <div className="relative mt-6 flex flex-wrap items-center gap-5">
          <button
            onClick={() => ir('llamar')}
            disabled={!total}
            className="group inline-flex items-center gap-3 rounded-2xl bg-miel px-6 py-4 text-lg font-bold text-vino-950 shadow-[0_10px_30px_-10px_rgba(224,164,58,0.8)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:opacity-50"
          >
            <PhoneCall size={22} /> Empezar a llamar
            <ArrowRight size={20} className="transition group-hover:translate-x-1" />
          </button>
          <Anillo valor={avance} />
        </div>
      </motion.header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cuadro icono={<UserRoundPlus size={17} />} titulo="Por contactar" valor={d.conteo.pendiente} color="#8f8380" onClick={() => ir('contactos', { estados: ['pendiente'] })} />
        <Cuadro icono={<CalendarCheck size={17} />} titulo="Seguimientos hoy" valor={d.agenda.length} color="#9b2c22" onClick={() => ir('seguimientos')} />
        <Cuadro icono={<Flame size={17} />} titulo="Interesados" valor={d.conteo.interesado} color="#eb6834" onClick={() => ir('contactos', { estados: ['interesado'] })} />
        <Cuadro icono={<Trophy size={17} />} titulo="Renovados" valor={d.conteo.renovado} color="#1baf7a" onClick={() => ir('contactos', { estados: ['renovado'] })} />
      </div>

      {total > 0 && (
        <Seccion kicker="Tus contactos por estado" titulo="Cómo va tu lista">
          <div className="flex h-9 gap-[2px] overflow-hidden rounded-xl">
            {ESTADOS.filter((e) => d.conteo[e.id]).map((e) => (
              <motion.button
                key={e.id}
                title={`${e.label}: ${d.conteo[e.id]}`}
                onClick={() => ir('contactos', { estados: [e.id] })}
                className="h-full min-w-[4px] hover:brightness-110"
                style={{ backgroundColor: e.color }}
                initial={{ flexGrow: 0 }}
                animate={{ flexGrow: d.conteo[e.id] / total }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              />
            ))}
          </div>
          <div className="mt-3">
            <LeyendaEstados conteo={d.conteo} />
          </div>
        </Seccion>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Seccion kicker={`${num(d.agenda.length)} pendientes`} titulo="Para hoy" accion={<VerTodo onClick={() => ir('seguimientos')} />}>
          {d.agenda.length ? (
            d.agenda.slice(0, 6).map((c) => (
              <FilaContacto key={c.id} c={c} extra={<span className={c.seguimiento! < h ? 'font-semibold text-[#b8312f]' : ''}>{cuandoSeguimiento(c.seguimiento!)}</span>} />
            ))
          ) : (
            <p className="py-6 text-center text-sm text-tenue">Sin seguimientos para hoy. ¡Buen momento para buscar a los que nunca se han contactado!</p>
          )}
        </Seccion>
        <Seccion kicker="Los más cerca de renovar" titulo="Interesados 🔥" accion={<VerTodo onClick={() => ir('contactos', { estados: ['interesado'] })} />}>
          {d.calientes.length ? (
            d.calientes.slice(0, 6).map((c) => <FilaContacto key={c.id} c={c} />)
          ) : (
            <p className="py-6 text-center text-sm text-tenue">Cuando alguien diga que le interesa, aparecerá aquí.</p>
          )}
        </Seccion>
      </div>

      <Seccion kicker="Lo que has hecho" titulo="Tu actividad">
        <Feed actividad={actividad.filter((a) => a.por === sesion.nombre)} max={10} />
      </Seccion>
    </div>
  )
}

function Cuadro({ icono, titulo, valor, color, onClick }: { icono: React.ReactNode; titulo: string; valor: number; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="tarjeta p-4 text-left transition hover:-translate-y-0.5 hover:shadow-flotante">
      <span className="flex items-center gap-2 text-xs font-medium text-tinta-2">
        <span className="flex size-7 items-center justify-center rounded-lg" style={{ backgroundColor: color + '22', color }}>
          {icono}
        </span>
        {titulo}
      </span>
      <Contador valor={valor} className="mt-2 block font-display text-4xl leading-none font-bold" />
    </button>
  )
}

/** Anillo de avance: qué parte de su lista ya se buscó */
function Anillo({ valor }: { valor: number }) {
  const r = 30
  const l = 2 * Math.PI * r
  return (
    <div className="flex items-center gap-3">
      <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden>
        <circle cx="38" cy="38" r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" />
        <motion.circle
          cx="38"
          cy="38"
          r={r}
          fill="none"
          stroke="#e0a43a"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={l}
          initial={{ strokeDashoffset: l }}
          animate={{ strokeDashoffset: l * (1 - valor) }}
          transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1] }}
          transform="rotate(-90 38 38)"
        />
      </svg>
      <div>
        <p className="num font-display text-3xl leading-none font-bold">{pct(valor, 1, 0)}</p>
        <p className="text-xs text-white/60">de tu lista ya
          <br />
          fue contactada
        </p>
      </div>
    </div>
  )
}
