import { Camera, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useCRM } from '../lib/crm'
import { Avatar, Modal } from './ui'

const LADO = 256

/** Recorta al centro en cuadrado y reduce a un JPEG pequeño (unos 15-30 KB): es lo único que se guarda */
async function reducir(archivo: File): Promise<string> {
  const img = await createImageBitmap(archivo, { imageOrientation: 'from-image' })
  const lado = Math.min(img.width, img.height)
  const lienzo = document.createElement('canvas')
  lienzo.width = lienzo.height = LADO
  const ctx = lienzo.getContext('2d')
  if (!ctx) throw new Error('El navegador no puede procesar imágenes')
  // fondo blanco por si la foto es PNG con transparencia
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, LADO, LADO)
  ctx.drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, LADO, LADO)
  img.close()
  return lienzo.toDataURL('image/jpeg', 0.82)
}

/** Foto de perfil de la persona que tiene la sesión abierta */
export function Perfil({ abierto, cerrar }: { abierto: boolean; cerrar: () => void }) {
  const { sesion, foto, guardarFoto, avisar } = useCRM()
  const [trabajando, setTrabajando] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)

  const elegir = async (archivo?: File) => {
    if (!archivo) return
    if (!archivo.type.startsWith('image/')) return avisar('Elige una imagen (JPG, PNG…)', 'error')
    setTrabajando(true)
    try {
      if (await guardarFoto(await reducir(archivo))) avisar('Foto actualizada')
    } catch {
      avisar('No se pudo leer esa imagen. Prueba con otra.', 'error')
    } finally {
      setTrabajando(false)
      if (entrada.current) entrada.current.value = ''
    }
  }

  const quitar = async () => {
    setTrabajando(true)
    if (await guardarFoto(null)) avisar('Foto quitada')
    setTrabajando(false)
  }

  return (
    <Modal abierto={abierto} cerrar={cerrar} titulo="Mi perfil" ancho="max-w-sm">
      <div className="flex flex-col items-center gap-4 pb-1 text-center">
        <Avatar nombre={sesion.nombre} tam={128} foto={foto} />
        <div>
          <p className="text-lg font-semibold">{sesion.nombre}</p>
          <p className="text-sm text-tenue">{sesion.rol === 'admin' ? 'Administrador' : 'Equipo'}</p>
        </div>
        <input ref={entrada} type="file" accept="image/*" hidden onChange={(e) => void elegir(e.target.files?.[0])} />
        <div className="flex flex-wrap justify-center gap-2">
          <button className="btn-primario" disabled={trabajando} onClick={() => entrada.current?.click()}>
            <Camera size={16} /> {trabajando ? 'Guardando…' : foto ? 'Cambiar foto' : 'Subir foto'}
          </button>
          {foto && (
            <button className="btn-suave" disabled={trabajando} onClick={() => void quitar()}>
              <Trash2 size={16} /> Quitar
            </button>
          )}
        </div>
        <p className="text-xs text-tenue">Se recorta en cuadrado y se reduce sola. La ve el resto del equipo.</p>
      </div>
    </Modal>
  )
}
