import { AnimatePresence, motion } from 'framer-motion'
import { CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Login } from './components/Login'
import { Shell } from './components/Shell'
import { api, ErrorApi, guardarSesion, leerSesion, type Carga, type Sesion } from './lib/api'
import { ProveedorCRM } from './lib/crm'

const esRutaAdmin = () => /^\/+admin/i.test(decodeURIComponent(window.location.pathname))

interface Aviso {
  id: number
  texto: string
  tipo: 'ok' | 'error'
}

export default function App() {
  const admin = esRutaAdmin()
  const [sesion, setSesion] = useState<Sesion | null>(() => leerSesion())
  const [carga, setCarga] = useState<Carga | null>(null)
  const [error, setError] = useState('')
  const [avisos, setAvisos] = useState<Aviso[]>([])

  const avisar = useCallback((texto: string, tipo: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random()
    setAvisos((a) => [...a.slice(-2), { id, texto, tipo }])
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), tipo === 'error' ? 6000 : 3200)
  }, [])

  useEffect(() => {
    if (!sesion) return
    // Cada código abre su app: administradores en /admin, usuarios en /
    if (sesion.rol === 'admin' && !admin) return window.location.replace('/admin')
    if (sesion.rol === 'usuario' && admin) return window.location.replace('/')
    let vivo = true
    setError('')
    api
      .contactos(sesion)
      .then((c) => {
        if (!vivo) return
        // El servidor manda el rol y nombre vigentes (p. ej. si un admin cambió la cuenta)
        if (c.yo.rol !== sesion.rol || c.yo.nombre !== sesion.nombre) {
          const s = { ...sesion, rol: c.yo.rol, nombre: c.yo.nombre }
          guardarSesion(s)
          setSesion(s)
          return
        }
        setCarga(c)
      })
      .catch((err) => {
        if (!vivo) return
        if (err instanceof ErrorApi && (err.status === 401 || err.status === 403)) {
          guardarSesion(null)
          setSesion(null)
        } else setError(err instanceof Error ? err.message : 'Error')
      })
    return () => {
      vivo = false
    }
  }, [admin, sesion])

  const salir = useCallback(() => {
    guardarSesion(null)
    setSesion(null)
    setCarga(null)
  }, [])

  let cuerpo
  if (!sesion) {
    cuerpo = (
      <Login
        admin={admin}
        alEntrar={(s) => {
          guardarSesion(s)
          setSesion(s)
        }}
      />
    )
  } else if (!carga) {
    cuerpo = (
      <div className="panal flex min-h-dvh flex-col items-center justify-center gap-4 bg-linear-to-br from-vino-950 to-vino-800 p-6 text-center text-white">
        <img src="/abeja.png" alt="" className="size-16 animate-pulse" />
        {error ? (
          <>
            <p className="max-w-sm text-sm text-white/80">No se pudieron cargar los contactos: {error}</p>
            <div className="flex gap-2">
              <button className="btn bg-white text-vino-800" onClick={() => setSesion({ ...sesion })}>
                Reintentar
              </button>
              <button className="btn text-white/80 hover:text-white" onClick={salir}>
                Salir
              </button>
            </div>
          </>
        ) : (
          <p className="flex items-center gap-2 text-sm text-white/70">
            <LoaderCircle className="animate-spin" size={16} /> Cargando contactos…
          </p>
        )}
      </div>
    )
  } else {
    cuerpo = (
      <ProveedorCRM sesion={sesion} inicial={carga} avisar={avisar}>
        <Shell salir={salir} />
      </ProveedorCRM>
    )
  }

  return (
    <>
      {cuerpo}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        <AnimatePresence>
          {avisos.map((a) => (
            <motion.div
              key={a.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              className={`pointer-events-auto flex max-w-md items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium text-white shadow-flotante ${
                a.tipo === 'error' ? 'bg-[#a32a29]' : 'bg-vino-950'
              }`}
              role="status"
            >
              {a.tipo === 'error' ? <CircleAlert size={18} /> : <CircleCheck size={18} className="text-miel" />}
              {a.texto}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  )
}
