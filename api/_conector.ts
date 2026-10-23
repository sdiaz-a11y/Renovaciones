// Conector con el CRM externo que entrega los contactos reales.
// Es el único archivo que conoce el formato del otro CRM: si sus campos se llaman distinto, se ajusta aquí.
//
// Variables de entorno:
//   CRM_URL    dirección del endpoint que lista los contactos (GET, JSON)
//   CRM_TOKEN  clave de acceso (se envía como "Authorization: Bearer <clave>")
import { createHash } from 'node:crypto'
import { aWhatsapp, esEstado, type Contacto } from '../src/shared/modelo.js'

type Fila = Record<string, unknown>

/** Primer campo con valor entre varios nombres posibles (por si el CRM usa inglés o español) */
function campo(f: Fila, nombres: string[]): string {
  for (const n of nombres) {
    const v = f[n]
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number') return String(v)
  }
  return ''
}

const NOMBRE = ['nombre', 'name', 'full_name', 'fullName']
const EMAIL = ['email', 'correo', 'mail']
const TELEFONO = ['telefono', 'teléfono', 'phone', 'celular', 'whatsapp', 'mobile']
const LADA = ['lada', 'codigo_pais', 'country_code']
const PAIS = ['pais', 'país', 'country']
const SEDE = ['sede', 'ciudad', 'city', 'branch']
const ASIGNADO = ['asignado', 'asignado_a', 'responsable', 'owner', 'assigned_to']
const ESTADO = ['estado', 'status']
const FECHA = ['fecha', 'fecha_vencimiento', 'vencimiento', 'expires_at', 'created_at']

const REGION: Record<string, string> = { México: 'México', 'Estados Unidos': 'EUA' }

/** Convierte una fila del CRM externo en un contacto de este CRM (null si no sirve para contactar) */
export function aContactoBase(f: Fila): Contacto | null {
  const email = campo(f, EMAIL).toLowerCase()
  const bruto = campo(f, TELEFONO)
  // Con "+" el número ya trae su lada; si no, se usa la columna de lada
  const wa = bruto.startsWith('+') ? bruto.replace(/\D/g, '') || null : aWhatsapp(campo(f, LADA), bruto)
  const nombre = campo(f, NOMBRE) || email
  if (!nombre || (!email && !wa)) return null
  // El id sale del email (o del teléfono), igual que en scripts/importar.py: así no cambia entre sincronizaciones
  const id = createHash('sha1').update(email || `tel:${wa}`).digest('hex').slice(0, 12)
  const pais = campo(f, PAIS) || (wa?.startsWith('52') ? 'México' : wa?.startsWith('1') ? 'Estados Unidos' : 'Otro')
  const estado = campo(f, ESTADO).toLowerCase().replace(/\s+/g, '_')
  const fecha = campo(f, FECHA).slice(0, 10)
  return {
    id,
    nombre,
    email,
    wa,
    tel: wa ? '+' + wa : '',
    pais,
    region: REGION[pais] ?? 'LATAM y otros',
    sede: campo(f, SEDE),
    hojas: ['CRM externo'],
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : null,
    asignado: campo(f, ASIGNADO),
    contacto: '',
    estado: esEstado(estado) ? estado : 'pendiente',
    notas: [],
  }
}

/** Descarga todos los contactos del CRM externo (sigue el enlace "next" si la respuesta viene paginada) */
export async function traerContactos(): Promise<Contacto[]> {
  const inicio = process.env.CRM_URL
  if (!inicio) throw new Error('sin-conector')
  const headers: Record<string, string> = { accept: 'application/json' }
  if (process.env.CRM_TOKEN) headers.authorization = `Bearer ${process.env.CRM_TOKEN}`

  const porId = new Map<string, Contacto>()
  let url: string | null = inicio
  for (let pagina = 0; url && pagina < 200; pagina++) {
    const res: Response = await fetch(url, { headers })
    if (!res.ok) throw new Error(`El CRM externo respondió ${res.status}`)
    const cuerpo = (await res.json()) as unknown
    const o = (cuerpo && typeof cuerpo === 'object' ? cuerpo : {}) as Record<string, unknown>
    const filas = Array.isArray(cuerpo) ? cuerpo : [o.contactos, o.data, o.results, o.items].find(Array.isArray)
    if (!Array.isArray(filas)) throw new Error('No encuentro la lista de contactos en la respuesta del CRM externo')
    for (const f of filas as Fila[]) {
      const c = aContactoBase(f)
      if (c) porId.set(c.id, c)
    }
    url = typeof o.next === 'string' && o.next ? new URL(o.next, url).toString() : null
  }
  return [...porId.values()]
}
