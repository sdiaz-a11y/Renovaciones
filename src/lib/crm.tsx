import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { acumular, aplicar, type Actividad, type Contacto, type Edicion, type Plantilla } from '../shared/modelo'
import { ConfirmarRenovacion, type Confirmacion } from '../components/ConfirmarRenovacion'
import { prepararComprobante } from './comprobante'
import { api, type Carga, type Delta, type NuevoContacto, type Sesion } from './api'

interface CRM {
  sesion: Sesion
  esAdmin: boolean
  contactos: Contacto[]
  porId: Map<string, Contacto>
  actividad: Actividad[]
  plantillas: Plantilla[]
  meta: number | null
  generado: string
  fuente: string
  /** Nombres del equipo (de quienes aparecen en el Excel y en el CRM), los más activos primero */
  equipo: string[]
  sincronizado: Date | null
  sinConexion: boolean
  actualizar: (ids: string[], edicion: Edicion) => Promise<boolean>
  nuevo: (datos: NuevoContacto) => Promise<Contacto | null>
  guardarConfig: (datos: { plantillas?: Plantilla[]; meta?: number | null }) => Promise<boolean>
  /** Foto de perfil de quien tiene la sesión abierta */
  foto: string | null
  guardarFoto: (foto: string | null) => Promise<boolean>
  /** Reenvía el aviso de renovación al Club, o confirma que ya se le avisó a mano que no procede */
  avisoClub: (solicitudId: string, accion: 'reenviar' | 'cerrar') => Promise<boolean>
  /** Sube un comprobante de pago (foto o PDF) a la ficha de un contacto */
  subirComprobante: (contactoId: string, archivo: File) => Promise<boolean>
  /** Abre un comprobante en otra pestaña */
  verComprobante: (id: string) => Promise<void>
  /** Vuelve a bajar todos los contactos (la sincronización con el Club no sube la versión, así que el sondeo no los ve) */
  recargar: () => Promise<void>
  avisar: (texto: string, tipo?: 'ok' | 'error') => void
}

const Ctx = createContext<CRM | null>(null)

export function useCRM() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useCRM fuera del proveedor')
  return c
}

// Casi en vivo: cuando no hay cambios el servidor responde con una sola lectura barata. Con la pestaña oculta no se consulta.
const CADA = 4_000

function fusionar(lista: Contacto[], nuevos: Contacto[]) {
  if (!nuevos.length) return lista
  const m = new Map(nuevos.map((c) => [c.id, c]))
  const out = lista.map((c) => m.get(c.id) ?? c)
  const ya = new Set(lista.map((c) => c.id))
  for (const c of nuevos) if (!ya.has(c.id)) out.push(c)
  return out
}

function unirActividad(prev: Actividad[], extra: Actividad[]) {
  if (!extra.length) return prev
  const clave = (a: Actividad) => `${a.v}:${a.id}:${a.at}`
  const vistos = new Set(prev.map(clave))
  return [...prev, ...extra.filter((a) => !vistos.has(clave(a)))].sort((a, b) => a.v - b.v).slice(-300)
}

