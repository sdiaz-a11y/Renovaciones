import { PLANTILLAS_INICIALES, type Contacto } from '../src/shared/modelo.js'
import { autenticar, error, leerActividad, leerConfig, leerContactos, puedeVer, sinCache, versionActual } from './_lib.js'

/** Solo lo que cambió desde la versión que ya tiene el navegador (se consulta cada pocos segundos) */
export async function GET(req: Request) {
  const q = await autenticar(req)
  if (q instanceof Response) return q
  try {
    const desde = Number(new URL(req.url).searchParams.get('desde') ?? 0) || 0
    const v = await versionActual()
    if (v <= desde) return Response.json({ v, contactos: [], quitar: [], actividad: [] }, { headers: sinCache })
    const [cambiados, actividad, config] = await Promise.all([leerContactos(desde), leerActividad(q, { desde }), leerConfig()])
    const contactos: Contacto[] = []
    // Si un administrador le quitó un contacto a esta persona, su app debe dejar de mostrarlo
    const quitar: string[] = []
    for (const c of cambiados) {
      if (puedeVer(q, c)) contactos.push(c)
      else quitar.push(c.id)
    }
    return Response.json(
      {
        v,
        contactos,
        quitar,
        actividad,
        plantillas: config.plantillas ?? PLANTILLAS_INICIALES,
        meta: config.meta,
      },
      { headers: sinCache },
    )
  } catch (err) {
    return error(err)
  }
}
