import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { autenticar, contactosPorId, db, error, ok, okNull, puedeVer, sinCache } from './_lib.js'

const BUCKET = 'comprobantes'
const EXTENSION: Record<string, string> = { 'image/jpeg': 'jpg', 'application/pdf': 'pdf' }
const MAX_BYTES = 3_000_000
// El archivo viaja en base64 dentro del JSON (Vercel limita el cuerpo a 4,5 MB): 3 MB de archivo ≈ 4 MB de texto
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/

/** El contenido debe ser de verdad lo que dice el tipo (no se confía en lo que manda el navegador) */
function coincide(tipo: string, b: Buffer) {
  if (tipo === 'image/jpeg') return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
  return b.subarray(0, 4).toString('latin1') === '%PDF'
}

/** POST: sube un comprobante de pago a un contacto. GET ?id=: enlace temporal (5 min) para abrirlo. */
export async function POST(req: Request) {
  const q = await autenticar(req)
  if (q instanceof Response) return q
  try {
    const d = (await req.json().catch(() => null)) as { contactoId?: unknown; nombre?: unknown; tipo?: unknown; datos?: unknown } | null
    const malo = (mensaje: string) => Response.json({ error: mensaje }, { status: 400 })
    if (typeof d?.contactoId !== 'string' || !/^[a-z0-9]{6,24}$/.test(d.contactoId)) return malo('Falta el contacto')
    if (typeof d.tipo !== 'string' || !(d.tipo in EXTENSION)) return malo('Solo se aceptan fotos (JPG) y PDF')
    if (typeof d.datos !== 'string' || !BASE64.test(d.datos)) return malo('El archivo no es válido')
    const bytes = Buffer.from(d.datos, 'base64')
    if (bytes.length > MAX_BYTES) return malo('El archivo pesa más de 3 MB')
    if (!coincide(d.tipo, bytes)) return malo('El archivo no corresponde a su tipo')

    const [c] = await contactosPorId([d.contactoId])
    if (!c || !puedeVer(q, c)) return Response.json({ error: 'no-existe' }, { status: 404 })

    const nombre = (typeof d.nombre === 'string' ? d.nombre.trim() : '').slice(0, 120) || `comprobante.${EXTENSION[d.tipo]}`
    const ruta = `${c.id}/${randomUUID()}.${EXTENSION[d.tipo]}`
    const subida = await db().storage.from(BUCKET).upload(ruta, bytes, { contentType: d.tipo, upsert: false })
    if (subida.error) throw new Error(subida.error.message)
    const { error: errFila } = await db().from('comprobantes').insert({ contacto_id: c.id, ruta, nombre, tipo: d.tipo, por: q.nombre })
    if (errFila) {
      await db().storage.from(BUCKET).remove([ruta])
      throw new Error(errFila.message)
    }
    // Queda en la línea de tiempo y sube la versión: así los demás lo ven en su siguiente consulta
    ok(
      await db().rpc('crm_editar', {
        p_ids: [c.id],
        p_ed: {},
        p_por: q.nombre,
        p_texto: 'subió un comprobante de pago',
        p_nombre: c.nombre,
        p_estado: null,
        p_detalle: `Comprobante de pago subido: ${nombre}`,
      }),
    )
    return Response.json({ contactos: await contactosPorId([c.id]) }, { headers: sinCache })
  } catch (err) {
    return error(err)
  }
}

export async function GET(req: Request) {
  const q = await autenticar(req)
  if (q instanceof Response) return q
  try {
    const id = new URL(req.url).searchParams.get('id') ?? ''
    if (!/^[0-9a-f-]{36}$/.test(id)) return Response.json({ error: 'datos' }, { status: 400 })
    const f = okNull(await db().from('comprobantes').select('contacto_id, ruta, nombre').eq('id', id).maybeSingle())
    if (!f) return Response.json({ error: 'no-existe' }, { status: 404 })
    const [c] = await contactosPorId([f.contacto_id])
    if (!c || !puedeVer(q, c)) return Response.json({ error: 'no-existe' }, { status: 404 })
    const firma = await db().storage.from(BUCKET).createSignedUrl(f.ruta, 300)
    if (firma.error) throw new Error(firma.error.message)
    return Response.json({ url: firma.data.signedUrl, nombre: f.nombre }, { headers: sinCache })
  } catch (err) {
    return error(err)
  }
}
