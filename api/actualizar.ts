import { describir, LIMITES, limpiarEdicion } from '../src/shared/modelo.js'
import { crearSolicitudes, enviar, revertirSolicitudes } from './_acceso.js'
import { autenticar, contactosPorId, db, error, ok, puedeVer, sinCache } from './_lib.js'

/** Cambia estado, responsable, seguimiento o agrega una nota a uno o varios contactos */
export async function POST(req: Request) {
  const q = await autenticar(req)
  if (q instanceof Response) return q
  try {
    const body = (await req.json().catch(() => null)) as { ids?: unknown; edicion?: unknown; confirmado?: unknown } | null
    const ids = Array.isArray(body?.ids)
      ? [...new Set(body.ids.filter((x): x is string => typeof x === 'string' && /^[a-z0-9]{6,24}$/.test(x)))]
      : []
    const edicion = limpiarEdicion(body?.edicion)
    // Solo un administrador reasigna contactos
    if (edicion && q.rol !== 'admin') delete edicion.asignado
    if (!ids.length || ids.length > LIMITES.ids || !edicion || !Object.keys(edicion).length) {
      return Response.json({ error: 'datos' }, { status: 400 })
    }
    const validos = (await contactosPorId(ids)).filter((c) => puedeVer(q, c))
    if (!validos.length) return Response.json({ error: 'no-existe' }, { status: 404 })
    // Marcar "Renovado" avisa al CRM del Club: el navegador debe haber pedido la doble verificación
    const nuevosRenovados = edicion.estado === 'renovado' ? validos.filter((c) => c.estado !== 'renovado') : []
    if (nuevosRenovados.length && body?.confirmado !== true) return Response.json({ error: 'confirmar' }, { status: 400 })

    const nombre = validos.length === 1 ? validos[0].nombre : `${validos.length} contactos`
    const v = ok(
      await db().rpc('crm_editar', {
        p_ids: validos.map((c) => c.id),
        p_ed: edicion,
        p_por: q.nombre,
        p_texto: describir(edicion),
        p_nombre: nombre,
        p_estado: edicion.estado ?? null,
      }),
    )

    // Aviso al CRM del Club (si falla, queda pendiente y la sincronización lo reintenta)
    let revertidas: string[] = []
    try {
      if (nuevosRenovados.length) {
        const nuevas = await crearSolicitudes(nuevosRenovados.map((c) => c.id), q.nombre, edicion.nota)
        for (const s of nuevas) await enviar(s)
      } else if (edicion.estado) {
        // Se quitó "Renovado": lo que no había salido se cancela; lo que el Club ya tiene hay que avisárselo
        const quitados = validos.filter((c) => c.estado === 'renovado' && edicion.estado !== 'renovado')
        const r = await revertirSolicitudes(quitados.map((c) => c.id))
        revertidas = quitados.filter((c) => r.revertidas.includes(c.id)).map((c) => c.nombre)
      }
    } catch (err) {
      console.error(err)
    }
    const contactos = await contactosPorId(validos.map((c) => c.id))
    return Response.json({ v: Number(v), contactos, ...(revertidas.length ? { club: { revertidas } } : {}) }, { headers: sinCache })
  } catch (err) {
    return error(err)
  }
}
