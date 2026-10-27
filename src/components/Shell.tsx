import { AnimatePresence, motion } from 'framer-motion'
import {
  CalendarClock,
  House,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  PhoneCall,
  UsersRound,
  Contact,
  WifiOff,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useCRM } from '../lib/crm'
import { ProveedorNav, useNav, type Pagina } from '../lib/nav'
import { haceCuanto, hoy } from '../lib/util'
import { Contactos } from '../pages/Contactos'
import { Equipo } from '../pages/Equipo'
import { Inicio } from '../pages/Inicio'
import { Llamar } from '../pages/Llamar'
import { Mensajes } from '../pages/Mensajes'
import { Panel } from '../pages/Panel'
import { Seguimientos } from '../pages/Seguimientos'
import { Ficha } from './Ficha'
import { Perfil } from './Perfil'
import { Avatar } from './ui'

interface Item {
  id: Pagina
  label: string
  corto: string
  icono: ReactNode
}

const ADMIN: Item[] = [
  { id: 'panel', label: 'Panel', corto: 'Panel', icono: <LayoutDashboard size={19} /> },
  { id: 'contactos', label: 'Contactos', corto: 'Contactos', icono: <Contact size={19} /> },
  { id: 'seguimientos', label: 'Seguimientos', corto: 'Agenda', icono: <CalendarClock size={19} /> },
  { id: 'llamar', label: 'Llamar', corto: 'Llamar', icono: <PhoneCall size={19} /> },
  { id: 'equipo', label: 'Equipo', corto: 'Equipo', icono: <UsersRound size={19} /> },
  { id: 'mensajes', label: 'Mensajes y meta', corto: 'Mensajes', icono: <MessageSquareText size={19} /> },
]

const USUARIO: Item[] = [
  { id: 'inicio', label: 'Mi día', corto: 'Mi día', icono: <House size={19} /> },
  { id: 'llamar', label: 'Llamar', corto: 'Llamar', icono: <PhoneCall size={19} /> },
  { id: 'seguimientos', label: 'Seguimientos', corto: 'Agenda', icono: <CalendarClock size={19} /> },
  { id: 'contactos', label: 'Mis contactos', corto: 'Contactos', icono: <Contact size={19} /> },
]

export function Shell({ salir }: { salir: () => void }) {
  const { esAdmin } = useCRM()
  const items = esAdmin ? ADMIN : USUARIO
  const permitidas = useMemo(() => items.map((i) => i.id), [items])
  return (
    <ProveedorNav defecto={esAdmin ? 'panel' : 'inicio'} permitidas={permitidas}>
      <Marco items={items} salir={salir} />
    </ProveedorNav>
  )
}

