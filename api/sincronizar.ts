import { Buffer } from 'node:buffer'
import { timingSafeEqual } from 'node:crypto'
import { enviadas, marcarAprobada, reenviarPendientes } from './_acceso.js'
import { traerInactivos } from './_conector.js'
import { autenticar, db, error, ok, registrar, sinCache } from './_lib.js'

/**
 * Trae del CRM del Club a los clientes sin acceso y los guarda en Supabase.
 * Solo toca los datos de origen (nombre, teléfono, fecha de vencimiento...): lo que el equipo cambió aquí
 * (estado, responsable, notas, seguimientos) no se pisa. Las notas del Club se copian una sola vez,
 * cuando el contacto llega por primera vez.
 *
 * También reenvía los avisos de renovación que no llegaron y marca como aprobados los que el Club ya atendió
 * (un cliente con aviso enviado que deja de aparecer entre los inactivos).
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
    const reenviadas = await reenviarPendientes()

    const inactivos = await traerInactivos()
    // Una lista vacía casi seguro es un fallo del otro lado: no se toca nada
    if (!inactivos.length) return Response.json({ error: 'vacio' }, { status: 502 })

    const conocidos = new Set<string>()
    for (const lote of trozos(inactivos, 200)) {
      const filas = ok(await db().from('contactos').select('id').in('id', lote.map((i) => i.contacto.id)))
      for (const f of filas) conocidos.add(f.id)
    }

    const filas = inactivos.map(({ contacto: c, extId }) => ({
      id: c.id,
      ext_id: extId,
      nombre: c.nombre,
      email: c.email,
      wa: c.wa,
      tel: c.tel,
      pais: c.pais,
      region: c.region,
      sede: c.sede,
      hojas: c.hojas,
      fecha: c.fecha,
      asignado: c.asignado,
    }))
    for (const lote of trozos(filas, 500)) ok(await db().from('contactos').upsert(lote, { onConflict: 'id' }))

    const notas = inactivos
      .filter((i) => !conocidos.has(i.contacto.id))
      .flatMap((i) =>
        i.notas.map((n) => ({ contacto_id: i.contacto.id, texto: n.t, fecha: n.f ?? null, hoja: n.h ?? null, por: n.por ?? null, origen: 'crm' })),
      )
    for (const lote of trozos(notas, 500)) ok(await db().from('notas').insert(lote))

    // Aprobadas: el Club ya les dio acceso, así que dejaron de ser inactivos
    const siguenInactivos = new Set(inactivos.map((i) => i.extId))
    let aprobadas = 0
    for (const s of await enviadas()) {
      if (siguenInactivos.has(s.ext_id.toLowerCase())) continue
      await marcarAprobada(s.id)
      ok(
        await db().rpc('crm_editar', {
          p_ids: [s.contacto_id],
          p_ed: { nota: 'El CRM del Club aprobó la renovación.' },
          p_por: 'Sistema',
          p_texto: 'renovación aprobada por el CRM del Club',
          p_nombre: filas.find((f) => f.id === s.contacto_id)?.nombre ?? s.ext_id,
          p_estado: null,
        }),
      )
      aprobadas++
    }

    ok(
      await db()
        .from('config')
        .update({ base_generado: new Date().toISOString(), base_fuente: 'CRM del Club' })
        .eq('id', true),
    )
    const nuevos = filas.length - conocidos.size
    await registrar('Sistema', `sincronizó ${filas.length} contactos con el CRM del Club (${nuevos} nuevos, ${aprobadas} renovaciones aprobadas)`)
    return Response.json({ ok: true, contactos: filas.length, nuevos, aprobadas, reenviadas }, { headers: sinCache })
  } catch (err) {
    if ((err as Error).message === 'sin-conector') return Response.json({ error: 'sin-conector' }, { status: 503 })
    return error(err)
  }
}

export { sincronizar as GET, sincronizar as POST }
