// Sube a Supabase el JSON generado por importar.py (o el que devuelve /api/contactos del CRM anterior).
// Reimportar es seguro: solo toca los datos del Excel; lo que el equipo cambió en el CRM no se pierde.
// Uso: node --env-file=.env.local scripts/subir-base.mjs <contactos.json>
import { readFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const ruta = process.argv[2]
if (!ruta) {
  console.error('Uso: node --env-file=.env.local scripts/subir-base.mjs <contactos.json>')
  process.exit(1)
}
const base = JSON.parse(await readFile(ruta, 'utf8'))
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const ok = ({ error }) => {
  if (error) throw new Error(error.message)
}
const trozos = (lista, n) => Array.from({ length: Math.ceil(lista.length / n) }, (_, i) => lista.slice(i * n, i * n + n))

const filas = base.contactos.map((c) => ({
  id: c.id,
  nombre: c.nombre,
  email: c.email ?? '',
  wa: c.wa ?? null,
  tel: c.tel ?? '',
  tel_alt: c.telAlt ?? null,
  pais: c.pais ?? '',
  region: c.region ?? '',
  sede: c.sede ?? '',
  hojas: c.hojas ?? [],
  fecha: c.fecha ?? null,
  asignado: c.asignado ?? '',
  contacto: c.contacto ?? '',
  estado: c.estado ?? 'pendiente',
  ...(c.noContactar ? { no_contactar: true } : {}),
  ...(c.motivo ? { motivo: c.motivo } : {}),
}))

let hechos = 0
for (const lote of trozos(filas, 500)) {
  ok(await db.from('contactos').upsert(lote, { onConflict: 'id' }))
  hechos += lote.length
  process.stdout.write(`\rContactos: ${hechos}/${filas.length}`)
}

// Las notas del Excel se reemplazan; las que escribió el equipo (origen = 'crm') no se tocan
for (const lote of trozos(base.contactos, 200)) {
  ok(await db.from('notas').delete().eq('origen', 'excel').in('contacto_id', lote.map((c) => c.id)))
}
const notas = base.contactos.flatMap((c) =>
  (c.notas ?? []).map((n) => ({ contacto_id: c.id, texto: n.t ?? '', fecha: n.f ?? null, hoja: n.h ?? null, por: n.por ?? null, estado: n.e ?? null, origen: 'excel' })),
)
let n = 0
for (const lote of trozos(notas, 1000)) {
  ok(await db.from('notas').insert(lote))
  n += lote.length
}
ok(await db.from('config').update({ base_generado: base.generado ?? '', base_fuente: base.fuente ?? '' }).eq('id', true))
ok(await db.rpc('crm_actividad', { p_por: 'Sistema', p_texto: `importó la base del Excel (${filas.length} contactos)` }))
console.log(`\nListo: ${filas.length} contactos y ${n} notas.`)
