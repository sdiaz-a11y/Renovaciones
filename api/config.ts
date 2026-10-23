import { LIMITES, type Plantilla } from '../src/shared/modelo.js'
import { autenticar, db, error, leerConfig, ok, registrar, sinCache, versionActual } from './_lib.js'

/** Plantillas de WhatsApp y meta de renovaciones (compartidas por todo el equipo) */
export async function POST(req: Request) {
  const q = await autenticar(req, 'admin')
  if (q instanceof Response) return q
  try {
    const d = ((await req.json().catch(() => null)) ?? {}) as { plantillas?: unknown; meta?: unknown }
    const plantillas = Array.isArray(d.plantillas)
      ? d.plantillas
          .slice(0, LIMITES.plantillas)
          .map((p, i): Plantilla | null => {
            const o = (p ?? {}) as Record<string, unknown>
            const titulo = typeof o.titulo === 'string' ? o.titulo.trim().slice(0, LIMITES.corto) : ''
            const texto = typeof o.texto === 'string' ? o.texto.trim().slice(0, 1000) : ''
            const id = typeof o.id === 'string' && /^[a-z0-9-]{1,24}$/.test(o.id) ? o.id : `p${i}`
            return titulo && texto ? { id, titulo, texto } : null
          })
          .filter((p): p is Plantilla => p !== null)
      : undefined
    const meta = d.meta === null ? null : typeof d.meta === 'number' && d.meta > 0 && d.meta < 100000 ? Math.round(d.meta) : undefined
    if (plantillas === undefined && meta === undefined) return Response.json({ error: 'datos' }, { status: 400 })
    // Primero se guarda la configuración y después se sube la versión, así los demás la reciben en el siguiente sondeo
    ok(await db().from('config').update({ ...(plantillas ? { plantillas } : {}), ...(meta !== undefined ? { meta } : {}) }).eq('id', true))
    await registrar(q.nombre, plantillas ? 'actualizó las plantillas de WhatsApp' : meta ? `fijó la meta en ${meta} renovaciones` : 'quitó la meta')
    const c = await leerConfig()
    return Response.json({ v: await versionActual(), plantillas: c.plantillas ?? undefined, meta: c.meta }, { headers: sinCache })
  } catch (err) {
    return error(err)
  }
}
