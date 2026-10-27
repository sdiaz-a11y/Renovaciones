import type { Actividad, Contacto, Edicion, Plantilla, Rol, UsuarioPublico } from '../shared/modelo'

// ---------- Sesión (código del equipo + nombre) ----------

export interface Sesion {
  codigo: string
  nombre: string
  rol: Rol
}

const CLAVE = 'rcs_sesion_v1'
let memoria: Sesion | null = null

export function leerSesion(): Sesion | null {
  try {
    const s = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as Sesion | null
    if (s?.codigo) return s
  } catch {
    /* almacenamiento bloqueado */
  }
  return memoria
}

export function guardarSesion(s: Sesion | null) {
  memoria = s
  try {
    if (s) localStorage.setItem(CLAVE, JSON.stringify(s))
    else localStorage.removeItem(CLAVE)
  } catch {
    /* almacenamiento bloqueado: queda en memoria */
  }
}

// ---------- Peticiones ----------

export class ErrorApi extends Error {
  status: number
  constructor(status: number, mensaje: string) {
    super(mensaje)
    this.status = status
  }
}

const MENSAJES: Record<number, string> = {
  401: 'Código incorrecto',
  403: 'Esta acción es solo para administradores',
  429: 'Demasiados intentos. Espera unos minutos.',
  503: 'El CRM todavía no tiene código de acceso configurado',
}

/** Errores que la API nombra en el cuerpo de la respuesta (pesan más que el mensaje del estado HTTP) */
const ERRORES: Record<string, string> = {
  'sin-conector': 'Falta configurar CRM_API_URL y CRM_API_KEY en Vercel (y redesplegar)',
  vacio: 'El CRM del Club devolvió una lista vacía; no se cambió nada',
  confirmar: 'Falta confirmar la renovación',
}

async function pedir<T>(ruta: string, sesion: Sesion, body?: unknown): Promise<T> {
  const res = await fetch(ruta, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'x-codigo': sesion.codigo,
      'x-usuario': encodeURIComponent(sesion.nombre || ''),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new ErrorApi(res.status, (data.error && ERRORES[data.error]) ?? MENSAJES[res.status] ?? data.error ?? `Error ${res.status}`)
  }
  return (await res.json()) as T
}

export interface Carga {
  yo: { rol: Rol; nombre: string }
  v: number
  generado: string
  fuente: string
  contactos: Contacto[]
  actividad: Actividad[]
  plantillas: Plantilla[]
  meta: number | null
}

export interface Delta {
  v: number
  contactos: Contacto[]
  quitar?: string[]
  actividad: Actividad[]
  plantillas?: Plantilla[]
  meta?: number | null
}

export interface NuevoContacto {
  nombre: string
  lada: string
  telefono: string
  email: string
  sede: string
  asignado: string
  nota: string
  pais?: string
}

export interface RespUsuario {
  usuario: UsuarioPublico
  codigo: string | null
}

/** Una tanda de la sincronización con el CRM del Club (ver api/sincronizar.ts) */
export interface RespSincronizar {
  ok: true
  /** true cuando ya se recorrieron todas las páginas */
  completo?: boolean
  siguientePagina?: number | null
  contactos?: number
  nuevos?: number
  aprobadas?: number
  /** páginas revisadas (modo rápido) */
  paginas?: number
  /** otra sincronización está corriendo */
  ocupado?: boolean
}

export const api = {
  /** `rapido`: solo lo más reciente (1-2 min); sin él, la sincronización completa por tandas */
  sincronizar: (s: Sesion, rapido = false) => pedir<RespSincronizar>(rapido ? '/api/sincronizar?rapido=1' : '/api/sincronizar', s),
  sesion: (s: Pick<Sesion, 'codigo' | 'nombre'>) => pedir<{ rol: Rol; nombre: string }>('/api/sesion', { ...s, rol: 'usuario' }),
  contactos: (s: Sesion) => pedir<Carga>('/api/contactos', s),
  cambios: (s: Sesion, desde: number) => pedir<Delta>(`/api/cambios?desde=${desde}`, s),
  /** `confirmado`: la persona pasó la doble verificación de "Renovado" (el servidor la exige) */
  actualizar: (s: Sesion, ids: string[], edicion: Edicion, confirmado?: boolean) =>
    pedir<{ v: number; contactos: Contacto[]; club?: { revertidas: string[] } }>('/api/actualizar', s, { ids, edicion, ...(confirmado ? { confirmado } : {}) }),
  /** Reenvía el aviso de renovación al Club, o confirma que ya se le avisó a mano que no procede */
  solicitud: (s: Sesion, id: string, accion: 'reenviar' | 'cerrar') => pedir<{ contactos: Contacto[] }>('/api/solicitudes', s, { id, accion }),
  nuevo: (s: Sesion, datos: NuevoContacto) => pedir<{ v: number; contacto: Contacto }>('/api/nuevo', s, datos),
  config: (s: Sesion, datos: { plantillas?: Plantilla[]; meta?: number | null }) =>
    pedir<{ v: number; plantillas?: Plantilla[]; meta: number | null }>('/api/config', s, datos),
  foto: (s: Sesion) => pedir<{ foto: string | null }>('/api/foto', s),
  guardarFoto: (s: Sesion, foto: string | null) => pedir<{ foto: string | null }>('/api/foto', s, { foto }),
  usuarios: (s: Sesion) => pedir<{ usuarios: UsuarioPublico[] }>('/api/usuarios', s),
  usuario: (
    s: Sesion,
    datos:
      | { accion: 'crear'; nombre: string; rol: Rol; alias: string[] }
      | { accion: 'codigo'; id: string }
      | { accion: 'editar'; id: string; nombre?: string; rol?: Rol; alias?: string[]; activo?: boolean },
  ) => pedir<RespUsuario>('/api/usuarios', s, datos),
}
