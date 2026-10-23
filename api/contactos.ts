import { PLANTILLAS_INICIALES } from '../src/shared/modelo.js'
import { autenticar, error, leerActividad, leerConfig, leerContactos, puedeVer, sinCache, versionActual } from './_lib.js'

/** Contactos combinados con los cambios del equipo: admin recibe todos, usuario solo los suyos */
export async function GET(req: Request) {
  const q = await autenticar(req)
  if (q instanceof Response) return q
  try {
    // La versión se lee primero: si alguien guarda mientras se arma la respuesta, el siguiente sondeo lo trae
    const v = await versionActual()
    const [contactos, actividad, config] = await Promise.all([
      leerContactos(),
      leerActividad(q, { ultimas: q.rol === 'admin' ? 120 : 60 }),
      leerConfig(),
    ])
    return Response.json(
      {
        yo: { rol: q.rol, nombre: q.nombre },
        v,
        generado: config.generado,
        fuente: config.fuente,
        contactos: contactos.filter((c) => puedeVer(q, c)),
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
