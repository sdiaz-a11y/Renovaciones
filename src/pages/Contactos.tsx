import { AnimatePresence, motion } from 'framer-motion'
import { CalendarClock, Check, Download, Search, ShieldAlert, SlidersHorizontal, UserPlus, X } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { BotonClub } from '../components/BotonClub'
import { MiniEstados } from '../components/graficas'
import { NuevoContactoModal } from '../components/NuevoContacto'
import { Avatar, BotonWhatsapp, EstadoChip, Vacio } from '../components/ui'
import { useCRM } from '../lib/crm'
import { useNav } from '../lib/nav'
import { claveBusqueda, cuandoSeguimiento, descargarCSV, hoy, normalizar, num } from '../lib/util'
import { ESTADO, ESTADOS, MOTIVOS, type Contacto, type Estado } from '../shared/modelo'

const PASO = 60
type Orden = 'nombre' | 'reciente' | 'seguimiento' | 'registro'

export function Contactos() {
  const { contactos, esAdmin, equipo, actualizar, avisar } = useCRM()
  const { filtros, abrirFicha } = useNav()
  const [q, setQ] = useState('')
  const busqueda = useDeferredValue(q)
  const [estados, setEstados] = useState<Set<Estado>>(new Set(filtros.estados ?? []))
  const [region, setRegion] = useState(filtros.region ?? '')
  const [responsable, setResponsable] = useState(filtros.responsable ?? '')
  const [sinAsignar, setSinAsignar] = useState(!!filtros.sinAsignar)
  const [conSeguimiento, setConSeguimiento] = useState(false)
  const [ocultarNoContactar, setOcultarNoContactar] = useState(false)
  const [orden, setOrden] = useState<Orden>('nombre')
  const [mostrar, setMostrar] = useState(PASO)
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [verFiltros, setVerFiltros] = useState(false)
  const [nuevo, setNuevo] = useState(false)

  const indice = useMemo(() => new Map(contactos.map((c) => [c.id, claveBusqueda(c)])), [contactos])

  const filtrados = useMemo(() => {
    const t = normalizar(busqueda)
    const tDig = busqueda.replace(/\D/g, '')
    const resp = normalizar(responsable)
    const lista = contactos.filter((c) => {
      if (estados.size && !estados.has(c.estado)) return false
      if (region && c.region !== region) return false
      if (resp && normalizar(c.asignado) !== resp && normalizar(c.contacto) !== resp) return false
      if (sinAsignar && c.asignado) return false
      if (conSeguimiento && !c.seguimiento) return false
      if (ocultarNoContactar && c.noContactar) return false
      if (filtros.motivo && (c.motivo ?? 'sin_motivo') !== filtros.motivo) return false
      if (t) {
        const k = indice.get(c.id) ?? ''
        if (!k.includes(t) && !(tDig.length >= 4 && k.includes(tDig))) return false
      }
      return true
    })
    const cmp: Record<Orden, (a: Contacto, b: Contacto) => number> = {
      nombre: (a, b) => a.nombre.localeCompare(b.nombre, 'es'),
      reciente: (a, b) => (b.at ?? '').localeCompare(a.at ?? ''),
      seguimiento: (a, b) => (a.seguimiento ?? '9999').localeCompare(b.seguimiento ?? '9999'),
      registro: (a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''),
    }
    return lista.sort(cmp[orden])
  }, [busqueda, conSeguimiento, contactos, estados, filtros.motivo, indice, ocultarNoContactar, orden, region, responsable, sinAsignar])

  const conteoEstados = useMemo(() => {
    const r = Object.fromEntries(ESTADOS.map((e) => [e.id, 0])) as Record<Estado, number>
    for (const c of contactos) {
      if (region && c.region !== region) continue
      r[c.estado]++
    }
    return r
  }, [contactos, region])

  const alternarEstado = (e: Estado) => {
    setEstados((prev) => {
      const s = new Set(prev)
      if (s.has(e)) s.delete(e)
      else s.add(e)
      return s
    })
    setMostrar(PASO)
  }
  const limpiar = () => {
    setEstados(new Set())
    setRegion('')
    setResponsable('')
    setSinAsignar(false)
    setConSeguimiento(false)
    setOcultarNoContactar(false)
    setQ('')
  }
  const hayFiltros = estados.size || region || responsable || sinAsignar || conSeguimiento || ocultarNoContactar || q || filtros.motivo

  const visibles = filtrados.slice(0, mostrar)
  const todosSel = filtrados.length > 0 && filtrados.every((c) => seleccion.has(c.id))
  const alternarSel = (id: string) =>
    setSeleccion((prev) => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id)
      else s.add(id)
      return s
    })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="kicker">{esAdmin ? 'Toda la base' : 'Asignados a ti'}</p>
          <h1 className="font-display text-4xl leading-none font-extrabold tracking-tight uppercase">{esAdmin ? 'Contactos' : 'Mis contactos'}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-suave" onClick={() => setNuevo(true)}>
            <UserPlus size={16} /> Agregar
          </button>
          {esAdmin && <BotonClub />}
          {esAdmin && (
            <button className="btn-suave" onClick={() => descargarCSV(filtrados, `renovaciones-${hoy()}.csv`)} disabled={!filtrados.length}>
              <Download size={16} /> Exportar {num(filtrados.length)}
            </button>
          )}
        </div>
      </div>

      {/* Buscador y filtros */}
      <div className="tarjeta flex flex-col gap-3 p-3 sm:p-4">
        <div className="flex gap-2">
          <label className="relative flex-1">
            <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-tenue" size={17} />
            <input
              className="campo py-2.5 pl-10"
              placeholder="Buscar por nombre, correo, teléfono o ciudad…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setMostrar(PASO)
              }}
            />
          </label>
          <button className={`btn-suave lg:hidden ${verFiltros ? 'border-vino-500' : ''}`} onClick={() => setVerFiltros((v) => !v)} aria-label="Filtros">
            <SlidersHorizontal size={17} />
          </button>
        </div>

        <div className="scroll-fino -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {ESTADOS.map((e) => {
            const on = estados.has(e.id)
            return (
              <button
                key={e.id}
                onClick={() => alternarEstado(e.id)}
                className={`pildora shrink-0 ${on ? 'border-tinta bg-tinta text-white' : 'border-linea-2 bg-white hover:bg-papel'}`}
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: e.color }} />
                {e.label}
                <span className={`num ${on ? 'text-white/70' : 'text-tenue'}`}>{num(conteoEstados[e.id])}</span>
              </button>
            )
          })}
        </div>

        <div className={`${verFiltros ? 'grid' : 'hidden'} grid-cols-2 gap-2 lg:grid lg:grid-cols-[repeat(3,minmax(0,1fr))_auto]`}>
          <select className="campo" value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">Todas las regiones</option>
            <option>México</option>
            <option>EUA</option>
            <option>LATAM y otros</option>
          </select>
          {esAdmin ? (
            <select className="campo" value={responsable} onChange={(e) => setResponsable(e.target.value)}>
              <option value="">Responsable: todos</option>
              {equipo.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          ) : (
            <span className="hidden lg:block" />
          )}
          <select className="campo" value={orden} onChange={(e) => setOrden(e.target.value as Orden)}>
            <option value="nombre">Ordenar: nombre</option>
            <option value="reciente">Ordenar: actividad reciente</option>
            <option value="seguimiento">Ordenar: próximo seguimiento</option>
            <option value="registro">Ordenar: registro más nuevo</option>
          </select>
          <div className="col-span-2 flex flex-wrap items-center gap-1.5 lg:col-span-1">
            {esAdmin && <Interruptor on={sinAsignar} cambiar={setSinAsignar} texto="Sin asignar" />}
            <Interruptor on={conSeguimiento} cambiar={setConSeguimiento} texto="Con seguimiento" />
            <Interruptor on={ocultarNoContactar} cambiar={setOcultarNoContactar} texto="Ocultar no contactar" />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-tinta-2">
            <b className="num text-tinta">{num(filtrados.length)}</b> {filtrados.length === 1 ? 'persona' : 'personas'}
            {filtros.motivo && <span className="ml-1">· motivo: {MOTIVOS[filtros.motivo as keyof typeof MOTIVOS]}</span>}
          </p>
          <div className="flex w-40 items-center gap-2">{filtrados.length > 0 && <MiniEstados cs={filtrados} />}</div>
          {hayFiltros ? (
            <button onClick={limpiar} className="inline-flex items-center gap-1 text-xs font-semibold text-vino-600">
              <X size={13} /> Quitar filtros
            </button>
          ) : null}
        </div>
      </div>

      {/* Lista */}
      {filtrados.length === 0 ? (
        <div className="tarjeta">
          <Vacio
            icono={<Search size={26} />}
            titulo={contactos.length ? 'Nadie coincide con estos filtros' : 'Todavía no tienes contactos asignados'}
            texto={contactos.length ? 'Prueba con otra búsqueda o quita algún filtro.' : 'Pídele a tu líder que te asigne contactos desde la app de administradores.'}
          />
        </div>
      ) : (
        <div className="tarjeta overflow-hidden">
          <div className="hidden grid-cols-[2rem_minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_2.5rem] items-center gap-3 border-b border-linea bg-papel/60 px-4 py-2.5 text-[11px] font-semibold tracking-wide text-tenue uppercase md:grid">
            {esAdmin ? (
              <input
                type="checkbox"
                className="size-4 accent-vino-700"
                checked={todosSel}
                onChange={() => setSeleccion(todosSel ? new Set() : new Set(filtrados.slice(0, 1000).map((c) => c.id)))}
                aria-label="Seleccionar todos"
              />
            ) : (
              <span />
            )}
            <span>Nombre</span>
            <span>Ubicación</span>
            <span>Estado</span>
            <span>Responsable</span>
            <span>Seguimiento</span>
            <span />
          </div>
          <ul>
            {visibles.map((c) => (
              <Renglon key={c.id} c={c} admin={esAdmin} seleccionado={seleccion.has(c.id)} alternar={() => alternarSel(c.id)} abrir={() => abrirFicha(c.id)} />
            ))}
          </ul>
          {filtrados.length > mostrar && (
            <button onClick={() => setMostrar((m) => m + PASO * 2)} className="w-full border-t border-linea py-3.5 text-sm font-semibold text-vino-600 hover:bg-papel">
              Mostrar más ({num(filtrados.length - mostrar)} restantes)
            </button>
          )}
        </div>
      )}

      {/* Acciones en lote (admin) */}
      <AnimatePresence>
        {esAdmin && seleccion.size > 0 && (
          <BarraLote
            ids={[...seleccion]}
            equipo={equipo}
            limpiar={() => setSeleccion(new Set())}
            aplicar={async (ed, texto) => {
              const ids = [...seleccion]
              let ok = true
              for (let i = 0; i < ids.length && ok; i += 1000) ok = await actualizar(ids.slice(i, i + 1000), ed)
              if (ok) {
                avisar(`${num(ids.length)} contactos: ${texto}`)
                setSeleccion(new Set())
              }
            }}
          />
        )}
      </AnimatePresence>

      <NuevoContactoModal abierto={nuevo} cerrar={() => setNuevo(false)} />
    </div>
  )
}

