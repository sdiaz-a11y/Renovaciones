import { autenticar, db, error, sinCache } from './_lib.js'

/** Revisa un código y dice qué app le toca (admin o usuario) */
export async function GET(req: Request) {
  const q = await autenticar(req)
  if (q instanceof Response) return q
  try {
    if (q.id !== 'maestro') {
      // Último acceso (máximo una escritura cada 30 min por persona)
      const limite = new Date(Date.now() - 30 * 60_000).toISOString()
      await db()
        .from('usuarios')
        .update({ ultimo_acceso: new Date().toISOString() })
        .eq('id', q.id)
        .or(`ultimo_acceso.is.null,ultimo_acceso.lt.${limite}`)
    }
    return Response.json({ rol: q.rol, nombre: q.nombre }, { headers: sinCache })
  } catch (err) {
    return error(err)
  }
}