export function ProveedorCRM({
  sesion,
  inicial,
  avisar,
  children,
}: {
  sesion: Sesion
  inicial: Carga
  avisar: CRM['avisar']
  children: ReactNode
}) {
  const [contactos, setContactos] = useState(inicial.contactos)
  const [actividad, setActividad] = useState(inicial.actividad)
  const [plantillas, setPlantillas] = useState(inicial.plantillas)
  const [meta, setMeta] = useState(inicial.meta)
  // Doble verificación de "Renovado": mientras haya una pendiente se muestra la ventana de confirmación
  const [confirmando, setConfirmando] = useState<{ contactos: Contacto[]; notaInicial: string; responder: (r: Confirmacion | null) => void } | null>(null)
  const [foto, setFoto] = useState<string | null>(null)
  const [base, setBase] = useState({ generado: inicial.generado, fuente: inicial.fuente })
  const [sincronizado, setSincronizado] = useState<Date | null>(new Date())
  const [sinConexion, setSinConexion] = useState(false)
  // La versión solo avanza con la consulta de cambios, para no saltarse cambios de otras personas
  const version = useRef(inicial.v)
  const consultando = useRef(false)

  const aplicarDelta = useCallback((d: Delta) => {
    version.current = Math.max(version.current, d.v)
    if (d.contactos.length) setContactos((prev) => fusionar(prev, d.contactos))
    if (d.quitar?.length) {
      const fuera = new Set(d.quitar)
      setContactos((prev) => prev.filter((c) => !fuera.has(c.id)))
    }
    if (d.actividad.length) setActividad((prev) => unirActividad(prev, d.actividad))
    if (d.plantillas) setPlantillas(d.plantillas)
    if (d.meta !== undefined) setMeta(d.meta)
  }, [])

  const consultar = useCallback(async () => {
    if (consultando.current) return
    consultando.current = true
    try {
      aplicarDelta(await api.cambios(sesion, version.current))
      setSincronizado(new Date())
      setSinConexion(false)
    } catch {
      setSinConexion(true)
    } finally {
      consultando.current = false
    }
  }, [aplicarDelta, sesion])

  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') void consultar()
    }, CADA)
    const alVolver = () => {
      if (document.visibilityState === 'visible') void consultar()
    }
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('online', alVolver)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('online', alVolver)
    }
  }, [consultar])

  const porId = useMemo(() => new Map(contactos.map((c) => [c.id, c])), [contactos])
  const porIdRef = useRef(porId)
  porIdRef.current = porId

  const subirComprobante = useCallback<CRM['subirComprobante']>(
    async (contactoId, archivo) => {
      try {
        const r = await api.subirComprobante(sesion, contactoId, await prepararComprobante(archivo))
        setContactos((prev) => fusionar(prev, r.contactos))
        avisar('Comprobante guardado')
        return true
      } catch (err) {
        avisar(`No se subió el comprobante: ${(err as Error).message}`, 'error')
        return false
      }
    },
    [avisar, sesion],
  )

  const verComprobante = useCallback<CRM['verComprobante']>(
    async (id) => {
      // La pestaña se abre antes de pedir el enlace, para que el navegador no la bloquee
      const ventana = window.open('', '_blank')
      try {
        const { url } = await api.verComprobante(sesion, id)
        if (ventana) ventana.location.href = url
        else window.open(url, '_blank')
      } catch (err) {
        ventana?.close()
        avisar(`No se pudo abrir el comprobante: ${(err as Error).message}`, 'error')
      }
    },
    [avisar, sesion],
  )

  const actualizar = useCallback<CRM['actualizar']>(
    async (ids, edicionPedida) => {
      let edicion = edicionPedida
      let archivo: File | null = null
      const antes = ids.map((id) => porIdRef.current.get(id)).filter((c): c is Contacto => !!c)
      // Marcar "Renovado" avisa al CRM del Club: antes se pide confirmar (el servidor también lo exige)
      const porRenovar = edicion.estado === 'renovado' ? antes.filter((c) => c.estado !== 'renovado') : []
      if (porRenovar.length) {
        const r = await new Promise<Confirmacion | null>((resolver) =>
          setConfirmando({
            contactos: porRenovar,
            notaInicial: edicion.nota ?? '',
            responder: (x) => {
              setConfirmando(null)
              resolver(x)
            },
          }),
        )
        if (!r) return false
        // La nota y el comprobante se capturan en la misma ventana de confirmación
        if (r.nota.trim()) edicion = { ...edicion, nota: r.nota.trim() }
        archivo = r.archivo
      }
      const ahora = new Date().toISOString()
      // Se ve el cambio al instante; si el servidor falla, se regresa
      setContactos((prev) =>
        fusionar(
          prev,
          antes.map((c) => aplicar(c, { ...acumular(undefined, edicion, c.v ?? 0, ahora, sesion.nombre) })),
        ),
      )
      try {
        const r = await api.actualizar(sesion, ids, edicion, porRenovar.length > 0)
        setContactos((prev) => fusionar(prev, r.contactos))
        if (r.club?.revertidas.length) {
          avisar(`Ya se había avisado al Club que ${r.club.revertidas.join(', ')} renovó. Avísales que no procede (ficha → Aviso al Club).`, 'error')
        }
        void consultar()
        // El comprobante se sube ya con la renovación guardada; si falla, se puede volver a subir desde la ficha
        if (archivo && ids.length === 1) await subirComprobante(ids[0], archivo)
        return true
      } catch (err) {
        setContactos((prev) => fusionar(prev, antes))
        avisar(`No se guardó: ${(err as Error).message}`, 'error')
        return false
      }
    },
    [avisar, consultar, sesion, subirComprobante],
  )

  const nuevo = useCallback<CRM['nuevo']>(
    async (datos) => {
      try {
        const r = await api.nuevo(sesion, datos)
        setContactos((prev) => fusionar(prev, [r.contacto]))
        void consultar()
        return r.contacto
      } catch (err) {
        avisar(`No se agregó: ${(err as Error).message}`, 'error')
        return null
      }
    },
    [avisar, consultar, sesion],
  )

  const guardarConfig = useCallback<CRM['guardarConfig']>(
    async (datos) => {
      try {
        const r = await api.config(sesion, datos)
        if (r.plantillas) setPlantillas(r.plantillas)
        setMeta(r.meta)
        void consultar()
        return true
      } catch (err) {
        avisar(`No se guardó: ${(err as Error).message}`, 'error')
        return false
      }
    },
    [avisar, consultar, sesion],
  )

  // La foto no viaja con los contactos: se pide aparte, una vez
  useEffect(() => {
    api.foto(sesion).then((r) => setFoto(r.foto), () => undefined)
  }, [sesion])

  const guardarFoto = useCallback<CRM['guardarFoto']>(
    async (nueva) => {
      try {
        setFoto((await api.guardarFoto(sesion, nueva)).foto)
        return true
      } catch (err) {
        avisar(`No se guardó la foto: ${(err as Error).message}`, 'error')
        return false
      }
    },
    [avisar, sesion],
  )

  const avisoClub = useCallback<CRM['avisoClub']>(
    async (solicitudId, accion) => {
      try {
        const r = await api.solicitud(sesion, solicitudId, accion)
        setContactos((prev) => fusionar(prev, r.contactos))
        return true
      } catch (err) {
        avisar(`No se pudo: ${(err as Error).message}`, 'error')
        return false
      }
    },
    [avisar, sesion],
  )

  const recargar = useCallback(async () => {
    const r = await api.contactos(sesion)
    version.current = r.v
    setContactos(r.contactos)
    setActividad(r.actividad)
    setPlantillas(r.plantillas)
    setMeta(r.meta)
    setBase({ generado: r.generado, fuente: r.fuente })
    setSincronizado(new Date())
    setSinConexion(false)
  }, [sesion])

  const equipo = useMemo(() => {
    const n = new Map<string, number>()
    const sumar = (x?: string) => {
      const k = x?.trim()
      if (k && k.length > 1) n.set(k, (n.get(k) ?? 0) + 1)
    }
    for (const c of contactos) {
      sumar(c.asignado)
      sumar(c.contacto)
      sumar(c.por)
    }
    for (const a of actividad) sumar(a.por)
    sumar(sesion.nombre)
    return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k)
  }, [actividad, contactos, sesion.nombre])

  const valor: CRM = {
    sesion,
    esAdmin: sesion.rol === 'admin',
    contactos,
    porId,
    actividad,
    plantillas,
    meta,
    generado: base.generado,
    fuente: base.fuente,
    equipo,
    sincronizado,
    sinConexion,
    actualizar,
    nuevo,
    guardarConfig,
    foto,
    guardarFoto,
    subirComprobante,
    verComprobante,
    avisoClub,
    recargar,
    avisar,
  }
  return (
    <Ctx.Provider value={valor}>
      {children}
      {confirmando && <ConfirmarRenovacion contactos={confirmando.contactos} notaInicial={confirmando.notaInicial} responder={confirmando.responder} />}
    </Ctx.Provider>
  )
}
