import { randomInt, randomUUID } from 'node:crypto'
import { LIMITES, type Usuario, type UsuarioPublico } from '../src/shared/modelo.js'
import { aUsuario, autenticar, db, error, hashCodigo, ok, okNull, registrar, sinCache } from './_lib.js'

const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Código personal tipo MOY-7K4P-Q2HX (sin letras confusas como O/0 o I/1) */
function generarCodigo(nombre: string) {
  const prefijo =
    nombre
      .normalize('NFD')
      .replace(/[^A-Za-z]/g, '')
      .toUpperCase()
      .slice(0, 4) || 'CLUB'
  const bloque = () => Array.from({ length: 4 }, () => LETRAS[randomInt(LETRAS.length)]).join('')
  return `${prefijo}-${bloque()}-${bloque()}`
}

const publico = ({ hash: _hash, ...u }: Usuario): UsuarioPublico => u
const txt = (v: unknown, max: number = LIMITES.corto) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const lista = (v: unknown) => (Array.isArray(v) ? [...new Set(v.map((x) => txt(x)).filter(Boolean))].slice(0, 8) : [])

export async function GET(req: Request) {
  const q = await autenticar(req, 'admin')
  if (q instanceof Response) return q
  try {
    const filas = ok(await db().from('usuarios').select('*').order('creado'))
    const fotos = new Map(ok(await db().from('fotos').select('clave, foto').in('clave', filas.map((f) => f.id))).map((f) => [f.clave, f.foto]))
    return Response.json({ usuarios: filas.map((f) => ({ ...publico(aUsuario(f)), ...(fotos.has(f.id) ? { foto: fotos.get(f.id) } : {}) })) }, { headers: sinCache })
  } catch (err) {
    return error(err)
  }
}

const duplicado = async (nombre: string, exceptoId = '') => {
  const filas = ok(await db().from('usuarios').select('id').ilike('nombre', nombre.replace(/[\\%_]/g, (c) => '\\' + c)))
  return filas.some((f) => f.id !== exceptoId)
}

/** Crear cuenta, regenerar código o editar (nombre, rol, alias, activo) */
export async function POST(req: Request) {
  const q = await autenticar(req, 'admin')
  if (q instanceof Response) return q
  try {
    const d = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>
    const accion = txt(d.accion)
    const malo = (mensaje: string) => Response.json({ error: mensaje }, { status: 400 })
    let codigo: string | null = null
    let u: Usuario

    if (accion === 'crear') {
      const nombre = txt(d.nombre)
      if (!nombre) return malo('Falta el nombre')
      if (await duplicado(nombre)) return malo('Ya existe una cuenta con ese nombre')
      codigo = generarCodigo(nombre)
      const rol = d.rol === 'admin' ? 'admin' : 'usuario'
      u = aUsuario(
        ok(await db().from('usuarios').insert({ id: randomUUID().slice(0, 8), nombre, alias: lista(d.alias), rol, hash: hashCodigo(codigo) }).select().single()),
      )
      await registrar(q.nombre, `creó la cuenta de ${nombre} (${rol === 'admin' ? 'administrador' : 'usuario'})`)
    } else {
      const id = txt(d.id)
      const previo = okNull(await db().from('usuarios').select('*').eq('id', id).maybeSingle())
      if (!previo) return malo('No existe esa cuenta')
      if (accion === 'codigo') {
        codigo = generarCodigo(previo.nombre)
        u = aUsuario(ok(await db().from('usuarios').update({ hash: hashCodigo(codigo), activo: true }).eq('id', id).select().single()))
        await registrar(q.nombre, `generó un código nuevo para ${u.nombre}`)
      } else if (accion === 'editar') {
        const nombre = txt(d.nombre)
        if (nombre && (await duplicado(nombre, id))) return malo('Ya existe una cuenta con ese nombre')
        const cambios: Record<string, unknown> = {}
        if (nombre) cambios.nombre = nombre
        if (Array.isArray(d.alias)) cambios.alias = lista(d.alias)
        if (d.rol === 'admin' || d.rol === 'usuario') cambios.rol = d.rol
        if (typeof d.activo === 'boolean') cambios.activo = d.activo
        u = Object.keys(cambios).length ? aUsuario(ok(await db().from('usuarios').update(cambios).eq('id', id).select().single())) : aUsuario(previo)
        await registrar(q.nombre, `actualizó la cuenta de ${u.nombre}${typeof d.activo === 'boolean' ? (d.activo ? ' (activa)' : ' (desactivada)') : ''}`)
      } else {
        return malo('Acción desconocida')
      }
    }
    // El código solo se muestra una vez: no se guarda en texto plano
    return Response.json({ usuario: publico(u), codigo }, { headers: sinCache })
  } catch (err) {
    return error(err)
  }
}