function Marco({ items, salir }: { items: Item[]; salir: () => void }) {
  const { sesion, esAdmin, contactos, sincronizado, sinConexion, foto } = useCRM()
  const [verPerfil, setVerPerfil] = useState(false)
  const { pagina, ir, fichaId, abrirFicha, llave } = useNav()
  const [, refrescar] = useState(0)
  useEffect(() => {
    const t = setInterval(() => refrescar((n) => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  const pendientesHoy = useMemo(() => {
    const h = hoy()
    return contactos.filter((c) => c.seguimiento && c.seguimiento <= h && c.estado !== 'renovado' && c.estado !== 'no_interesado').length
  }, [contactos])

  const insignia = (id: Pagina) => (id === 'seguimientos' && pendientesHoy ? pendientesHoy : 0)

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Barra lateral (escritorio) */}
      <aside className="panal fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-linear-to-b from-vino-950 via-vino-900 to-vino-800 text-white lg:flex">
        <div className="flex items-center gap-3 px-5 pt-6 pb-5">
          <img src="/abeja.png" alt="" className="size-11" />
          <div>
            <p className="font-display text-xl leading-none font-extrabold tracking-wide uppercase">Club Sinergético</p>
            <p className="mt-1 text-[11px] font-semibold tracking-[0.18em] text-miel uppercase">
              Renovaciones · {esAdmin ? 'Admin' : 'Equipo'}
            </p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {items.map((it) => {
            const activa = pagina === it.id
            const n = insignia(it.id)
            return (
              <button
                key={it.id}
                onClick={() => ir(it.id)}
                className={`relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition ${
                  activa ? 'text-vino-950' : 'text-white/75 hover:bg-white/8 hover:text-white'
                }`}
              >
                {activa && (
                  <motion.span layoutId="nav-activa" className="absolute inset-0 rounded-xl bg-white" transition={{ type: 'spring', damping: 30, stiffness: 350 }} />
                )}
                <span className="relative">{it.icono}</span>
                <span className="relative flex-1">{it.label}</span>
                {n > 0 && <span className="num relative rounded-full bg-miel px-2 py-0.5 text-[11px] font-bold text-vino-950">{n}</span>}
              </button>
            )
          })}
        </nav>
        <div className="m-3 rounded-2xl bg-white/6 p-3.5">
          <div className="flex items-center gap-3">
            <button onClick={() => setVerPerfil(true)} className="shrink-0 rounded-full transition hover:opacity-85" title="Mi perfil y foto" aria-label="Mi perfil y foto">
              <Avatar nombre={sesion.nombre} tam={36} oscuro foto={foto} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{sesion.nombre}</p>
              <p className="flex items-center gap-1 text-[11px] text-white/55">
                {sinConexion ? (
                  <>
                    <WifiOff size={11} /> Sin conexión
                  </>
                ) : (
                  <>
                    <span className="size-1.5 rounded-full bg-[#1baf7a]" /> Sincronizado {sincronizado ? haceCuanto(sincronizado.toISOString()) : ''}
                  </>
                )}
              </p>
            </div>
            <button onClick={salir} className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white" title="Salir" aria-label="Salir">
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      {/* Barra superior (celular) */}
      <header className="panal sticky top-0 z-30 flex items-center gap-3 bg-linear-to-r from-vino-950 to-vino-800 px-4 py-3 text-white lg:hidden">
        <img src="/abeja.png" alt="" className="size-8" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg leading-none font-extrabold uppercase">Renovaciones</p>
          <p className="truncate text-[11px] text-white/60">
            {sesion.nombre} · {sinConexion ? 'sin conexión' : esAdmin ? 'Administrador' : 'Equipo'}
          </p>
        </div>
        <button onClick={() => setVerPerfil(true)} className="shrink-0" aria-label="Mi perfil y foto">
          <Avatar nombre={sesion.nombre} tam={32} oscuro foto={foto} />
        </button>
        <button onClick={salir} className="rounded-lg p-2 text-white/70" aria-label="Salir">
          <LogOut size={18} />
        </button>
      </header>

      <main className="mx-auto w-full max-w-[1400px] px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:pt-8 lg:pb-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={pagina + llave}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
          >
            {pagina === 'panel' && <Panel />}
            {pagina === 'inicio' && <Inicio />}
            {pagina === 'contactos' && <Contactos />}
            {pagina === 'seguimientos' && <Seguimientos />}
            {pagina === 'llamar' && <Llamar />}
            {pagina === 'equipo' && <Equipo />}
            {pagina === 'mensajes' && <Mensajes />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Navegación inferior (celular) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-linea bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {items.map((it) => {
          const activa = pagina === it.id
          const n = insignia(it.id)
          return (
            <button
              key={it.id}
              onClick={() => ir(it.id)}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10.5px] font-semibold ${activa ? 'text-vino-700' : 'text-tenue'}`}
            >
              {activa && <motion.span layoutId="nav-cel" className="absolute top-0 h-0.5 w-10 rounded-full bg-vino-700" />}
              {it.icono}
              {it.corto}
              {n > 0 && <span className="num absolute top-1.5 left-1/2 ml-2 rounded-full bg-miel px-1.5 text-[10px] font-bold text-vino-950">{n}</span>}
            </button>
          )
        })}
      </nav>

      <Ficha id={fichaId} cerrar={() => abrirFicha(null)} />
      <Perfil abierto={verPerfil} cerrar={() => setVerPerfil(false)} />
    </div>
  )
}
