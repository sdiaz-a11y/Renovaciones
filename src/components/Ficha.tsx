import { AnimatePresence, motion } from 'framer-motion'
import { CalendarClock, CircleCheckBig, Clock, Copy, FileSpreadsheet, Mail, MapPin, Send, ShieldAlert, StickyNote, TriangleAlert, UserRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useCRM } from '../lib/crm'
import { copiar, cuandoSeguimiento, fechaCorta, haceCuanto, hoy, textoVencimiento } from '../lib/util'
import { ESTADO, ESTADOS, MOTIVOS, MOTIVOS_ELEGIBLES, type Contacto } from '../shared/modelo'
import { Resultado } from './Resultado'
import { Avatar, BotonLlamar, BotonWhatsapp, EstadoChip } from './ui'

export function Ficha({ id, cerrar }: { id: string | null; cerrar: () => void }) {
  const { porId } = useCRM()
  const c = id ? porId.get(id) : undefined

  useEffect(() => {
    if (!id) return
    const t = (e: KeyboardEvent) => e.key === 'Escape' && cerrar()
    document.addEventListener('keydown', t)
    return () => document.removeEventListener('keydown', t)
  }, [id, cerrar])

  return (
    <AnimatePresence>
      {c && (
        <>
          <motion.div
            key="fondo"
            className="fixed inset-0 z-40 bg-vino-950/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={cerrar}
          />
          <motion.aside
            key="ficha"
            role="dialog"
            aria-label={`Ficha de ${c.nombre}`}
            className="scroll-fino fixed inset-y-0 right-0 z-50 flex w-full max-w-[520px] flex-col overflow-y-auto bg-papel shadow-flotante"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <Contenido c={c} cerrar={cerrar} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function Contenido({ c, cerrar }: { c: Contacto; cerrar: () => void }) {
  const { actualizar, equipo, avisar } = useCRM()
  const [nota, setNota] = useState('')
  const [asignado, setAsignado] = useState(c.asignado)
  useEffect(() => setAsignado(c.asignado), [c.id, c.asignado])

  const notas = [...c.notas].reverse()
  const guardarAsignado = () => {
    if (asignado.trim() !== c.asignado) void actualizar([c.id], { asignado: asignado.trim() })
  }

  return (
    <>
      {/* Encabezado */}
      <div className="panal relative bg-linear-to-br from-vino-900 via-vino-800 to-vino-700 px-5 pt-5 pb-6 text-white">
        <button onClick={cerrar} className="absolute top-4 right-4 rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Cerrar">
          <X size={22} />
        </button>
        <div className="flex items-center gap-3.5 pr-10">
          <Avatar nombre={c.nombre} estado={c.estado} tam={54} oscuro />
          <div className="min-w-0">
            <h2 className="font-display text-[28px] leading-[1.05] font-bold">{c.nombre}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-white/70">
              <span className="inline-flex items-center gap-1">
                <MapPin size={13} />
                {[c.pais, c.region !== c.pais ? c.region : ''].filter(Boolean).join(' · ') || 'Sin ubicación'}
              </span>
              {c.fecha && <span>· {textoVencimiento(c.fecha).toLowerCase()}</span>}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white px-0.5 py-0.5">
            <EstadoChip estado={c.estado} />
          </span>
          {c.motivo && <span className="pildora border-white/25 text-white/85">{MOTIVOS[c.motivo]}</span>}
          {c.seguimiento && (
            <span className="pildora border-miel/50 bg-miel/15 text-miel-claro">
              <CalendarClock size={13} /> {cuandoSeguimiento(c.seguimiento)}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4 sm:p-5">
        {c.noContactar && (
          <div className="flex items-start gap-3 rounded-2xl border border-[#e34948]/40 bg-[#e34948]/8 p-3.5 text-sm">
            <ShieldAlert className="mt-0.5 shrink-0 text-[#c0302f]" size={18} />
            <div className="flex-1">
              <p className="font-semibold text-[#9f2524]">Pidió que no lo vuelvan a contactar</p>
              <p className="text-tinta-2">Respeta su decisión. Si fue un error, puedes quitar la marca.</p>
            </div>
            <button onClick={() => actualizar([c.id], { noContactar: false })} className="text-xs font-semibold text-tinta-2 underline">
              Quitar
            </button>
          </div>
        )}

        <AvisoClub c={c} />

        {/* Contacto */}
        <section className="tarjeta p-4">
          <div className="flex flex-wrap items-center gap-2">
            {!c.noContactar && <BotonWhatsapp c={c} />}
            {!c.noContactar && <BotonLlamar c={c} />}
            {c.email && (
              <a href={`mailto:${c.email}`} className="btn-suave">
                <Mail size={16} /> Correo
              </a>
            )}
          </div>
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-tenue">Teléfono</dt>
            <dd className="flex items-center gap-2">
              {c.tel || <span className="text-tenue">Sin número válido</span>}
              {c.tel && (
                <button
                  onClick={async () => avisar((await copiar(c.tel)) ? 'Número copiado' : 'No se pudo copiar', 'ok')}
                  className="text-tenue hover:text-tinta"
                  aria-label="Copiar número"
                >
                  <Copy size={14} />
                </button>
              )}
            </dd>
            {c.telAlt && (
              <>
                <dt className="text-tenue">Otro número</dt>
                <dd>{c.telAlt}</dd>
              </>
            )}
            <dt className="text-tenue">Correo</dt>
            <dd className="truncate">{c.email || '—'}</dd>
            <dt className="text-tenue">Contactó</dt>
            <dd>{c.contacto || '—'}</dd>
            <dt className="text-tenue">Viene de</dt>
            <dd className="text-tinta-2">{c.hojas.join(', ')}</dd>
          </dl>
        </section>

        {/* Resultado rápido */}
        {!c.noContactar && (
          <section className="tarjeta p-4">
            <h3 className="kicker mb-3">Registrar resultado</h3>
            <Resultado c={c} />
          </section>
        )}

        {/* Ajustes */}
        <section className="tarjeta flex flex-col gap-4 p-4">
          <div>
            <h3 className="kicker mb-2">Estado</h3>
            <div className="flex flex-wrap gap-1.5">
              {ESTADOS.map((e) => (
                <button
                  key={e.id}
                  onClick={() => e.id !== c.estado && actualizar([c.id], { estado: e.id })}
                  className={`pildora ${e.id === c.estado ? 'border-tinta bg-tinta text-white' : 'border-linea-2 bg-white hover:bg-papel'}`}
                >
                  <span className="size-2 rounded-full" style={{ backgroundColor: e.color }} />
                  {e.label}
                </button>
              ))}
            </div>
            {c.estado === 'no_interesado' && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {MOTIVOS_ELEGIBLES.map((m) => (
                  <button
                    key={m}
                    onClick={() => actualizar([c.id], { motivo: m })}
                    className={`pildora text-[11px] ${c.motivo === m ? 'border-[#e34948] bg-[#e34948]/12 font-semibold' : 'border-linea-2 bg-white'}`}
                  >
                    {MOTIVOS[m]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="kicker mb-1.5 flex items-center gap-1.5">
                <UserRound size={13} /> Asignado a
              </span>
              <input
                className="campo"
                value={asignado}
                list="lista-equipo"
                onChange={(e) => setAsignado(e.target.value)}
                onBlur={guardarAsignado}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                placeholder="Nadie"
              />
              <datalist id="lista-equipo">
                {equipo.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </label>
            <div>
              <span className="kicker mb-1.5 flex items-center gap-1.5">
                <CalendarClock size={13} /> Próximo seguimiento
              </span>
              <input
                type="date"
                className="campo"
                value={c.seguimiento ?? ''}
                onChange={(e) => actualizar([c.id], { seguimiento: e.target.value || null })}
              />
              <div className="mt-1.5 flex flex-wrap gap-1">
                {[
                  ['Mañana', 1],
                  ['3 días', 3],
                  ['1 semana', 7],
                ].map(([t, d]) => (
                  <button key={t} onClick={() => actualizar([c.id], { seguimiento: hoy(d as number) })} className="pildora border-linea-2 bg-white px-2 py-0.5 text-[11px] hover:bg-papel">
                    {t}
                  </button>
                ))}
                {c.seguimiento && (
                  <button onClick={() => actualizar([c.id], { seguimiento: null })} className="pildora border-transparent px-2 py-0.5 text-[11px] text-tenue hover:text-tinta">
                    Quitar
                  </button>
                )}
              </div>
            </div>
          </div>
          {!c.noContactar && (
            <button onClick={() => actualizar([c.id], { noContactar: true })} className="self-start text-xs font-medium text-tenue underline-offset-2 hover:text-[#c0302f] hover:underline">
              Marcar como “no contactar”
            </button>
          )}
        </section>

        {/* Historial */}
        <section className="tarjeta p-4">
          <h3 className="kicker mb-3">Historial</h3>
          <form
            className="mb-4 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault()
              const t = nota.trim()
              if (!t) return
              if (await actualizar([c.id], { nota: t })) setNota('')
            }}
          >
            <input className="campo" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Escribe una nota…" maxLength={600} />
            <button className="btn-primario shrink-0" disabled={!nota.trim()}>
              Guardar
            </button>
          </form>
          {notas.length === 0 ? (
            <p className="text-sm text-tenue">Todavía no hay notas.</p>
          ) : (
            <ol className="relative flex flex-col gap-3 border-l-2 border-linea pl-4">
              {notas.map((n, i) => (
                <li key={i} className="relative">
                  <span
                    className="absolute top-1.5 -left-[22px] size-2.5 rounded-full ring-4 ring-white"
                    style={{ backgroundColor: n.e ? ESTADO[n.e].color : n.por ? '#9b2c22' : '#c9bfbb' }}
                  />
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-tenue">
                    {n.por ? (
                      <>
                        <span className="font-semibold text-tinta-2">{n.por}</span>
                        <span>{haceCuanto(n.f)}</span>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <FileSpreadsheet size={12} /> Excel · {n.h}
                        {n.f && ` · ${fechaCorta(n.f)}`}
                      </span>
                    )}
                    {n.e && <EstadoChip estado={n.e} chico />}
                  </div>
                  {n.t && <p className={n.h === 'cambio' ? 'mt-0.5 text-[13px] text-tinta-2' : 'mt-0.5 text-sm'}>{n.t}</p>}
                </li>
              ))}
            </ol>
          )}
          {c.at && (
            <p className="mt-4 flex items-center gap-1.5 text-xs text-tenue">
              <StickyNote size={12} /> Última actualización: {c.por} · {haceCuanto(c.at)}
            </p>
          )}
        </section>
      </div>
    </>
  )
}

/** Estado del aviso de renovación que se envió al CRM del Club */
function AvisoClub({ c }: { c: Contacto }) {
  const { avisoClub } = useCRM()
  const [ocupado, setOcupado] = useState(false)
  const s = c.solicitud
  if (!s) return null
  const accion = async (a: 'reenviar' | 'cerrar') => {
    setOcupado(true)
    await avisoClub(s.id, a)
    setOcupado(false)
  }
  const boton = (texto: string, a: 'reenviar' | 'cerrar') => (
    <button className="btn-suave shrink-0" disabled={ocupado} onClick={() => void accion(a)}>
      {ocupado ? '…' : texto}
    </button>
  )
  const cuando = haceCuanto(s.creada)

  const [tono, icono, titulo, detalle, acciones] = {
    pendiente: [
      'border-linea-2 bg-white',
      <Clock key="i" className="text-tenue" size={18} />,
      'Aviso al Club pendiente de envío',
      'Todavía no llega al CRM del Club; se reintenta solo cada pocos minutos.',
      boton('Enviar ahora', 'reenviar'),
    ],
    enviada: [
      'border-linea-2 bg-white',
      <Send key="i" className="text-[#2a78d6]" size={18} />,
      'Aviso enviado al Club',
      'Esperando que un administrador del Club apruebe la renovación.',
      null,
    ],
    aprobada: [
      'border-[#1baf7a]/40 bg-[#1baf7a]/8',
      <CircleCheckBig key="i" className="text-[#1baf7a]" size={18} />,
      'Renovación aprobada por el Club',
      'Ya quedó renovada en el CRM del Club.',
      null,
    ],
    fallida: [
      'border-[#e34948]/40 bg-[#e34948]/8',
      <TriangleAlert key="i" className="text-[#c0302f]" size={18} />,
      'No se pudo avisar al Club',
      s.error ?? 'El CRM del Club no recibió el aviso.',
      boton('Reintentar', 'reenviar'),
    ],
    revertida: [
      'border-[#e34948]/40 bg-[#e34948]/8',
      <TriangleAlert key="i" className="text-[#c0302f]" size={18} />,
      'El Club todavía tiene esta renovación',
      'Se le avisó que renovó, pero aquí se quitó “Renovado”. Avísales que no procede y pulsa el botón.',
      boton('Ya les avisé', 'cerrar'),
    ],
  }[s.estado]

  return (
    <section className={`flex items-start gap-3 rounded-2xl border p-3.5 text-sm ${tono}`}>
      <span className="mt-0.5 shrink-0">{icono}</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{titulo}</p>
        <p className="text-tinta-2">{detalle}</p>
        <p className="mt-0.5 text-xs text-tenue">Aviso creado {cuando}</p>
      </div>
      {acciones}
    </section>
  )
}
