import { motion } from 'framer-motion'
import { ArrowRight, KeyRound, LoaderCircle, ShieldCheck, UserRound } from 'lucide-react'
import { useState } from 'react'
import { api, ErrorApi, type Sesion } from '../lib/api'

/** Pantalla de entrada: misma para las dos apps, cambia el texto y los campos */
export function Login({ admin, alEntrar }: { admin: boolean; alEntrar: (s: Sesion) => void }) {
  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!codigo.trim()) return
    setCargando(true)
    setError('')
    try {
      const r = await api.sesion({ codigo: codigo.trim(), nombre: nombre.trim() })
      alEntrar({ codigo: codigo.trim(), nombre: r.nombre, rol: r.rol })
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'Sin conexión. Revisa tu internet.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="panal flex min-h-dvh items-center justify-center bg-linear-to-br from-vino-950 via-vino-900 to-vino-700 p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md"
      >
        <div className="mb-6 flex flex-col items-center text-center text-white">
          <motion.img
            src="/abeja.png"
            alt=""
            className="mb-3 size-20 drop-shadow-[0_8px_24px_rgba(224,164,58,0.35)]"
            animate={{ y: [0, -6, 0], rotate: [0, -4, 0] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <p className="kicker !text-miel">Club Sinergético</p>
          <h1 className="mt-1 font-display text-5xl leading-none font-extrabold tracking-tight uppercase">Renovaciones</h1>
          <p className="mt-2 text-sm text-white/65">
            {admin ? 'App de administradores' : 'Tu lista de contactos, tus llamadas y tus seguimientos'}
          </p>
        </div>

        <form onSubmit={entrar} className="rounded-3xl bg-white p-6 shadow-flotante">
          <div className="mb-5 flex items-center gap-3 rounded-2xl bg-vino-50 px-4 py-3 text-sm text-vino-700">
            {admin ? <ShieldCheck size={20} /> : <KeyRound size={20} />}
            <span>
              {admin
                ? 'Entra con el código de administrador.'
                : 'Entra con el código personal que te dio tu líder.'}
            </span>
          </div>
          <label className="block">
            <span className="kicker mb-1.5 block">Código</span>
            <input
              className="campo py-3 text-center font-mono text-lg tracking-[0.2em] uppercase"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="XXXX-XXXX-XXXX"
              autoComplete="one-time-code"
              autoCapitalize="characters"
              autoFocus
            />
          </label>
          {admin && (
            <label className="mt-4 block">
              <span className="kicker mb-1.5 flex items-center gap-1.5">
                <UserRound size={13} /> Tu nombre
              </span>
              <input
                className="campo"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Para firmar tus cambios (ej. Dani G)"
                maxLength={40}
              />
              <span className="mt-1 block text-xs text-tenue">Solo se usa con el código principal; las cuentas personales ya traen su nombre.</span>
            </label>
          )}
          {error && <p className="mt-3 rounded-xl bg-[#e34948]/10 px-3 py-2 text-sm font-medium text-[#a32a29]">{error}</p>}
          <button className="btn-primario mt-5 w-full py-3 text-base" disabled={cargando || !codigo.trim()}>
            {cargando ? <LoaderCircle className="animate-spin" size={18} /> : <ArrowRight size={18} />}
            Entrar
          </button>
        </form>
        <p className="mt-5 text-center text-xs text-white/45">
          {admin ? (
            <a href="/" className="underline-offset-2 hover:underline">
              ¿Eres del equipo? Entra a la app de usuarios
            </a>
          ) : (
            <a href="/admin" className="underline-offset-2 hover:underline">
              Acceso para administradores
            </a>
          )}
        </p>
      </motion.div>
    </div>
  )
}
