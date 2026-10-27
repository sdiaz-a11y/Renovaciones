import { autenticar, db, error, ok, okNull, sinCache, type Quien } from './_lib.js'

/** Cada persona guarda su propia foto: por id de cuenta, o por nombre para quien entra con el código del administrador principal */
const claveFoto = (q: Quien) => (q.id === 'maestro' ? `maestro:${q.nombres[0] ?? ''}` : q.id)

// El navegador reduce la imagen a un JPEG cuadrado pequeño; aquí solo se acepta eso
const FOTO = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/
const MAX = 150_000

export async function GET(req: Request) {
  const q = await autenticar(req)
  if (q instanceof Response) return q
  try {
    const f = okNull(await db().from('fotos').select('foto').eq('clave', claveFoto(q)).maybeSingle())
    return Response.json({ foto: f?.foto ?? null }, { headers: sinCache })
  } catch (err) {
    return error(err)
  }
}

/** Guarda la foto propia ({foto: "data:image/jpeg;base64,..."}) o la quita ({foto: null}) */
export async function POST(req: Request) {
  const q = await autenticar(req)
  if (q instanceof Response) return q
  try {
    const body = (await req.json().catch(() => null)) as { foto?: unknown } | null
    const clave = claveFoto(q)
    if (body?.foto === null) {
      ok(await db().from('fotos').delete().eq('clave', clave).select('clave'))
      return Response.json({ foto: null }, { headers: sinCache })
    }
    if (typeof body?.foto !== 'string' || body.foto.length > MAX || !FOTO.test(body.foto)) {
      return Response.json({ error: 'La imagen no es válida o es demasiado grande' }, { status: 400 })
    }
    ok(await db().from('fotos').upsert({ clave, foto: body.foto, actualizada: new Date().toISOString() }, { onConflict: 'clave' }).select('clave'))
    return Response.json({ foto: body.foto }, { headers: sinCache })
  } catch (err) {
    return error(err)
  }
}
