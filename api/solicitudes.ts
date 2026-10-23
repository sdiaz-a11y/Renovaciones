import { enviar, TABLA_SOLICITUDES, type Solicitud } from './_acceso.js'
import { configurado } from './_conector.js'
import { autenticar, db, error, ok, sinCache } from './_lib.js'

/** GET: avisos de renovación y su estado (administrador). POST {id}: vuelve a enviar uno. */
export async function GET(req: Request) {
  const q = await autenticar(req, 'admin')
  if (q instanceof Response) return q
  try {
    const filas = ok(await db().from(TABLA_SOLICITUDES).select('*, contactos(nombre)').order('creada', { ascending: false }).limit(200))
    return Response.json({ solicitudes: filas }, { headers: sinCache })
  } catch (err) {
    return error(err)
  }
}

export async function POST(req: Request) {
  const q = await autenticar(req, 'admin')
  if (q instanceof Response) return q
  try {
    if (!configurado()) return Response.json({ error: 'sin-conector' }, { status: 503 })
    const body = (await req.json().catch(() => null)) as { id?: unknown } | null
    if (typeof body?.id !== 'string') return Response.json({ error: 'datos' }, { status: 400 })
    const s = (await db().from(TABLA_SOLICITUDES).select('*').eq('id', body.id).maybeSingle()).data as Solicitud | null
    if (!s) return Response.json({ error: 'no-existe' }, { status: 404 })
    if (s.estado === 'aprobada') return Response.json({ error: 'aprobada' }, { status: 409 })
    // Una fallida vuelve a empezar; el mismo solicitud_id evita duplicados del otro lado
    const estado = await enviar({ ...s, intentos: s.estado === 'fallida' ? 0 : s.intentos })
    return Response.json({ estado }, { headers: sinCache })
  } catch (err) {
    return error(err)
  }
}
