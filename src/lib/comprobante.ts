/** Un comprobante listo para subir: foto reducida a JPEG, o PDF tal cual */
export interface ArchivoListo {
  nombre: string
  tipo: 'image/jpeg' | 'application/pdf'
  /** contenido en base64 (sin el prefijo "data:") */
  datos: string
}

const MAX_PDF = 3_000_000
const LADO_MAX = 1600

function aBase64(blob: Blob): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader()
    lector.onload = () => resolver(String(lector.result).split(',')[1] ?? '')
    lector.onerror = () => rechazar(new Error('No se pudo leer el archivo'))
    lector.readAsDataURL(blob)
  })
}

/** ¿Es algo que se puede subir como comprobante? */
export const esComprobanteValido = (f: File) => f.type === 'application/pdf' || f.type.startsWith('image/')

/** Las fotos se reducen (un comprobante se lee bien a 1600 px y pesa ~300 KB); los PDF no se tocan */
export async function prepararComprobante(f: File): Promise<ArchivoListo> {
  if (f.type === 'application/pdf') {
    if (f.size > MAX_PDF) throw new Error('El PDF pesa más de 3 MB')
    return { nombre: f.name, tipo: 'application/pdf', datos: await aBase64(f) }
  }
  if (!f.type.startsWith('image/')) throw new Error('Sube una foto o un PDF')
  const img = await createImageBitmap(f, { imageOrientation: 'from-image' }).catch(() => {
    throw new Error('No se pudo leer esa imagen. Prueba con otra o con un PDF.')
  })
  const escala = Math.min(1, LADO_MAX / Math.max(img.width, img.height))
  const lienzo = document.createElement('canvas')
  lienzo.width = Math.round(img.width * escala)
  lienzo.height = Math.round(img.height * escala)
  const ctx = lienzo.getContext('2d')
  if (!ctx) throw new Error('El navegador no puede procesar imágenes')
  ctx.fillStyle = '#fff' // por si es PNG con transparencia
  ctx.fillRect(0, 0, lienzo.width, lienzo.height)
  ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height)
  img.close()
  const blob = await new Promise<Blob | null>((r) => lienzo.toBlob(r, 'image/jpeg', 0.85))
  if (!blob) throw new Error('No se pudo procesar la imagen')
  return { nombre: f.name.replace(/\.[^.]+$/, '') + '.jpg', tipo: 'image/jpeg', datos: await aBase64(blob) }
}