function Interruptor({ on, cambiar, texto }: { on: boolean; cambiar: (v: boolean) => void; texto: string }) {
  return (
    <button onClick={() => cambiar(!on)} className={`pildora ${on ? 'border-vino-600 bg-vino-50 text-vino-700' : 'border-linea-2 bg-white text-tinta-2'}`}>
      {on && <Check size={12} />}
      {texto}
    </button>
  )
}

function Renglon({ c, admin, seleccionado, alternar, abrir }: { c: Contacto; admin: boolean; seleccionado: boolean; alternar: () => void; abrir: () => void }) {
  // Última nota útil (si solo repite el estado, mejor mostrar correo o teléfono)
  const ultima = [...c.notas].reverse().find((n) => n.t && normalizar(n.t) !== normalizar(ESTADO[c.estado].label))?.t
  const atrasado = c.seguimiento && c.seguimiento < hoy()
  return (
    <li
      className={`grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-linea px-4 py-3 transition last:border-0 hover:bg-papel/70 md:grid-cols-[2rem_minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_2.5rem] ${
        seleccionado ? 'bg-vino-50' : ''
      }`}
      onClick={abrir}
    >
      <span className="hidden md:block" onClick={(e) => e.stopPropagation()}>
        {admin && <input type="checkbox" className="size-4 accent-vino-700" checked={seleccionado} onChange={alternar} aria-label={`Seleccionar ${c.nombre}`} />}
      </span>
      <div className="flex min-w-0 items-center gap-3">
        <Avatar nombre={c.nombre} estado={c.estado} tam={38} />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
            {c.nombre}
            {c.noContactar && <ShieldAlert size={14} className="shrink-0 text-[#c0302f]" aria-label="No contactar" />}
          </p>
          <p className="truncate text-xs text-tenue">{ultima ?? (c.email || c.tel)}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 md:hidden">
            <EstadoChip estado={c.estado} chico />
            {c.seguimiento && (
              <span className={`inline-flex items-center gap-1 text-[11px] ${atrasado ? 'font-semibold text-[#b8312f]' : 'text-tinta-2'}`}>
                <CalendarClock size={11} /> {cuandoSeguimiento(c.seguimiento)}
              </span>
            )}
          </div>
        </div>
      </div>
      <p className="hidden truncate text-sm text-tinta-2 md:block">
        {c.pais || '—'}
        {c.region !== c.pais && <span className="block text-xs text-tenue">{c.region}</span>}
      </p>
      <span className="hidden md:block">
        <EstadoChip estado={c.estado} />
      </span>
      <p className="hidden truncate text-sm md:block">
        {c.asignado || <span className="text-tenue">Sin asignar</span>}
        {c.contacto && c.contacto !== c.asignado && <span className="block truncate text-xs text-tenue">contactó {c.contacto}</span>}
      </p>
      <p className={`hidden text-sm md:block ${atrasado ? 'font-semibold text-[#b8312f]' : 'text-tinta-2'}`}>{c.seguimiento ? cuandoSeguimiento(c.seguimiento) : '—'}</p>
      <span onClick={(e) => e.stopPropagation()}>{!c.noContactar && <BotonWhatsapp c={c} compacto />}</span>
    </li>
  )
}

