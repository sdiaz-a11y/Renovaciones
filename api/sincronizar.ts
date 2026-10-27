import { Buffer } from 'node:buffer'
import { timingSafeEqual } from 'node:crypto'
import { enviadas, marcarAprobada, reenviarPendientes } from './_acceso.js'
import { traerPagina, type Inactivo } from './_conector.js'
import { autenticar, db, error, ok, okNull, registrar, sinCache } from './_lib.js'

/**
 * Trae del CRM del Club a los clientes sin acceso y los guarda en Supabase.
 * Solo toca los datos de origen (nombre, teléfono, fecha de vencimiento...): lo que el equipo cambió aquí
 * (estado, responsable, notas, seguimientos) no se pisa. Las notas del Club se copian una sola vez,
 * cuando el contacto llega por primera vez.
 *
 * El Club tiene decenas de páginas de 500 y cada una tarda ~15 s, así que no cabe en una sola ejecución:
 * cada llamada avanza por páginas hasta agotar su tiempo y deja anotado en `config` dónde se quedó
 * (sync_pagina). Una vuelta completa se llama "ciclo": cada contacto visto se marca con el ciclo
 * (contactos.sync_ciclo) y, al terminar, los avisos de renovación enviados cuyo cliente ya no apareció
 * se dan por aprobados. El cron llama cada 10 min, pero un ciclo nuevo solo empieza una hora después de
 * terminar el anterior; un administrador puede empezar uno cuando quiera.
 *
 * También reenvía los avisos de renovación que no llegaron.
 */
// maxDuration es 300 s y una página puede tardar hasta 100 s: no se empieza otra después de este tiempo
const PRESUPUESTO_MS = 160_000
// Una sola sincronización a la vez (cada Run o cron extra le suma carga al Club); el candado caduca por si una se cae
const CANDADO_MS = 6 * 60_000
const DESCANSO_MS = 60 * 60_000

async function permitido(req: Request): Promise<'cron' | 'admin' | Response> {
  const secreto = process.env.CRON_SECRET
  const auth = req.headers.get('authorization') ?? ''
  if (secreto) {
    const esperado = Buffer.from(`Bearer ${secreto}`)
    const recibido = Buffer.from(auth)
    if (esperado.length === recibido.length && timingSafeEqual(esperado, recibido)) return 'cron'
  }
  const q = await autenticar(req, 'admin')
  return q instanceof Response ? q : 'admin'
}

/**
 * Columnas que son trabajo del equipo (o control interno): la sincronización NUNCA las escribe.
 * El upsert solo actualiza las columnas que trae el objeto; este seguro hace fallar la sincronización
 * si alguien las añade por error, antes de que se pise algo.
 */
const PROTEGIDAS = ['estado', 'contacto', 'estado_crm', 'asignado_crm', 'contacto_crm', 'motivo', 'no_contactar', 'seguimiento', 'nuevo', 'v', 'at', 'por']

const trozos = <T>(lista: T[], n: number) => Array.from({ length: Math.ceil(lista.length / n) }, (_, i) => lista.slice(i * n, i * n + n))

/** Guarda una página de clientes (datos de origen) y copia las notas del Club de los que llegan por primera vez */
async function guardarPagina(clientes: Inactivo[], ciclo: string | null) {
  const conocidos = new Set<string>()
  for (const lote of trozos(clientes, 200)) {
    for (const f of ok(await db().from('contactos').select('id').in('id', lote.map((i) => i.contacto.id)))) conocidos.add(f.id)
  }
  const filas = clientes.map(({ contacto: c, extId }) => ({
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
    // la marca del ciclo solo la pone la sincronización completa
    ...(ciclo ? { sync_ciclo: ciclo } : {}),
  }))
  const pisadas = PROTEGIDAS.filter((k) => filas.some((f) => k in f))
  if (pisadas.length) throw new Error(`La sincronización intentó escribir columnas del equipo: ${pisadas.join(', ')}`)
  for (const lote of trozos(filas, 500)) ok(await db().from('contactos').upsert(lote, { onConflict: 'id' }))
  const notas = clientes
    .filter((i) => !conocidos.has(i.contacto.id))
    .flatMap((i) =>
      i.notas.map((n) => ({ contacto_id: i.contacto.id, texto: n.t, fecha: n.f ?? null, hoja: n.h ?? null, por: n.por ?? null, origen: 'crm' })),
    )
  for (const lote of trozos(notas, 500)) ok(await db().from('notas').insert(lote))
  return { contactos: filas.length, nuevos: filas.length - conocidos.size }
}

// El Club entrega los inactivos del vencimiento más reciente al más antiguo: los que acaban de caer están en las primeras páginas
const MAX_RAPIDA = 8
const LIMPIAS_PARA_PARAR = 2

/**
 * Sincronización rápida (botón de la app): solo las primeras páginas, hasta encontrar ${LIMPIAS_PARA_PARAR} seguidas sin nadie nuevo.
 * No toca el ciclo completo ni detecta aprobaciones: eso lo hace el ciclo completo del cron.
 */
