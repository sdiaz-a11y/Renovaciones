import { createClient } from '@supabase/supabase-js'
import { createHash, timingSafeEqual } from 'node:crypto'
import { Buffer } from 'node:buffer'
import {
  enAlcance,
  nombresDe,
  type Actividad,
  type Contacto,
  type Estado,
  type Motivo,
  type Nota,
  type Plantilla,
  type Rol,
  type Usuario,
} from '../src/shared/modelo.js'

// ---------- Base de datos ----------

let cliente: ReturnType<typeof crearCliente> | null = null

function crearCliente() {
  const url = process.env.SUPABASE_URL
  const clave = process.env.SUPABASE_SECRET_KEY
  if (!url || !clave) throw new Error('Faltan SUPABASE_URL y SUPABASE_SECRET_KEY')
  // Clave secreta: solo en el servidor (las tablas no tienen políticas, el navegador no entra directo)
  return createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } })
}

export const db = () => (cliente ??= crearCliente())

/** Devuelve los datos de una consulta de Supabase o lanza su error */
export function okNull<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message)
  return r.data
}

/** Igual, pero la consulta siempre trae datos (listas, filas únicas) */
export const ok = <T>(r: { data: T; error: { message: string } | null }): NonNullable<T> => okNull(r) as NonNullable<T>

// ---------- Acceso ----------

export interface Quien {
  rol: Rol
  nombre: string
  /** id de la cuenta ('maestro' = CODIGO_ADMIN) */
  id: string
  /** nombres normalizados que cuentan como "suyos" */
  nombres: string[]
}

const VENTANA = 10 * 60_000
const MAX_FALLOS = 12

export const normalCodigo = (s: string) => s.replace(/\s+/g, '').toUpperCase()
export const hashCodigo = (codigo: string) => createHash('sha256').update('rcs:' + normalCodigo(codigo)).digest('hex')

