import { Buffer } from 'node:buffer'
import { timingSafeEqual } from 'node:crypto'
import { traerContactos } from './_conector.js'
import { autenticar, db, error, ok, registrar, sinCache } from './_lib.js'

/**
 * Trae los contactos del CRM externo y los guarda en Supabase.
 * Solo toca los datos de origen (nombre, teléfono, estado inicial...): lo que el equipo cambió aquí
 * (estado, responsable, notas, seguimientos) no se pisa.
 *
 * Lo llama el cron de Vercel (con CRON_SECRET) o un administrador desde la app.
 */
async function permitido(req: Request) {
  const secreto = process.env.CRON_SECRET
  const auth = req.headers.get('authorization') ?? ''
  if (secreto) {
    const esperado = Buffer.from(`Bearer ${secreto}`)
    const recibido = Buffer.from(auth)
    if (esperado.length === recibido.length && timingSafeEqual(esperado, recibido)) return true
  }
  const q = await autenticar(req, 'admin')
  return q instanceof Response ? q : true
}

const trozos = <T>(lista: T[], n: number) => Array.from({ length: Math.ceil(lista.length / n) }, (_, i) => lista.slice(i * n, i * n + n))

async function sincronizar(req: Request) {
  const acceso = await permitido(req)
  if (acceso instanceof Response) return acceso
  try {
    const contactos = await traerContactos()
    if (!contactos.length) return Response.json({ error: 'vacio' }, { status: 502 })
    const filas = contactos.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      email: c.email,
      wa: c.wa,
      tel: c.tel,
      tel_alt: c.telAlt ?? null,
      pais: c.pais,
      region: c.region,
      sede: c.sede,
      hojas: c.hojas,
      fecha: c.fecha,
      asignado: c.asignado,
      contacto: c.contacto,
      estado: c.estado,
    }))
    for (const lote of trozos(filas, 500)) ok(await db().from('contactos').upsert(lote, { onConflict: 'id' }))
    ok(
      await db()
        .from('config')
        .update({ base_generado: new Date().toISOString(), base_fuente: 'CRM externo' })
        .eq('id', true),
    )
    await registrar('Sistema', `sincronizó ${filas.length} contactos con el CRM externo`)
    return Response.json({ ok: true, contactos: filas.length }, { headers: sinCache })
  } catch (err) {
    if ((err as Error).message === 'sin-conector') return Response.json({ error: 'sin-conector' }, { status: 503 })
    return error(err)
  }
}

export { sincronizar as GET, sincronizar as POST }
