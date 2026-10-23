import { Check, Copy, KeyRound, LoaderCircle, MessageCircle, Plus, Power, Shield, Shuffle, UserRound } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { MiniEstados } from '../components/graficas'
import { Seccion } from '../components/piezas'
import { Avatar, Modal } from '../components/ui'
import { api, type RespUsuario } from '../lib/api'
import { useCRM } from '../lib/crm'
import { useNav } from '../lib/nav'
import { copiar, haceCuanto, num, ordenEstable, pct } from '../lib/util'
import { enAlcance, nombresDe, type Contacto, type Estado, type Rol, type UsuarioPublico } from '../shared/modelo'

export function Equipo() {
  const { sesion, avisar } = useCRM()
  const [usuarios, setUsuarios] = useState<UsuarioPublico[] | null>(null)
  const [codigo, setCodigo] = useState<RespUsuario | null>(null)

  const cargar = useCallback(async () => {
    try {
      setUsuarios((await api.usuarios(sesion)).usuarios)
    } catch (err) {
      avisar(`No se cargaron las cuentas: ${(err as Error).message}`, 'error')
      setUsuarios([])
    }
  }, [avisar, sesion])
  useEffect(() => void cargar(), [cargar])

  const accion = async (datos: Parameters<typeof api.usuario>[1]) => {
    try {
      const r = await api.usuario(sesion, datos)
      setUsuarios((us) => {
        const lista = us ?? []
        return lista.some((u) => u.id === r.usuario.id) ? lista.map((u) => (u.id === r.usuario.id ? r.usuario : u)) : [...lista, r.usuario]
      })
      if (r.codigo) setCodigo(r)
      return true
    } catch (err) {
      avisar((err as Error).message, 'error')
      return false
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="kicker">Solo administradores</p>
        <h1 className="font-display text-4xl leading-none font-extrabold tracking-tight uppercase">Equipo</h1>
        <p className="mt-2 max-w-2xl text-sm text-tinta-2">
          Cada persona entra a la app de usuarios con su <b>código personal</b> y solo ve los contactos asignados a su nombre (o a los nombres con los que
          aparece en el Excel).
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <Cuentas usuarios={usuarios} accion={accion} className="xl:col-span-7" />
        <NuevaCuenta accion={accion} className="xl:col-span-5" />
      </div>
      <Repartir usuarios={usuarios ?? []} />
      <Rendimiento usuarios={usuarios ?? []} />

      <Modal abierto={!!codigo} cerrar={() => setCodigo(null)} titulo="Código de acceso">
        {codigo && <MostrarCodigo r={codigo} />}
      </Modal>
    </div>
  )
}

function MostrarCodigo({ r }: { r: RespUsuario }) {
  const { avisar } = useCRM()
  const url = `${window.location.origin}/${r.usuario.rol === 'admin' ? 'admin' : ''}`
  const mensaje = `Hola ${r.usuario.nombre.split(' ')[0]} 👋 Este es tu acceso al CRM de Renovaciones del Club Sinergético 🐝\n\n${url}\nTu código: ${r.codigo}\n\nNo lo compartas con nadie.`
  return (
    <div>
      <p className="text-sm text-tinta-2">
        Este es el código de <b>{r.usuario.nombre}</b>. Cópialo o envíaselo ahora: por seguridad <b>no se vuelve a mostrar</b> (si se pierde, genera uno
        nuevo).
      </p>
      <div className="my-5 rounded-2xl bg-vino-950 px-4 py-5 text-center font-mono text-2xl font-bold tracking-[0.18em] text-miel sm:text-3xl">{r.codigo}</div>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primario" onClick={async () => avisar((await copiar(r.codigo!)) ? 'Código copiado' : 'No se pudo copiar')}>
          <Copy size={16} /> Copiar código
        </button>
        <button className="btn-suave" onClick={async () => avisar((await copiar(mensaje)) ? 'Mensaje copiado' : 'No se pudo copiar')}>
          <Copy size={16} /> Copiar mensaje
        </button>
        <a className="btn-wa" href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noopener noreferrer">
          <MessageCircle size={16} /> Enviar por WhatsApp
        </a>
      </div>
      <p className="mt-4 text-xs text-tenue">
        Entra en: <span className="font-mono">{url}</span>
      </p>
    </div>
  )
}

function Cuentas({
  usuarios,
  accion,
  className,
}: {
  usuarios: UsuarioPublico[] | null
  accion: (d: Parameters<typeof api.usuario>[1]) => Promise<boolean>
  className?: string
}) {
  const { contactos } = useCRM()
  const [editando, setEditando] = useState<string | null>(null)
  return (
    <Seccion kicker={usuarios ? `${usuarios.filter((u) => u.activo).length} activas` : 'Cargando…'} titulo="Cuentas" className={className}>
      {!usuarios ? (
        <p className="flex items-center gap-2 py-6 text-sm text-tenue">
          <LoaderCircle className="animate-spin" size={16} /> Cargando cuentas…
        </p>
      ) : usuarios.length === 0 ? (
        <p className="py-6 text-sm text-tenue">Todavía no hay cuentas. Crea la primera a la derecha →</p>
      ) : (
        <ul className="flex flex-col divide-y divide-linea">
          {usuarios.map((u) => {
            const n = contactos.filter((c) => enAlcance(c, nombresDe(u))).length
            return (
              <li key={u.id} className={`py-3 ${u.activo ? '' : 'opacity-55'}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar nombre={u.nombre} tam={38} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-semibold">
                      {u.nombre}
                      {u.rol === 'admin' && (
                        <span className="pildora border-miel/50 bg-miel-claro px-2 py-0 text-[10px] text-miel-oscuro">
                          <Shield size={10} /> Admin
                        </span>
                      )}
                      {!u.activo && <span className="text-xs font-normal text-tenue">(desactivada)</span>}
                    </p>
                    <p className="text-xs text-tenue">
                      <span className="num">{num(n)}</span> contactos
                      {u.alias.length > 0 && <> · en el Excel: {u.alias.join(', ')}</>} · {u.ultimoAcceso ? `entró ${haceCuanto(u.ultimoAcceso)}` : 'no ha entrado'}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <button className="btn-suave px-2.5 py-1.5 text-xs" onClick={() => setEditando(editando === u.id ? null : u.id)}>
                      Editar
                    </button>
                    <button className="btn-suave px-2.5 py-1.5 text-xs" onClick={() => accion({ accion: 'codigo', id: u.id })} title="Generar código nuevo (el anterior deja de servir)">
                      <KeyRound size={13} /> Código
                    </button>
                    <button
                      className="btn-suave px-2.5 py-1.5 text-xs"
                      onClick={() => accion({ accion: 'editar', id: u.id, activo: !u.activo })}
                      title={u.activo ? 'Desactivar (ya no podrá entrar)' : 'Activar'}
                      aria-label={u.activo ? 'Desactivar' : 'Activar'}
                    >
                      <Power size={13} />
                    </button>
                  </div>
                </div>
                {editando === u.id && <EditarCuenta u={u} accion={accion} listo={() => setEditando(null)} />}
              </li>
            )
          })}
        </ul>
      )}
    </Seccion>
  )
}

/** Nombres del Excel (ASIGNADO A / CONTACTÓ) que todavía se pueden ligar a una cuenta */
function useNombresExcel() {
  const { contactos } = useCRM()
  return useMemo(() => {
    const n = new Map<string, number>()
    for (const c of contactos) {
      for (const x of new Set([c.asignado, c.contacto])) if (x) n.set(x, (n.get(x) ?? 0) + 1)
    }
    return [...n.entries()].sort((a, b) => b[1] - a[1])
  }, [contactos])
}

function SelectorAlias({ valor, cambiar }: { valor: string[]; cambiar: (v: string[]) => void }) {
  const nombres = useNombresExcel()
  return (
    <div className="flex flex-wrap gap-1.5">
      {nombres.slice(0, 24).map(([n, k]) => {
        const on = valor.includes(n)
        return (
          <button
            type="button"
            key={n}
            onClick={() => cambiar(on ? valor.filter((x) => x !== n) : [...valor, n])}
            className={`pildora ${on ? 'border-vino-700 bg-vino-700 text-white' : 'border-linea-2 bg-white hover:bg-papel'}`}
          >
            {on && <Check size={12} />}
            {n} <span className={`num ${on ? 'text-white/70' : 'text-tenue'}`}>{num(k)}</span>
          </button>
        )
      })}
    </div>
  )
}

function EditarCuenta({ u, accion, listo }: { u: UsuarioPublico; accion: (d: Parameters<typeof api.usuario>[1]) => Promise<boolean>; listo: () => void }) {
  const [nombre, setNombre] = useState(u.nombre)
  const [alias, setAlias] = useState(u.alias)
  const [rol, setRol] = useState<Rol>(u.rol)
  return (
    <form
      className="mt-3 flex flex-col gap-3 rounded-2xl bg-papel p-4"
      onSubmit={async (e) => {
        e.preventDefault()
        if (await accion({ accion: 'editar', id: u.id, nombre: nombre.trim(), alias, rol })) listo()
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <input className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} />
        <select className="campo" value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
          <option value="usuario">Usuario (solo sus contactos)</option>
          <option value="admin">Administrador (todo)</option>
        </select>
      </div>
      <div>
        <p className="kicker mb-1.5">También aparece en el Excel como</p>
        <SelectorAlias valor={alias} cambiar={setAlias} />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-suave" onClick={listo}>
          Cancelar
        </button>
        <button className="btn-primario">Guardar</button>
      </div>
    </form>
  )
}

function NuevaCuenta({ accion, className }: { accion: (d: Parameters<typeof api.usuario>[1]) => Promise<boolean>; className?: string }) {
  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState<Rol>('usuario')
  const [alias, setAlias] = useState<string[]>([])
  const [ocupado, setOcupado] = useState(false)
  return (
    <Seccion kicker="Dar acceso" titulo="Nueva cuenta" className={className}>
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!nombre.trim()) return
          setOcupado(true)
          const ok = await accion({ accion: 'crear', nombre: nombre.trim(), rol, alias })
          setOcupado(false)
          if (ok) {
            setNombre('')
            setAlias([])
            setRol('usuario')
          }
        }}
      >
        <label>
          <span className="kicker mb-1 flex items-center gap-1.5">
            <UserRound size={13} /> Nombre
          </span>
          <input className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Moy" maxLength={60} />
        </label>
        <div className="flex rounded-xl bg-papel p-1 text-sm font-semibold">
          {(['usuario', 'admin'] as Rol[]).map((r) => (
            <button type="button" key={r} onClick={() => setRol(r)} className={`flex-1 rounded-lg py-2 ${rol === r ? 'bg-white shadow-tarjeta' : 'text-tenue'}`}>
              {r === 'usuario' ? 'Usuario' : 'Administrador'}
            </button>
          ))}
        </div>
        <div>
          <p className="kicker mb-1.5">¿Cómo aparece en el Excel? (opcional)</p>
          <p className="mb-2 text-xs text-tenue">Elige sus nombres para que vea los contactos que ya trabajaba.</p>
          <SelectorAlias valor={alias} cambiar={setAlias} />
        </div>
        <button className="btn-primario mt-1" disabled={ocupado || !nombre.trim()}>
          {ocupado ? <LoaderCircle className="animate-spin" size={16} /> : <Plus size={16} />} Crear y generar código
        </button>
      </form>
    </Seccion>
  )
}

const BOLSAS: { id: string; label: string; estados: Estado[] }[] = [
  { id: 'pendiente', label: 'Nunca contactados', estados: ['pendiente'] },
  { id: 'sin_respuesta', label: 'Sin respuesta', estados: ['sin_respuesta'] },
  { id: 'ambos', label: 'Ambos', estados: ['pendiente', 'sin_respuesta', 'contactado'] },
]

function Repartir({ usuarios }: { usuarios: UsuarioPublico[] }) {
  const { contactos, actualizar, avisar } = useCRM()
  const activos = usuarios.filter((u) => u.activo && u.rol === 'usuario')
  const [bolsa, setBolsa] = useState('pendiente')
  const [region, setRegion] = useState('México')
  const [soloSinAsignar, setSoloSinAsignar] = useState(true)
  const [porPersona, setPorPersona] = useState(50)
  const [elegidos, setElegidos] = useState<Set<string>>(new Set())
  const [ocupado, setOcupado] = useState(false)

  const disponibles = useMemo(() => {
    const est = BOLSAS.find((b) => b.id === bolsa)!.estados
    return contactos
      .filter((c) => est.includes(c.estado) && !c.noContactar && c.wa && (!region || c.region === region) && (!soloSinAsignar || !c.asignado))
      .sort((a, b) => ordenEstable(a.id, 7) - ordenEstable(b.id, 7))
  }, [bolsa, contactos, region, soloSinAsignar])

  const personas = activos.filter((u) => elegidos.has(u.id))
  const totalAsignar = Math.min(disponibles.length, personas.length * porPersona)

  const repartir = async () => {
    if (!personas.length || !totalAsignar) return
    setOcupado(true)
    let i = 0
    for (const u of personas) {
      const ids = disponibles.slice(i, i + porPersona).map((c: Contacto) => c.id)
      i += porPersona
      if (!ids.length) break
      if (!(await actualizar(ids, { asignado: u.nombre }))) break
    }
    setOcupado(false)
    avisar(`Se repartieron ${num(Math.min(i, totalAsignar))} contactos entre ${personas.length} ${personas.length === 1 ? 'persona' : 'personas'}`)
  }

  return (
    <Seccion kicker="Asignación en lote" titulo="Repartir contactos">
      {activos.length === 0 ? (
        <p className="text-sm text-tenue">Crea cuentas de usuario para poder repartirles contactos.</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr_auto]">
          <div className="flex flex-col gap-3">
            <p className="kicker">1 · ¿Qué contactos?</p>
            <div className="flex flex-wrap gap-1.5">
              {BOLSAS.map((b) => (
                <button key={b.id} onClick={() => setBolsa(b.id)} className={`pildora ${bolsa === b.id ? 'border-tinta bg-tinta text-white' : 'border-linea-2 bg-white'}`}>
                  {b.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <select className="campo w-auto" value={region} onChange={(e) => setRegion(e.target.value)}>
                <option value="">Todas las regiones</option>
                <option>México</option>
                <option>EUA</option>
                <option>LATAM y otros</option>
              </select>
              <button onClick={() => setSoloSinAsignar((v) => !v)} className={`pildora ${soloSinAsignar ? 'border-vino-600 bg-vino-50 text-vino-700' : 'border-linea-2 bg-white'}`}>
                {soloSinAsignar && <Check size={12} />} Solo sin asignar
              </button>
            </div>
            <p className="text-sm text-tinta-2">
              Hay <b className="num text-tinta">{num(disponibles.length)}</b> disponibles con WhatsApp válido.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <p className="kicker">2 · ¿A quién y cuántos?</p>
            <div className="flex flex-wrap gap-1.5">
              {activos.map((u) => {
                const on = elegidos.has(u.id)
                return (
                  <button
                    key={u.id}
                    onClick={() =>
                      setElegidos((s) => {
                        const x = new Set(s)
                        if (on) x.delete(u.id)
                        else x.add(u.id)
                        return x
                      })
                    }
                    className={`pildora ${on ? 'border-vino-700 bg-vino-700 text-white' : 'border-linea-2 bg-white'}`}
                  >
                    {on && <Check size={12} />} {u.nombre}
                  </button>
                )
              })}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="number" min={1} max={1000} className="campo w-24" value={porPersona} onChange={(e) => setPorPersona(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))} />
              contactos por persona
            </label>
          </div>
          <div className="flex flex-col justify-end gap-2 lg:w-56">
            <p className="text-sm text-tinta-2">
              {personas.length ? (
                <>
                  Se asignarán <b className="num text-tinta">{num(totalAsignar)}</b> contactos
                </>
              ) : (
                'Elige al menos una persona'
              )}
            </p>
            <button className="btn-primario py-3" disabled={ocupado || !totalAsignar} onClick={repartir}>
              {ocupado ? <LoaderCircle size={16} className="animate-spin" /> : <Shuffle size={16} />} Repartir
            </button>
          </div>
        </div>
      )}
    </Seccion>
  )
}

function Rendimiento({ usuarios }: { usuarios: UsuarioPublico[] }) {
  const { contactos } = useCRM()
  const { ir } = useNav()
  const filas = useMemo(() => {
    const cuentas = usuarios.map((u) => ({ nombre: u.nombre, nombres: nombresDe(u), cuenta: true }))
    const cubiertos = new Set(cuentas.flatMap((c) => c.nombres))
    // Personas del Excel que todavía no tienen cuenta
    const sueltos = new Map<string, string>()
    for (const c of contactos) {
      for (const n of [c.asignado, c.contacto]) {
        const k = n?.trim().toLowerCase()
        if (n && k && !cubiertos.has(k.normalize('NFD').replace(/[̀-ͯ]/g, ''))) sueltos.set(k, n)
      }
    }
    return [...cuentas, ...[...sueltos.values()].map((n) => ({ nombre: n, nombres: nombresDe({ nombre: n, alias: [] }), cuenta: false }))]
      .map((p) => {
        const cs = contactos.filter((c) => enAlcance(c, p.nombres))
        const buscados = cs.filter((c) => c.estado !== 'pendiente').length
        const respondieron = cs.filter((c) => ['interesado', 'no_interesado', 'renovado'].includes(c.estado)).length
        const ultimo = cs.reduce((m, c) => (c.at && c.at > m ? c.at : m), '')
        return { ...p, cs, buscados, respondieron, ultimo }
      })
      .filter((p) => p.cs.length)
      .sort((a, b) => b.cs.length - a.cs.length)
  }, [contactos, usuarios])

  return (
    <Seccion kicker="Contactos de cada quien" titulo="Rendimiento">
      <div className="scroll-fino overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="text-left text-[11px] font-semibold tracking-wide text-tenue uppercase">
              <th className="pb-2 font-semibold">Persona</th>
              <th className="pb-2 font-semibold">Estados</th>
              <th className="pb-2 text-right font-semibold">Contactos</th>
              <th className="pb-2 text-right font-semibold">Buscados</th>
              <th className="pb-2 text-right font-semibold">Respondieron</th>
              <th className="pb-2 text-right font-semibold">Interesados</th>
              <th className="pb-2 text-right font-semibold">Renovados</th>
              <th className="pb-2 text-right font-semibold">Último movimiento</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((p) => (
              <tr key={p.nombre} className="cursor-pointer border-t border-linea hover:bg-papel" onClick={() => ir('contactos', { responsable: p.nombre })}>
                <td className="py-2.5 pr-3">
                  <span className="flex items-center gap-2 font-medium">
                    {p.nombre}
                    {!p.cuenta && <span className="text-[10px] font-normal text-tenue">sin cuenta</span>}
                  </span>
                </td>
                <td className="w-40 py-2.5 pr-3">
                  <MiniEstados cs={p.cs} />
                </td>
                <td className="num py-2.5 text-right">{num(p.cs.length)}</td>
                <td className="num py-2.5 text-right">{pct(p.buscados, p.cs.length, 0)}</td>
                <td className="num py-2.5 text-right">{num(p.respondieron)}</td>
                <td className="num py-2.5 text-right font-semibold">{num(p.cs.filter((c) => c.estado === 'interesado').length)}</td>
                <td className="num py-2.5 text-right font-semibold">{num(p.cs.filter((c) => c.estado === 'renovado').length)}</td>
                <td className="py-2.5 text-right text-xs text-tenue">{p.ultimo ? haceCuanto(p.ultimo) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Seccion>
  )
}
