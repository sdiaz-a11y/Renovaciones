// Conector con el CRM del Club (https://soporte.sinergeticos.com): de ahí vienen los clientes sin acceso.
// Es el único archivo que conoce el formato de sus respuestas.
//
// Variables de entorno:
//   CRM_API_URL  dirección base del CRM del Club
//   CRM_API_KEY  su RENOVACIONES_API_TOKEN (se envía como "Authorization: Bearer <clave>")
//
// GET {CRM_API_URL}/api/externo/renovaciones/inactivos?pagina=1
//   → { clientes: [{ id, nombre, correo, telefono, pais, ciudad, evento, fecha_inscripcion, fin_acceso,
//                    asignado (siempre null), notas: [{ texto, fecha, autor }] }], siguiente: url | null }
//   Páginas de 500; sin "siguiente" es la última. Los REVOCADOS nunca vienen. `id` es el correo normalizado.
import { createHash } from 'node:crypto'
import type { Contacto, Nota } from '../src/shared/modelo.js'

export const configurado = () => Boolean(process.env.CRM_API_URL && process.env.CRM_API_KEY)

export const urlClub = (ruta: string) => new URL(ruta, process.env.CRM_API_URL).toString()

export const cabecerasClub = () => ({ accept: 'application/json', authorization: `Bearer ${process.env.CRM_API_KEY}` })

type Fila = Record<string, unknown>

const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
const dia = (v: unknown) => {
  const d = texto(v).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null
}

const REGION: Record<string, string> = { México: 'México', 'Estados Unidos': 'EUA' }

export interface Inactivo {
  contacto: Contacto
  /** id del cliente en el CRM del Club */
  extId: string
  notas: Nota[]
}

/** Convierte un cliente del CRM del Club en un contacto de este CRM (null si no hay forma de contactarlo) */
export function aInactivo(f: Fila): Inactivo | null {
  const email = texto(f.correo).toLowerCase()
  const bruto = texto(f.telefono)
  // Con "+" el número ya trae su lada
  const wa = bruto.startsWith('+') ? bruto.replace(/\D/g, '') || null : null
  const extId = texto(f.id).toLowerCase() || email
  const nombre = texto(f.nombre) || email
  if (!extId || !nombre || (!email && !wa)) return null
  // El id sale del email (o del teléfono), igual que en scripts/importar.py: así no cambia entre sincronizaciones
  const id = createHash('sha1').update(email || `tel:${wa}`).digest('hex').slice(0, 12)
  const pais = texto(f.pais) || (wa?.startsWith('52') ? 'México' : wa?.startsWith('1') ? 'Estados Unidos' : 'Otro')
  const notas = (Array.isArray(f.notas) ? (f.notas as Fila[]) : [])
    .map((n): Nota => ({ t: texto(n.texto), f: texto(n.fecha) || undefined, por: texto(n.autor) || undefined, h: 'CRM Club' }))
    .filter((n) => n.t)
  const evento = texto(f.evento)
  return {
    extId,
    notas,
    contacto: {
      id,
      nombre,
      email,
      wa,
      tel: wa ? '+' + wa : bruto,
      pais,
      region: REGION[pais] ?? 'LATAM y otros',
      sede: texto(f.ciudad),
      hojas: evento ? [evento] : ['CRM Club'],
      // la fecha que importa es cuándo se les acabó el acceso
      fecha: dia(f.fin_acceso) ?? dia(f.fecha_inscripcion),
      asignado: texto(f.asignado),
      contacto: '',
      estado: 'pendiente',
      notas: [],
    },
  }
}

/** Descarga todos los clientes inactivos (sigue "siguiente" mientras haya más páginas) */
export async function traerInactivos(): Promise<Inactivo[]> {
  if (!configurado()) throw new Error('sin-conector')
  const porId = new Map<string, Inactivo>()
  let url: string | null = urlClub('/api/externo/renovaciones/inactivos?pagina=1')
  for (let pagina = 0; url && pagina < 200; pagina++) {
    const res: Response = await fetch(url, { headers: cabecerasClub(), signal: AbortSignal.timeout(20_000) })
    if (!res.ok) throw new Error(`El CRM del Club respondió ${res.status}`)
    const cuerpo = (await res.json()) as { clientes?: unknown; siguiente?: unknown } | null
    if (!Array.isArray(cuerpo?.clientes)) throw new Error('No encuentro "clientes" en la respuesta del CRM del Club')
    for (const f of cuerpo.clientes as Fila[]) {
      const c = aInactivo(f)
      if (c) porId.set(c.contacto.id, c)
    }
    url = typeof cuerpo.siguiente === 'string' && cuerpo.siguiente ? new URL(cuerpo.siguiente, url).toString() : null
  }
  return [...porId.values()]
}