async function rapida(inicio: number) {
  let contactos = 0
  let nuevos = 0
  let paginas = 0
  let limpias = 0
  for (let pagina = 1; pagina <= MAX_RAPIDA && Date.now() - inicio < PRESUPUESTO_MS; pagina++) {
    const { clientes, hayMas } = await traerPagina(pagina)
    if (!clientes.length && pagina === 1) throw new Error('vacio')
    const r = await guardarPagina(clientes, null)
    contactos += r.contactos
    nuevos += r.nuevos
    paginas++
    limpias = r.nuevos === 0 ? limpias + 1 : 0
    if (!hayMas || limpias >= LIMPIAS_PARA_PARAR) break
  }
  ok(await db().from('config').update({ base_generado: new Date().toISOString(), base_fuente: 'CRM del Club' }).eq('id', true))
  if (nuevos) await registrar('Sistema', `trajo ${nuevos} clientes nuevos del CRM del Club`)
  return { contactos, nuevos, paginas }
}

async function sincronizar(req: Request) {
  const quien = await permitido(req)
  if (quien instanceof Response) return quien
  const inicio = Date.now()
  const candado = await db()
    .from('config')
    .update({ sync_bloqueo: new Date(inicio).toISOString() })
    .eq('id', true)
    .or(`sync_bloqueo.is.null,sync_bloqueo.lt.${new Date(inicio - CANDADO_MS).toISOString()}`)
    .select('id')
  if (candado.error) return error(new Error(candado.error.message))
  if (!candado.data.length) return Response.json({ ok: true, ocupado: true }, { headers: sinCache })
  try {
    const reenviadas = await reenviarPendientes()

    if (new URL(req.url).searchParams.get('rapido') === '1') {
      return Response.json({ ok: true, rapido: true, completo: true, ...(await rapida(inicio)), reenviadas }, { headers: sinCache })
    }

    const cfg = ok(await db().from('config').select('sync_pagina, sync_ciclo, sync_fin').eq('id', true).single())
    let ciclo: string | null = cfg.sync_ciclo
    let pagina: number = cfg.sync_pagina ?? 1
    if (!ciclo) {
      // Sin ciclo en curso: el cron espera una hora desde el último; un administrador empieza ya
      if (quien === 'cron' && cfg.sync_fin && inicio - Date.parse(cfg.sync_fin) < DESCANSO_MS) {
        return Response.json({ ok: true, descanso: true, reenviadas }, { headers: sinCache })
      }
      ciclo = new Date(inicio).toISOString()
      pagina = 1
      ok(await db().from('config').update({ sync_ciclo: ciclo, sync_pagina: 1 }).eq('id', true))
    }

    let contactos = 0
    let nuevos = 0
    let completo = false
    while (Date.now() - inicio < PRESUPUESTO_MS) {
      const { clientes, hayMas } = await traerPagina(pagina)
      // Una primera página vacía casi seguro es un fallo del otro lado: no se toca nada
      if (!clientes.length && pagina === 1) return Response.json({ error: 'vacio' }, { status: 502 })

      const r = await guardarPagina(clientes, ciclo)
      contactos += r.contactos
      nuevos += r.nuevos
      pagina++
      ok(await db().from('config').update({ sync_pagina: pagina }).eq('id', true))
      if (!hayMas) {
        completo = true
        break
      }
    }

    let aprobadas = 0
    if (completo) {
      // Aprobadas: el Club ya les dio acceso, así que dejaron de aparecer entre los inactivos
      const abiertas = await enviadas()
      const vistos = new Map<string, { sync_ciclo: string | null; nombre: string }>()
      for (const lote of trozos(abiertas, 200)) {
        for (const f of ok(await db().from('contactos').select('id, nombre, sync_ciclo').in('id', lote.map((s) => s.contacto_id)))) vistos.set(f.id, f)
      }
      for (const s of abiertas) {
        const c = vistos.get(s.contacto_id)
        if (!c || c.sync_ciclo === ciclo) continue
        await marcarAprobada(s.id)
        ok(
          await db().rpc('crm_editar', {
            p_ids: [s.contacto_id],
            p_ed: {
              nota: s.estado === 'revertida' ? 'El CRM del Club aprobó la renovación, aunque aquí se había quitado "Renovado". Revisar.' : 'El CRM del Club aprobó la renovación.',
            },
            p_por: 'Sistema',
            p_texto: s.estado === 'revertida' ? 'renovación aprobada por el CRM del Club (estaba revertida aquí)' : 'renovación aprobada por el CRM del Club',
            p_nombre: c.nombre,
            p_estado: null,
          }),
        )
        aprobadas++
      }
      okNull(
        await db()
          .from('config')
          .update({ sync_ciclo: null, sync_pagina: 1, sync_fin: new Date().toISOString(), base_generado: new Date().toISOString(), base_fuente: 'CRM del Club' })
          .eq('id', true),
      )
      await registrar('Sistema', `terminó de sincronizar con el CRM del Club (${aprobadas} renovaciones aprobadas)`)
    }
    return Response.json({ ok: true, completo, siguientePagina: completo ? null : pagina, contactos, nuevos, aprobadas, reenviadas }, { headers: sinCache })
  } catch (err) {
    if ((err as Error).message === 'vacio') return Response.json({ error: 'vacio' }, { status: 502 })
    if ((err as Error).message === 'sin-conector') return Response.json({ error: 'sin-conector' }, { status: 503 })
    return error(err)
  } finally {
    await db().from('config').update({ sync_bloqueo: null }).eq('id', true)
  }
}

export { sincronizar as GET, sincronizar as POST }
