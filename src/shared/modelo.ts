// Modelo compartido entre el navegador (src/) y las funciones (api/).

export type Estado =
  | 'pendiente'
  | 'sin_respuesta'
  | 'contactado'
  | 'interesado'
  | 'renovado'
  | 'no_interesado'
  | 'invalido'

export interface EstadoInfo {
  id: Estado
  label: string
  /** Para qué sirve el estado, en una línea */
  ayuda: string
  /** Color de la serie en gráficas y del punto en los chips (validado con dataviz) */
  color: string
}

/** Orden del pipeline: también es el orden de las barras apiladas */
export const ESTADOS: EstadoInfo[] = [
  { id: 'renovado', label: 'Renovado', ayuda: 'Ya renovó o compró otro programa', color: '#1baf7a' },
  { id: 'interesado', label: 'Interesado', ayuda: 'Quiere renovar: darle seguimiento', color: '#eb6834' },
  { id: 'contactado', label: 'Contactado', ayuda: 'Se le escribió o llamó; conversación abierta', color: '#2a78d6' },
  { id: 'sin_respuesta', label: 'Sin respuesta', ayuda: 'No contestó llamada ni WhatsApp', color: '#eda100' },
  { id: 'no_interesado', label: 'No interesado', ayuda: 'Dijo que no quiere renovar', color: '#e34948' },
  { id: 'invalido', label: 'Número inválido', ayuda: 'El número no existe o le faltan dígitos', color: '#4a3aa7' },
  { id: 'pendiente', label: 'Sin contactar', ayuda: 'Nadie lo ha buscado todavía', color: '#b9b2ae' },
]
export const ESTADO = Object.fromEntries(ESTADOS.map((e) => [e.id, e])) as Record<Estado, EstadoInfo>
export const esEstado = (v: unknown): v is Estado => typeof v === 'string' && v in ESTADO

export type Motivo =
  | 'tiempo'
  | 'dinero'
  | 'no_aprovecho'
  | 'no_uso'
  | 'no_le_gusto'
  | 'soporte'
  | 'otros_proyectos'
  | 'pausa'
  | 'salud'
  | 'sin_motivo'
  // ya no se ofrece al registrar un "no me interesa", pero puede haber contactos con este motivo guardado
  | 'reembolso'

export const MOTIVOS: Record<Motivo, string> = {
  tiempo: 'Falta de tiempo',
  dinero: 'Dinero / precio',
  no_aprovecho: 'No vio resultados',
  no_uso: 'No lo usó / se le olvidó',
  no_le_gusto: 'Mala experiencia',
  soporte: 'Problemas con soporte o plataforma',
  otros_proyectos: 'Cambió de prioridades o proyectos',
  pausa: 'Quiere pausar y volver después',
  salud: 'Salud o motivos personales',
  sin_motivo: 'Sin motivo claro',
  reembolso: 'Reembolso o reclamo',
}

/** Los motivos que se ofrecen al registrar un "no le interesa", del más al menos común */
export const MOTIVOS_ELEGIBLES: Motivo[] = [
  'tiempo',
  'dinero',
  'no_aprovecho',
  'no_uso',
  'no_le_gusto',
  'soporte',
  'otros_proyectos',
  'pausa',
  'salud',
  'sin_motivo',
]
export const esMotivo = (v: unknown): v is Motivo => typeof v === 'string' && v in MOTIVOS

export interface Nota {
  /** texto */
  t: string
  /** fecha ISO (día o fecha y hora) */
  f?: string
  /** hoja del Excel de donde viene */
  h?: string
  /** quién la escribió en el CRM */
  por?: string
  /** estado que se registró junto con la nota */
  e?: Estado
}

/**
 * Estado del aviso de renovación al CRM del Club:
 * pendiente = aún no llega · enviada = el Club la tiene y falta que la apruebe · aprobada = ya renovó allá ·
 * fallida = no se pudo enviar · revertida = se envió, pero aquí se quitó "Renovado": hay que avisarle al Club
 */
export type EstadoSolicitud = 'pendiente' | 'enviada' | 'aprobada' | 'fallida' | 'revertida'

export interface SolicitudClub {
  id: string
  estado: EstadoSolicitud
  /** por qué falló (solo fallida) */
  error?: string
  /** fecha ISO en que se creó */
  creada: string
}

