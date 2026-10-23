import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage } from 'node:http'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/**
 * Solo en desarrollo: sirve las funciones de /api con el mismo código que corre en Vercel.
 * Las claves de Supabase y CODIGO_ADMIN se leen de .env.local.
 */
function apiLocal(): Plugin {
  const cuerpo = (req: IncomingMessage) =>
    new Promise<Buffer>((ok, mal) => {
      const partes: Buffer[] = []
      req.on('data', (p: Buffer) => partes.push(p))
      req.on('end', () => ok(Buffer.concat(partes)))
      req.on('error', mal)
    })
  return {
    name: 'api-local',
    apply: 'serve',
    configureServer(server) {
      Object.assign(process.env, loadEnv('development', process.cwd(), ''))
      server.middlewares.use(async (req, res, next) => {
        const m = req.url?.match(/^\/api\/([a-z]+)(\?.*)?$/)
        if (!m) return next()
        try {
          const mod = (await server.ssrLoadModule(`/api/${m[1]}.ts`)) as Record<string, (r: Request) => Promise<Response>>
          const fn = mod[req.method ?? 'GET']
          if (!fn) {
            res.statusCode = 405
            return res.end()
          }
          const headers = new Headers()
          for (const k of ['x-codigo', 'x-usuario', 'content-type']) {
            const v = req.headers[k]
            if (typeof v === 'string') headers.set(k, v)
          }
          const r = await fn(
            new Request(`http://localhost${req.url}`, {
              method: req.method,
              headers,
              body: req.method === 'POST' ? new Uint8Array(await cuerpo(req)) : undefined,
            }),
          )
          res.statusCode = r.status
          r.headers.forEach((v, k) => res.setHeader(k, v))
          res.end(Buffer.from(await r.arrayBuffer()))
        } catch (err) {
          next(err)
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), apiLocal()],
  // Sintaxis compatible con celulares no tan recientes (Safari 14 / Chrome 87 en adelante)
  build: { target: ['es2020', 'safari14', 'chrome87', 'firefox78', 'edge88'] },
})
