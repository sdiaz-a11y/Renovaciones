import { MessageCircle, Plus, RotateCcw, Save, Target, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Seccion } from '../components/piezas'
import { useCRM } from '../lib/crm'
import { num, rellenar } from '../lib/util'
import { PLANTILLAS_INICIALES, type Plantilla } from '../shared/modelo'

export function Mensajes() {
  const { plantillas, guardarConfig, sesion, meta, contactos, avisar } = useCRM()
  const [lista, setLista] = useState<Plantilla[]>(plantillas)
  const [metaTxt, setMetaTxt] = useState(meta ? String(meta) : '')
  const [guardando, setGuardando] = useState(false)
  const cambiado = JSON.stringify(lista) !== JSON.stringify(plantillas)
  const ejemplo = { nombre: 'María López' }
  const renovados = contactos.filter((c) => c.estado === 'renovado').length

  const editar = (i: number, k: keyof Plantilla, v: string) => setLista((l) => l.map((p, j) => (j === i ? { ...p, [k]: v } : p)))

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="kicker">Para todo el equipo</p>
        <h1 className="font-display text-4xl leading-none font-extrabold tracking-tight uppercase">Mensajes y meta</h1>
      </div>

      <Seccion kicker="Lo que ve el equipo en el panel" titulo="Meta de renovaciones">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={async (e) => {
            e.preventDefault()
            const n = Number(metaTxt)
            if (await guardarConfig({ meta: n > 0 ? Math.round(n) : null })) avisar(n > 0 ? `Meta: ${num(n)} renovaciones` : 'Meta quitada')
          }}
        >
          <label>
            <span className="kicker mb-1 flex items-center gap-1.5">
              <Target size={13} /> Renovaciones
            </span>
            <input className="campo w-40 text-lg font-semibold" inputMode="numeric" value={metaTxt} onChange={(e) => setMetaTxt(e.target.value.replace(/\D/g, ''))} placeholder="Ej. 150" />
          </label>
          <button className="btn-primario">Guardar meta</button>
          <p className="text-sm text-tinta-2">
            Hoy van <b className="num">{num(renovados)}</b> renovados.
          </p>
        </form>
      </Seccion>

      <Seccion
        kicker="Se abren desde el botón de WhatsApp de cada contacto"
        titulo="Plantillas de WhatsApp"
        accion={
          <div className="flex gap-2">
            <button className="btn-suave" onClick={() => setLista(PLANTILLAS_INICIALES)} title="Volver a las plantillas originales">
              <RotateCcw size={15} />
            </button>
            <button
              className="btn-primario"
              disabled={!cambiado || guardando}
              onClick={async () => {
                setGuardando(true)
                if (await guardarConfig({ plantillas: lista.filter((p) => p.titulo.trim() && p.texto.trim()) })) avisar('Plantillas guardadas para todo el equipo')
                setGuardando(false)
              }}
            >
              <Save size={15} /> Guardar
            </button>
          </div>
        }
      >
        <p className="mb-4 text-sm text-tinta-2">
          Usa <code className="rounded bg-papel px-1.5 py-0.5 text-xs">{'{nombre}'}</code> para el primer nombre del contacto y{' '}
          <code className="rounded bg-papel px-1.5 py-0.5 text-xs">{'{yo}'}</code> para quien envía. La primera plantilla es la que se usa por defecto.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          {lista.map((p, i) => (
            <div key={p.id} className="rounded-2xl border border-linea p-4">
              <div className="mb-2 flex items-center gap-2">
                <input className="campo font-semibold" value={p.titulo} onChange={(e) => editar(i, 'titulo', e.target.value)} maxLength={60} />
                <button onClick={() => setLista((l) => l.filter((_, j) => j !== i))} className="rounded-lg p-2 text-tenue hover:bg-papel hover:text-[#b8312f]" aria-label="Eliminar plantilla">
                  <Trash2 size={16} />
                </button>
              </div>
              <textarea className="campo resize-y" rows={4} value={p.texto} onChange={(e) => editar(i, 'texto', e.target.value)} maxLength={1000} />
              <div className="mt-3 rounded-2xl bg-[#e7f6ec] p-3">
                <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-wa-oscuro">
                  <MessageCircle size={12} /> Así se verá
                </p>
                <p className="rounded-xl rounded-tl-sm bg-white px-3 py-2 text-sm whitespace-pre-wrap shadow-sm">{rellenar(p.texto, ejemplo, sesion.nombre)}</p>
              </div>
            </div>
          ))}
          {lista.length < 12 && (
            <button
              onClick={() => setLista((l) => [...l, { id: `p${Date.now().toString(36)}`, titulo: 'Nueva plantilla', texto: 'Hola {nombre}, ' }])}
              className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-linea-2 text-sm font-semibold text-tenue hover:border-vino-500/50 hover:text-vino-600"
            >
              <Plus size={20} /> Agregar plantilla
            </button>
          )}
        </div>
      </Seccion>
    </div>
  )
}
