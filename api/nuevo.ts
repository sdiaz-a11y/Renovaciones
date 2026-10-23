import { randomBytes } from 'node:crypto'
import { aWhatsapp, LIMITES } from '../src/shared/modelo.js'
import { autenticar, contactosPorId, db, error, ok, sinCache } from './_lib.js'

const txt = (v: unknown, max: number = LIMITES.corto) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** Agrega a alguien que no venía en el Excel */
export async function POST(req: Request) {
  const q = await autenticar(req)
  if (q instanceof Response) return q
  try {
    const d = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>
    const nombre = txt(d.nombre, 80)
    const wa = aWhatsapp(txt(d.lada, 6), txt(d.telefono, 24))
    const email = txt(d.email, 120).toLowerCase()
    if (!nombre || (!wa && !email)) return Response.json({ error: 'datos' }, { status: 400 })
    // Lo que agrega un usuario queda asignado a él mismo
    const asignado = q.rol === 'admin' ? txt(d.asignado) : q.nombre
    const pais = txt(d.pais) || (wa?.startsWith('52') ? 'México' : wa?.startsWith('1') ? 'Estados Unidos' : 'Otro')
    const id = 'n' + randomBytes(6).toString('hex')
    const v = ok(
      await db().rpc('crm_nuevo', {
        p_c: {
          id,
          nombre,
          email,
          wa,
          tel: wa ? '+' + wa : '',
          pais,
          region: pais === 'Estados Unidos' ? 'EUA' : pais === 'México' ? 'México' : 'LATAM y otros',
          sede: txt(d.sede),
          asignado,
        },
        p_nota: txt(d.nota, LIMITES.texto),
        p_por: q.nombre,
      }),
    )
    const [contacto] = await contactosPorId([id])
    return Response.json({ v: Number(v), contacto }, { headers: sinCache })
  } catch (err) {
    return error(err)
  }
}
