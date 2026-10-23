import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { api } from '../lib/api'
import { useCRM } from '../lib/crm'
import { num } from '../lib/util'

const ESPERA_OCUPADO = 8_000
const MAX_LLAMADAS = 200

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Actualiza la lista de clientes inactivos desde el CRM del Club.
 * El servidor trae unas cuantas páginas por llamada (el Club es lento), así que se repite hasta que diga "completo".
 */
export function BotonClub() {
  const { sesion, recargar, avisar } = useCRM()
  const [estado, setEstado] = useState<string | null>(null)

  const actualizar = async () => {
    let procesados = 0
    let nuevos = 0
    let aprobadas = 0
    try {
      setEstado('Conectando con el Club…')
      for (let i = 0; i < MAX_LLAMADAS; i++) {
        const r = await api.sincronizar(sesion)
        if (r.ocupado) {
          // Otra sincronización (p. ej. la automática) está corriendo: se espera a que termine
          setEstado('Hay otra actualización en curso, esperando…')
          await pausa(ESPERA_OCUPADO)
          continue
        }
        procesados += r.contactos ?? 0
        nuevos += r.nuevos ?? 0
        aprobadas += r.aprobadas ?? 0
        if (r.completo) {
          await recargar()
          avisar(`Lista actualizada: ${num(procesados)} clientes inactivos, ${num(nuevos)} nuevos${aprobadas ? `, ${num(aprobadas)} renovaciones aprobadas` : ''}`)
          return
        }
        setEstado(`Descargando… página ${r.siguientePagina ?? '?'} · ${num(procesados)} clientes`)
      }
      avisar('La actualización sigue en curso; vuelve a pulsar el botón para continuar.', 'error')
    } catch (err) {
      avisar(`No se pudo actualizar: ${(err as Error).message}`, 'error')
      // Lo que alcanzó a llegar antes del error también se muestra
      await recargar().catch(() => undefined)
    } finally {
      setEstado(null)
    }
  }

  return (
    <button className="btn-suave" onClick={() => void actualizar()} disabled={estado !== null} title="Trae del CRM del Club a los clientes sin acceso">
      <RefreshCw size={16} className={estado ? 'animate-spin' : ''} /> {estado ?? 'Actualizar desde el Club'}
    </button>
  )
}
