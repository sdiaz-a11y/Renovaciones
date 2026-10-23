// Avisos de renovación hacia el CRM del Club.
//
// POST {CRM_API_URL}/api/externo/renovaciones/solicitud-acceso
//   { solicitud_id, etiqueta: 'renovacion', renovado_por, fecha: 'YYYY-MM-DD', cliente: { id, correo, notas } }
//   200 {ok, id}  creada o ya existía (solicitud_id es idempotente)
//   400 / 404     definitivo: no se reintenta (404 = el Club no conoce a ese cliente)
//   401           clave mal puesta: se reintenta cuando se corrija
//   5xx / red     se reintenta (cada sincronización, hasta MAX_INTENTOS)
// El Club no renueva nada solo: la deja pendiente y un administrador suyo la aprueba.
//
// Ciclo de una solicitud: pendiente → enviada → aprobada. Si aquí se quita "Renovado":
//   pendiente (nunca salió) → cancelada · enviada (el Club ya la tiene) → revertida, y hay que avisarles a mano.
import { configurado, cabecerasClub, urlClub } from './_conector.js'
import { db, ok, okNull } from './_lib.js'

const MAX_INTENTOS = 8
const TABLA = 'solicitudes_renovacion'

interface Solicitud {
  id: string
  contacto_id: string
  ext_id: string
  renovado_por: string
  nota: string | null
  estado: 'pendiente' | 'enviada' | 'aprobada' | 'fallida' | 'cancelada' | 'revertida'
  intentos: number
}

/**
 * Deja una solicitud pendiente por cada contacto que no tenga una abierta. Devuelve las nuevas.
 * Si el contacto tenía una revertida (el Club aún la tiene) se reactiva en vez de crear otra.
 */
export async function crearSolicitudes(contactoIds: string[], por: string, nota?: string): Promise<Solicitud[]> {
  if (!configurado() || !contactoIds.length) return []
  const reactivadas = new Set(
    ok(await db().from(TABLA).update({ estado: 'enviada' }).in('contacto_id', contactoIds).eq('estado', 'revertida').select('contacto_id')).map(
      (f) => f.contacto_id,
    ),
  )
  const filas = ok(await db().from('contactos').select('id, email, ext_id').in('id', contactoIds.filter((id) => !reactivadas.has(id))))
  const nuevas: Solicitud[] = []
  for (const f of filas) {
    const s: Solicitud = {
      id: crypto.randomUUID(),
      contacto_id: f.id,
      ext_id: f.ext_id || f.email || '',
      renovado_por: por,
      nota: nota?.trim() || null,
      estado: 'pendiente',
      intentos: 0,
    }
    const { error } = await db().from(TABLA).insert(s)
    if (!error) nuevas.push(s)
    // 23505 = ya tenía una solicitud abierta: no se duplica
    else if (error.code !== '23505') throw new Error(error.message)
  }
  return nuevas
}

/**
 * Se quitó "Renovado" a estos contactos. Las solicitudes que no habían salido se cancelan;
 * las que el Club ya tiene quedan "revertidas" y se devuelven para avisar a la persona.
 */
export async function revertirSolicitudes(contactoIds: string[]): Promise<{ canceladas: number; revertidas: string[] }> {
  if (!contactoIds.length) return { canceladas: 0, revertidas: [] }
  const canceladas = ok(await db().from(TABLA).update({ estado: 'cancelada' }).in('contacto_id', contactoIds).eq('estado', 'pendiente').select('id'))
  const revertidas = ok(await db().from(TABLA).update({ estado: 'revertida' }).in('contacto_id', contactoIds).eq('estado', 'enviada').select('contacto_id'))
  return { canceladas: canceladas.length, revertidas: revertidas.map((f) => f.contacto_id) }
}

/** Envía una solicitud al CRM del Club y anota el resultado */
export async function enviar(s: Solicitud): Promise<Solicitud['estado']> {
  const { data: c } = await db().from('contactos').select('email').eq('id', s.contacto_id).maybeSingle()
  const correo = c?.email ?? ''
  let estado: Solicitud['estado'] = 'pendiente'
  let detalle: string | null = null
  if (!s.ext_id) {
    estado = 'fallida'
    detalle = 'El contacto no tiene correo ni id del CRM del Club'
  } else {
    try {
      const res = await fetch(urlClub('/api/externo/renovaciones/solicitud-acceso'), {
        method: 'POST',
        headers: { ...cabecerasClub(), 'content-type': 'application/json' },
        body: JSON.stringify({
          solicitud_id: s.id,
          etiqueta: 'renovacion',
          renovado_por: s.renovado_por,
          fecha: new Date().toISOString().slice(0, 10),
          cliente: { id: s.ext_id, correo, notas: s.nota ? [{ texto: s.nota }] : [] },
        }),
        signal: AbortSignal.timeout(20_000),
      })
      if (res.ok) estado = 'enviada'
      else {
        detalle = res.status === 404 ? 'El CRM del Club no encontró a este cliente' : `El CRM del Club respondió ${res.status}`
        // 4xx es definitivo, salvo timeout (408), exceso de peticiones (429) y clave inválida (401)
        if (res.status >= 400 && res.status < 500 && ![401, 408, 429].includes(res.status)) estado = 'fallida'
      }
    } catch (err) {
      detalle = (err as Error).message
    }
  }
  const intentos = s.intentos + 1
  if (estado === 'pendiente' && intentos >= MAX_INTENTOS) estado = 'fallida'
  // Si mientras se enviaba alguien quitó "Renovado" (la solicitud pasó a cancelada), no se pisa ese estado
  ok(
    await db()
      .from(TABLA)
      .update({ estado, intentos, ultimo_error: estado === 'enviada' ? null : detalle, ...(estado === 'enviada' ? { enviada: new Date().toISOString() } : {}) })
      .eq('id', s.id)
      .eq('estado', s.estado),
  )
  return estado
}

/** Reintenta las solicitudes que no han llegado al CRM del Club */
export async function reenviarPendientes(): Promise<number> {
  if (!configurado()) return 0
  const pendientes = ok(await db().from(TABLA).select('*').eq('estado', 'pendiente').order('creada').limit(50)) as Solicitud[]
  let enviadas = 0
  for (const s of pendientes) if ((await enviar(s)) === 'enviada') enviadas++
  return enviadas
}

/** Solicitudes que el Club tiene y esperan aprobación (también las revertidas aquí: si el Club las aprueba, ya renovó allá) */
export async function enviadas(): Promise<Solicitud[]> {
  return ok(await db().from(TABLA).select('*').in('estado', ['enviada', 'revertida'])) as Solicitud[]
}

export const marcarAprobada = async (id: string) => okNull(await db().from(TABLA).update({ estado: 'aprobada' }).eq('id', id))

/** "Ya les avisé": la persona del equipo avisó al Club a mano que esa renovación no procede */
export const cerrarRevertida = async (id: string) => okNull(await db().from(TABLA).update({ estado: 'cancelada' }).eq('id', id).eq('estado', 'revertida'))

export const TABLA_SOLICITUDES = TABLA
export type { Solicitud }
