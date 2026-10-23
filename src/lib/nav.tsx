import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Estado } from '../shared/modelo'

export type Pagina = 'panel' | 'inicio' | 'contactos' | 'seguimientos' | 'llamar' | 'equipo' | 'mensajes'

export interface Filtros {
  estados?: Estado[]
  region?: string
  sede?: string
  responsable?: string
  motivo?: string
  sinAsignar?: boolean
}

interface Nav {
  pagina: Pagina
  filtros: Filtros
  /** cambia cada vez que se navega con filtros nuevos (para reiniciar la vista) */
  llave: number
  ir: (p: Pagina, filtros?: Filtros) => void
  fichaId: string | null
  abrirFicha: (id: string | null) => void
}

const Ctx = createContext<Nav | null>(null)

export function useNav() {
  const n = useContext(Ctx)
  if (!n) throw new Error('useNav fuera del proveedor')
  return n
}

const PAGINAS: Pagina[] = ['panel', 'inicio', 'contactos', 'seguimientos', 'llamar', 'equipo', 'mensajes']

function desdeHash(defecto: Pagina, permitidas: Pagina[]): Pagina {
  const p = window.location.hash.replace(/^#\/?/, '').split('?')[0] as Pagina
  return PAGINAS.includes(p) && permitidas.includes(p) ? p : defecto
}

export function ProveedorNav({ defecto, permitidas, children }: { defecto: Pagina; permitidas: Pagina[]; children: ReactNode }) {
  const [pagina, setPagina] = useState<Pagina>(() => desdeHash(defecto, permitidas))
  const [filtros, setFiltros] = useState<Filtros>({})
  const [llave, setLlave] = useState(0)
  const [fichaId, setFichaId] = useState<string | null>(null)

  useEffect(() => {
    const alCambiar = () => setPagina(desdeHash(defecto, permitidas))
    window.addEventListener('hashchange', alCambiar)
    return () => window.removeEventListener('hashchange', alCambiar)
  }, [defecto, permitidas])

  const ir = useCallback((p: Pagina, f?: Filtros) => {
    setFiltros(f ?? {})
    setLlave((k) => k + 1)
    setPagina(p)
    if (window.location.hash !== `#/${p}`) window.history.pushState(null, '', `#/${p}`)
    window.scrollTo({ top: 0 })
  }, [])

  return (
    <Ctx.Provider value={{ pagina, filtros, llave, ir, fichaId, abrirFicha: setFichaId }}>{children}</Ctx.Provider>
  )
}