export interface Contacto {
  id: string
  nombre: string
  email: string
  /** Número internacional solo con dígitos, listo para wa.me */
  wa: string | null
  tel: string
  telAlt?: string
  pais: string
  region: string
  sede: string
  hojas: string[]
  /** Fecha registrada en el Excel (YYYY-MM-DD) */
  fecha: string | null
  asignado: string
  contacto: string
  estado: Estado
  motivo?: Motivo
  noContactar?: boolean
  notas: Nota[]
  /** Próximo seguimiento (YYYY-MM-DD) */
  seguimiento?: string | null
  /** Versión del último cambio hecho en el CRM */
  v?: number
  /** Fecha y autor del último cambio en el CRM */
  at?: string
  por?: string
  /** Último aviso de renovación enviado al CRM del Club */
  solicitud?: SolicitudClub
}

export interface Base {
  generado: string
  fuente: string
  contactos: Contacto[]
}

/** Lo que el CRM sobreescribe de un contacto del Excel */
export interface Cambio {
  v: number
  at: string
  por: string
  estado?: Estado
  asignado?: string
  contacto?: string
  seguimiento?: string | null
  motivo?: Motivo | null
  noContactar?: boolean
  notas?: Nota[]
}

export interface Actividad {
  v: number
  at: string
  por: string
  id: string
  nombre: string
  texto: string
  estado?: Estado
}

export interface Plantilla {
  id: string
  titulo: string
  texto: string
}

export type Rol = 'admin' | 'usuario'

/** Cuenta de una persona del equipo (el código se guarda solo como hash) */
export interface Usuario {
  id: string
  nombre: string
  /** Cómo aparece en el Excel (columnas ASIGNADO A / CONTACTÓ), p. ej. "MD" */
  alias: string[]
  rol: Rol
  hash: string
  activo: boolean
  creado: string
  ultimoAcceso?: string
  /** Foto de perfil (data URL JPEG); solo viaja en la lista de cuentas del administrador */
  foto?: string
}

/** Lo que el navegador sí puede ver de una cuenta */
export type UsuarioPublico = Omit<Usuario, 'hash'>

/** Todo lo que el equipo cambia vive en un solo archivo (crm/registro.json) */
export interface Registro {
  v: number
  cambios: Record<string, Cambio>
  nuevos: Record<string, Contacto>
  actividad: Actividad[]
  plantillas?: Plantilla[]
  meta?: number | null
  usuarios?: Usuario[]
}

const clave = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

/** Nombres con los que una persona aparece como responsable */
export const nombresDe = (u: Pick<Usuario, 'nombre' | 'alias'>) => [...new Set([u.nombre, ...u.alias].map(clave).filter(Boolean))]

/** ¿Este contacto le toca a la persona? (asignado a ella o ella lo contactó) */
export function enAlcance(c: Pick<Contacto, 'asignado' | 'contacto'>, nombres: string[]) {
  return nombres.includes(clave(c.asignado)) || nombres.includes(clave(c.contacto))
}

export const PLANTILLAS_INICIALES: Plantilla[] = [
  {
    id: 'primer',
    titulo: 'Primer contacto',
    texto:
      'Hola {nombre} 👋, soy {yo} del Club Sinergético 🐝. Vi que tu membresía ya venció y quería saber cómo te fue en el club. ¿Tienes 5 minutos para platicar? Tenemos opciones para que regreses.',
  },
  {
    id: 'seguimiento',
    titulo: 'Seguimiento',
    texto:
      'Hola {nombre}, ¿cómo estás? Te escribo otra vez del Club Sinergético. ¿Pudiste ver mi mensaje anterior? Me encantaría contarte lo nuevo que tenemos este año.',
  },
  {
    id: 'interesado',
    titulo: 'Le interesa renovar',
    texto:
      '¡Qué gusto, {nombre}! 🙌 Te comparto la información para renovar tu membresía del Club Sinergético. Cualquier duda aquí estoy para ayudarte.',
  },
  {
    id: 'ultimo',
    titulo: 'Último intento',
    texto:
      'Hola {nombre}, no quiero molestarte 🙂. Si por ahora no es buen momento, no hay problema. Cuando quieras regresar al Club Sinergético, aquí estoy para ayudarte.',
  },
]

export const LIMITES = { texto: 600, corto: 60, ids: 1000, actividad: 400, plantillas: 12 }

/** Contacto del Excel + lo que el equipo cambió en el CRM */
export function aplicar(base: Contacto, c?: Cambio): Contacto {
  if (!c) return base
  const r: Contacto = { ...base, v: c.v, at: c.at, por: c.por }
  if (c.estado) r.estado = c.estado
  if (c.asignado !== undefined) r.asignado = c.asignado
  if (c.contacto !== undefined) r.contacto = c.contacto
  if (c.seguimiento !== undefined) r.seguimiento = c.seguimiento
  if (c.motivo !== undefined) r.motivo = c.motivo ?? undefined
  if (c.noContactar !== undefined) r.noContactar = c.noContactar
  if (c.notas?.length) r.notas = [...base.notas, ...c.notas]
  if (r.estado !== 'no_interesado') delete r.motivo
  return r
}

