// Carga contactos de PRUEBA (inventados) en Supabase para ver el CRM funcionando.
// Uso: node --env-file=.env.local scripts/datos-demo.mjs        (cargar)
//      node --env-file=.env.local scripts/datos-demo.mjs borrar (quitar solo los de prueba)
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const ok = ({ error }) => {
  if (error) throw new Error(error.message)
}

if (process.argv[2] === 'borrar') {
  ok(await db.from('contactos').delete().like('email', '%@demo.invalid'))
  console.log('Contactos de prueba eliminados.')
  process.exit(0)
}

const nombres = ['Ana', 'Luis', 'Marta', 'Jorge', 'Sofía', 'Diego', 'Lucía', 'Pablo', 'Elena', 'Raúl', 'Carla', 'Iván', 'Paula', 'Hugo', 'Rosa']
const apellidos = ['Ramírez', 'Torres', 'Gómez', 'Herrera', 'Castro', 'Ortiz', 'Mendoza', 'Rojas', 'Vega', 'Salazar', 'Cruz', 'Reyes']
const sedes = ['Tampa', 'Orlando', 'Miami', 'Dallas', '']
const paises = [['México', '52', 'México'], ['Estados Unidos', '1', 'EUA'], ['Colombia', '57', 'LATAM y otros'], ['Perú', '51', 'LATAM y otros']]
const equipo = ['Demo Ana', 'Demo Luis', 'Demo Marta', '']
const estados = ['pendiente', 'pendiente', 'pendiente', 'sin_respuesta', 'contactado', 'interesado', 'renovado', 'no_interesado', 'invalido']
const pick = (a, i) => a[i % a.length]

const filas = Array.from({ length: 90 }, (_, i) => {
  const nombre = `${pick(nombres, i * 7)} ${pick(apellidos, i * 5)} (demo ${i + 1})`
  const email = `demo${i + 1}@demo.invalid`
  const [pais, lada, region] = pick(paises, i * 3)
  const wa = `${lada}${String(5500000000 + i * 7919).slice(0, 10)}`
  const dia = new Date(Date.now() - (30 + i * 4) * 864e5).toISOString().slice(0, 10)
  return {
    id: createHash('sha1').update(email).digest('hex').slice(0, 12),
    nombre, email, wa, tel: '+' + wa, pais, region, sede: pick(sedes, i), hojas: ['Demo'], fecha: dia,
    asignado: pick(equipo, i), estado: pick(estados, i * 5),
  }
})
ok(await db.from('contactos').upsert(filas, { onConflict: 'id' }))
ok(await db.from('config').update({ base_generado: new Date().toISOString(), base_fuente: 'Datos de prueba' }).eq('id', true))
ok(await db.rpc('crm_actividad', { p_por: 'Sistema', p_texto: `cargó ${filas.length} contactos de prueba` }))
console.log(`Listo: ${filas.length} contactos de prueba.`)
