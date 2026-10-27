import { ESTADO, MOTIVOS, type Contacto } from '../shared/modelo'

const fmt = new Intl.NumberFormat('es-MX')
export const num = (n: number) => fmt.format(n)
export const pct = (n: number, d: number, dec = 1) => (d ? `${((n / d) * 100).toFixed(dec).replace(/\.0$/, '')}%` : '0%')

export function normalizar(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/** Fecha local de hoy en formato YYYY-MM-DD */
export function hoy(dias = 0) {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Orden por vencimiento: los que se les acabó hace poco arriba y los de hace mucho al final.
 * Las fechas futuras (el Club trae ~10% de inactivos con fin de acceso por venir) y las vacías van hasta abajo.
 */
export function porVencimiento(a: { fecha: string | null }, b: { fecha: string | null }) {
  const h = hoy()
  const grupo = (f: string | null) => (!f ? 2 : f > h ? 1 : 0)
  const ga = grupo(a.fecha)
  const gb = grupo(b.fecha)
  if (ga !== gb) return ga - gb
  if (ga === 0) return b.fecha!.localeCompare(a.fecha!)
  if (ga === 1) return a.fecha!.localeCompare(b.fecha!)
  return 0
}

/** "Venció 12 ago" / "Vence 3 mar 2027" */
export const textoVencimiento = (fecha: string | null) => (fecha ? `${fecha > hoy() ? "Vence" : "Venció"} ${fechaCorta(fecha)}` : "")

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function fechaCorta(iso?: string | null) {
  if (!iso) return ''
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!a || !m || !d) return ''
  const esteAno = new Date().getFullYear() === a
  return `${d} ${MESES[m - 1]}${esteAno ? '' : ` ${a}`}`
}

export function haceCuanto(iso?: string) {
  if (!iso) return ''
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 45) return 'hace un momento'
  const m = Math.round(s / 60)
  if (m < 60) return `hace ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  if (d < 7) return `hace ${d} ${d === 1 ? 'día' : 'días'}`
  return fechaCorta(iso)
}

/** "vence" relativo para seguimientos */
export function cuandoSeguimiento(dia: string) {
  const h = hoy()
  if (dia === h) return 'Hoy'
  if (dia === hoy(1)) return 'Mañana'
  if (dia === hoy(-1)) return 'Ayer'
  return fechaCorta(dia)
}

export function iniciales(nombre: string) {
  const p = nombre.replace(/[^\p{L}\s]/gu, '').trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : (p[0]?.[1] ?? ''))).toUpperCase() || '?'
}

export function primerNombre(nombre: string) {
  const n = nombre.trim().split(/\s+/)[0] ?? ''
  return n ? n[0].toUpperCase() + n.slice(1).toLowerCase() : ''
}

export function rellenar(texto: string, c: Pick<Contacto, 'nombre'>, yo: string) {
  return texto.replaceAll('{nombre}', primerNombre(c.nombre)).replaceAll('{yo}', primerNombre(yo) || yo)
}

export function linkWhatsapp(wa: string, texto?: string) {
  return `https://wa.me/${wa}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`
}

/** Texto para buscar rápido (nombre, email, teléfono y país) */
export function claveBusqueda(c: Contacto) {
  return normalizar(`${c.nombre} ${c.email} ${c.pais}`) + ' ' + (c.wa ?? '') + ' ' + c.tel.replace(/\D/g, '')
}

/** Mezcla estable por persona: dos personas del equipo no reciben la misma cola en el mismo orden */
export function semilla(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export function ordenEstable(id: string, seed: number) {
  return semilla(id + ':' + seed)
}

export function descargarCSV(contactos: Contacto[], nombre: string) {
  const col = [
    'Nombre', 'Email', 'Teléfono', 'WhatsApp', 'País', 'Región', 'Sede', 'Estado', 'Motivo', 'Asignado a',
    'Contactó', 'Próximo seguimiento', 'Fecha registro', 'Última nota', 'No contactar', 'Actualizado por', 'Actualizado',
  ]
  const esc = (v: unknown) => {
    const s = String(v ?? '')
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const filas = contactos.map((c) => {
    const ultima = [...c.notas].reverse().find((n) => n.t)
    return [
      c.nombre, c.email, c.tel, c.wa ? linkWhatsapp(c.wa) : '', c.pais, c.region, c.sede, ESTADO[c.estado].label,
      c.motivo ? MOTIVOS[c.motivo] : '', c.asignado, c.contacto, c.seguimiento ?? '', c.fecha ?? '', ultima?.t ?? '',
      c.noContactar ? 'Sí' : '', c.por ?? '', c.at ? c.at.slice(0, 16).replace('T', ' ') : '',
    ].map(esc).join(',')
  })
  const blob = new Blob(['﻿' + [col.join(','), ...filas].join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

export async function copiar(texto: string) {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    return false
  }
}
