import { cerrarRevertida, enviar, TABLA_SOLICITUDES, type Solicitud } from './_acceso.js'
import { configurado } from './_conector.js'
import { autenticar, contactosPorId, db, error, ok, puedeVer, sinCache } from './_lib.js'

/** GET: avisos de renovación y su estado (administrador) */
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

/**
 * POST {id, accion}: quien puede ver el contacto vuelve a enviar su aviso ('reenviar') o confirma que ya le
 * avisó al Club a mano que esa renovación no procede ('cerrar', solo para las revertidas).
 */
export async function POST(req: Request) {
  const q = await autenticar(req)
  if (q instanceof Response) return q
  try {
    const body = (await req.json().catch(() => null)) as { id?: unknown; accion?: unknown } | null
    if (typeof body?.id !== 'string' || (body.accion !== 'reenviar' && body.accion !== 'cerrar')) {
      return Response.json({ error: 'datos' }, { status: 400 })
    }
    const s = (await db().from(TABLA_SOLICITUDES).select('*').eq('id', body.id).maybeSingle()).data as Solicitud | null
    if (!s) return Response.json({ error: 'no-existe' }, { status: 404 })
    const [contacto] = await contactosPorId([s.contacto_id])
    if (!contacto || !puedeVer(q, contacto)) return Response.json({ error: 'no-existe' }, { status: 404 })

    if (body.accion === 'cerrar') {
      if (s.estado !== 'revertida') return Response.json({ error: 'estado' }, { status: 409 })
      await cerrarRevertida(s, q.nombre)
    } else {
      if (!configurado()) return Response.json({ error: 'sin-conector' }, { status: 503 })
      // Solo se reenvía lo que no llegó; una fallida vuelve a empezar (el mismo solicitud_id evita duplicados del otro lado)
      if (s.estado !== 'pendiente' && s.estado !== 'fallida') return Response.json({ error: 'estado' }, { status: 409 })
      await enviar({ ...s, intentos: s.estado === 'fallida' ? 0 : s.intentos })
    }
    return Response.json({ contactos: await contactosPorId([s.contacto_id]) }, { headers: sinCache })
  } catch (err) {
    return error(err)
  }
}