/** Una edición pedida desde el navegador */
export interface Edicion {
  estado?: Estado
  asignado?: string
  contacto?: string
  seguimiento?: string | null
  motivo?: Motivo | null
  noContactar?: boolean
  nota?: string
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined)
const esDia = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)

export function limpiarEdicion(raw: unknown): Edicion | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const e: Edicion = {}
  if (esEstado(r.estado)) e.estado = r.estado
  const asignado = str(r.asignado, LIMITES.corto)
  if (asignado !== undefined) e.asignado = asignado
  const contacto = str(r.contacto, LIMITES.corto)
  if (contacto !== undefined) e.contacto = contacto
  if (r.seguimiento === null || esDia(r.seguimiento)) e.seguimiento = r.seguimiento as string | null
  if (r.motivo === null || esMotivo(r.motivo)) e.motivo = r.motivo as Motivo | null
  if (typeof r.noContactar === 'boolean') e.noContactar = r.noContactar
  const nota = str(r.nota, LIMITES.texto)
  if (nota) e.nota = nota
  return Object.keys(e).length ? e : null
}

/** Describe una edición en una línea para el feed de actividad */
export function describir(e: Edicion): string {
  const partes: string[] = []
  if (e.estado) partes.push(`→ ${ESTADO[e.estado].label}`)
  if (e.motivo) partes.push(`(${MOTIVOS[e.motivo]})`)
  if (e.asignado !== undefined) partes.push(e.asignado ? `asignado a ${e.asignado}` : 'sin asignar')
  if (e.seguimiento) partes.push(`seguimiento ${e.seguimiento}`)
  if (e.noContactar !== undefined) partes.push(e.noContactar ? 'marcado como NO CONTACTAR' : 'se puede contactar')
  if (e.nota) partes.push(`“${e.nota.length > 90 ? e.nota.slice(0, 90) + '…' : e.nota}”`)
  return partes.join(' · ')
}

const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const diaCorto = (iso: string) => {
  const [, m, d] = iso.split('-').map(Number)
  return m && d ? `${d} ${MES_CORTO[m - 1]}` : iso
}

/**
 * Los cambios de una edición que se anotan en la línea de tiempo del contacto como una entrada propia
 * (la nota y el cambio de estado ya tienen la suya). Vacío si no hay nada que anotar.
 */
export function describirDetalle(e: Edicion): string {
  const partes: string[] = []
  if (e.motivo && !e.estado) partes.push(`motivo: ${MOTIVOS[e.motivo]}`)
  if (e.asignado !== undefined) partes.push(e.asignado ? `asignado a ${e.asignado}` : 'sin responsable')
  if (e.seguimiento) partes.push(`próximo seguimiento: ${diaCorto(e.seguimiento)}`)
  else if (e.seguimiento === null && !e.estado) partes.push('seguimiento quitado')
  if (e.noContactar !== undefined) partes.push(e.noContactar ? 'marcado como NO CONTACTAR' : 'se puede volver a contactar')
  const t = partes.join(' · ')
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : ''
}

/** Aplica una edición sobre el cambio acumulado de un contacto */
export function acumular(prev: Cambio | undefined, e: Edicion, v: number, at: string, por: string): Cambio {
  const c: Cambio = { ...prev, v, at, por }
  if (e.estado) c.estado = e.estado
  if (e.asignado !== undefined) c.asignado = e.asignado
  if (e.contacto !== undefined) c.contacto = e.contacto
  if (e.seguimiento !== undefined) c.seguimiento = e.seguimiento
  if (e.motivo !== undefined) c.motivo = e.motivo
  if (e.noContactar !== undefined) c.noContactar = e.noContactar
  // La línea de tiempo registra notas y cambios de estado (una nota vacía = solo el cambio de estado)
  if (e.nota || e.estado) {
    c.notas = [...(c.notas ?? []), { t: e.nota ?? '', f: at, por, ...(e.estado ? { e: e.estado } : {}) }]
  }
  return c
}

/** Número a formato de WhatsApp (solo dígitos con lada internacional) */
export function aWhatsapp(lada: string, numero: string): string | null {
  const cc = lada.replace(/\D/g, '')
  let d = numero.replace(/\D/g, '')
  if (!cc || !d) return null
  if (d.startsWith(cc) && d.length > 10) d = d.slice(cc.length)
  if (cc === '52' && d.length === 11 && d.startsWith('1')) d = d.slice(1)
  if ((cc === '1' || cc === '52') && d.length !== 10) return null
  if (d.length < 7 || d.length > 12) return null
  return cc + d
}