function BarraLote({
  ids,
  equipo,
  limpiar,
  aplicar,
}: {
  ids: string[]
  equipo: string[]
  limpiar: () => void
  aplicar: (ed: Parameters<ReturnType<typeof useCRM>['actualizar']>[1], texto: string) => Promise<void>
}) {
  const [asignar, setAsignar] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const correr = async (ed: Parameters<typeof aplicar>[0], texto: string) => {
    setOcupado(true)
    await aplicar(ed, texto)
    setOcupado(false)
  }
  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      className="fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-4xl flex-wrap items-center gap-2 rounded-2xl bg-vino-950 p-3 text-white shadow-flotante lg:bottom-6 lg:left-[calc(16rem+1.5rem)]"
    >
      <span className="num px-2 text-sm font-semibold">{num(ids.length)} seleccionados</span>
      <form
        className="flex flex-1 gap-1.5"
        onSubmit={(e) => {
          e.preventDefault()
          if (asignar.trim()) void correr({ asignado: asignar.trim() }, `asignados a ${asignar.trim()}`)
        }}
      >
        <input
          className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none"
          placeholder="Asignar a…"
          list="lote-equipo"
          value={asignar}
          onChange={(e) => setAsignar(e.target.value)}
        />
        <datalist id="lote-equipo">
          {equipo.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <button className="btn bg-miel text-vino-950 hover:brightness-105" disabled={ocupado || !asignar.trim()}>
          Asignar
        </button>
      </form>
      <select
        className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm"
        value=""
        disabled={ocupado}
        onChange={(e) => {
          const est = e.target.value as Estado
          if (est) void correr({ estado: est }, `→ ${ESTADO[est].label}`)
        }}
      >
        <option value="" className="text-tinta">
          Cambiar estado…
        </option>
        {ESTADOS.map((e) => (
          <option key={e.id} value={e.id} className="text-tinta">
            {e.label}
          </option>
        ))}
      </select>
      <button onClick={() => void correr({ asignado: '' }, 'sin asignar')} disabled={ocupado} className="btn text-white/70 hover:text-white">
        Quitar asignación
      </button>
      <button onClick={limpiar} className="rounded-lg p-2 text-white/60 hover:text-white" aria-label="Cancelar selección">
        <X size={18} />
      </button>
    </motion.div>
  )
}