function igual(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/**
 * Identifica a quien hace la petición por su código:
 * - CODIGO_ADMIN (variable de entorno) = administrador principal
 * - códigos personales creados desde /admin (guardados como hash)
 * Devuelve una respuesta de error si no hay acceso.
 */
export async function autenticar(req: Request, rolMinimo: Rol = 'usuario'): Promise<Quien | Response> {
  const maestro = process.env.CODIGO_ADMIN
  // Hay datos personales: sin código configurado, nadie entra
  if (!maestro) return Response.json({ error: 'config' }, { status: 503 })
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local'
  const codigo = normalCodigo(req.headers.get('x-codigo') ?? '')

  try {
    // Intentos fallidos por IP (guardados en la base: valen aunque haya muchas instancias)
    const { data: f } = await db().from('intentos').select('n, desde').eq('ip', ip).maybeSingle()
    if (f && f.n >= MAX_FALLOS && Date.now() - Date.parse(f.desde) < VENTANA) {
      return Response.json({ error: 'espera' }, { status: 429 })
    }

    let quien: Quien | null = null
    if (codigo && igual(codigo, normalCodigo(maestro))) {
      const nombre = usuario(req)
      quien = { rol: 'admin', nombre, id: 'maestro', nombres: nombresDe({ nombre, alias: [] }) }
    } else if (codigo.length >= 6) {
      const u = okNull(await db().from('usuarios').select('*').eq('hash', hashCodigo(codigo)).eq('activo', true).maybeSingle())
      if (u) quien = { rol: u.rol as Rol, nombre: u.nombre, id: u.id, nombres: nombresDe({ nombre: u.nombre, alias: u.alias }) }
    }
    if (!quien) {
      await db().rpc('intento_fallido', { p_ip: ip })
      await new Promise((r) => setTimeout(r, 500))
      return Response.json({ error: 'codigo' }, { status: 401 })
    }
    if (rolMinimo === 'admin' && quien.rol !== 'admin') return Response.json({ error: 'solo-admin' }, { status: 403 })
    return quien
  } catch (err) {
    return error(err)
  }
}

/** Nombre que escribe el administrador principal (viene codificado para permitir acentos) */
export function usuario(req: Request): string {
  try {
    const n = decodeURIComponent(req.headers.get('x-usuario') ?? '').trim()
    return n.slice(0, 60) || 'Admin'
  } catch {
    return 'Admin'
  }
}

/** ¿Puede ver este contacto? Admin ve todo; usuario solo lo suyo */
export const puedeVer = (q: Quien, c: Contacto) => q.rol === 'admin' || enAlcance(c, q.nombres)

// ---------- Contactos ----------

const COLUMNAS = '*, notas(id, texto, fecha, hoja, por, estado)'
// La API de Supabase entrega como máximo 1000 filas por consulta
const PAGINA = 1000

interface FilaNota {
  id: number
  texto: string
  fecha: string | null
  hoja: string | null
  por: string | null
  estado: string | null
}

// Fila de la base → Contacto (valores del Excel + lo que cambió el equipo)
// oxlint-disable-next-line no-explicit-any
function aContacto(f: Record<string, any>): Contacto {
  const estado = (f.estado_crm ?? f.estado) as Estado
  const notas = ([...(f.notas ?? [])] as FilaNota[])
    .sort((a, b) => a.id - b.id)
    .map((n): Nota => {
      const x: Nota = { t: n.texto }
      if (n.fecha) x.f = /^\d{4}-\d\d-\d\d \d/.test(n.fecha) ? new Date(n.fecha).toISOString() : n.fecha
      if (n.hoja) x.h = n.hoja
      if (n.por) x.por = n.por
      if (n.estado) x.e = n.estado as Estado
      return x
    })
  const c: Contacto = {
    id: f.id,
    nombre: f.nombre,
    email: f.email,
    wa: f.wa,
    tel: f.tel,
    pais: f.pais,
    region: f.region,
    sede: f.sede,
    hojas: f.hojas ?? [],
    fecha: f.fecha,
    asignado: f.asignado_crm ?? f.asignado,
    contacto: f.contacto_crm ?? f.contacto,
    estado,
    notas,
  }
  if (f.tel_alt) c.telAlt = f.tel_alt
  if (estado === 'no_interesado' && f.motivo) c.motivo = f.motivo as Motivo
  if (f.no_contactar !== null) c.noContactar = f.no_contactar
  if (f.seguimiento) c.seguimiento = f.seguimiento
  if (f.v > 0) {
    c.v = Number(f.v)
    c.at = new Date(f.at).toISOString()
    c.por = f.por
  }
  return c
}

/** Todos los contactos; con `desde`, solo los cambiados después de esa versión */
export async function leerContactos(desde = 0): Promise<Contacto[]> {
  const out: Contacto[] = []
  for (let i = 0; ; i += PAGINA) {
    let q = db()
      .from('contactos')
      .select(COLUMNAS)
      .order('id')
      .range(i, i + PAGINA - 1)
    if (desde > 0) q = q.gt('v', desde)
    const filas = ok(await q)
    out.push(...filas.map(aContacto))
    if (filas.length < PAGINA) return out
  }
}

export async function contactosPorId(ids: string[]): Promise<Contacto[]> {
  return ok(await db().from('contactos').select(COLUMNAS).in('id', ids)).map(aContacto)
}

// ---------- Actividad, configuración y cuentas ----------

/** Versión más reciente (cada cambio deja una fila en actividad con su versión) */
export async function versionActual(): Promise<number> {
  const f = okNull(await db().from('actividad').select('v').order('v', { ascending: false }).limit(1).maybeSingle())
  return Number(f?.v ?? 0)
}

// oxlint-disable-next-line no-explicit-any
const aActividad = (f: Record<string, any>): Actividad => ({
  v: Number(f.v),
  at: new Date(f.at).toISOString(),
  por: f.por,
  id: f.id,
  nombre: f.nombre,
  texto: f.texto,
  ...(f.estado ? { estado: f.estado as Estado } : {}),
})

/** Actividad reciente; con `desde`, la posterior a esa versión. Un usuario solo ve la suya. */
export async function leerActividad(q: Quien, opciones: { ultimas?: number; desde?: number }): Promise<Actividad[]> {
  let c = db().from('actividad').select('*')
  if (q.rol !== 'admin') c = c.eq('por', q.nombre)
  if (opciones.desde !== undefined) {
    return ok(await c.gt('v', opciones.desde).order('v').limit(500)).map(aActividad)
  }
  return ok(await c.order('v', { ascending: false }).limit(opciones.ultimas ?? 120)).map(aActividad).reverse()
}

export interface Config {
  plantillas: Plantilla[] | null
  meta: number | null
  generado: string
  fuente: string
}

export async function leerConfig(): Promise<Config> {
  const f = ok(await db().from('config').select('*').eq('id', true).single())
  return {
    plantillas: (f.plantillas as Plantilla[] | null) ?? null,
    meta: f.meta,
    generado: f.base_generado ?? '',
    fuente: f.base_fuente ?? '',
  }
}

// oxlint-disable-next-line no-explicit-any
export function aUsuario(f: Record<string, any>): Usuario {
  return {
    id: f.id,
    nombre: f.nombre,
    alias: f.alias ?? [],
    rol: f.rol,
    hash: f.hash,
    activo: f.activo,
    creado: new Date(f.creado).toISOString(),
    ...(f.ultimo_acceso ? { ultimoAcceso: new Date(f.ultimo_acceso).toISOString() } : {}),
  }
}

/** Anota en el feed de actividad y sube la versión */
export async function registrar(por: string, texto: string) {
  ok(await db().rpc('crm_actividad', { p_por: por, p_texto: texto }))
}

export const sinCache = { 'Cache-Control': 'no-store' }

export function error(err: unknown) {
  console.error(err)
  return Response.json({ error: (err as Error)?.message ?? 'error' }, { status: 500 })
}
