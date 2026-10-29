import { motion } from 'framer-motion'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { useCRM } from '../lib/crm'
import { copiar } from '../lib/util'

interface Plan {
  region: string
  nombre: string
  precio: string
  incluye: string[]
  enlace: string
}

// Planes de renovación a 1 año. Si cambian precios, contenido o enlaces, se editan aquí.
const PLANES: Plan[] = [
  {
    region: 'LATAM',
    nombre: 'RENOVACION LATAM 1 año',
    precio: '$299.00',
    incluye: ['1 año CS', '1 año Skool', '2 VIP SU mx'],
    enlace: 'https://pay.hotmart.com/D106300176V?off=ill2992e',
  },
  {
    region: 'MX',
    nombre: 'RENOVACION MX 1 año',
    precio: '$5,997.00',
    incluye: ['1 año CS', '1 año Skool', '2 Gral SU mx'],
    enlace: 'https://checkout.synergyforeducation.com/pay/pl_d5a368bddbdd56eac7c049c65fe3d6c9',
  },
  {
    region: 'USA',
    nombre: 'RENOVACION USA 1 año',
    precio: '$999.00',
    incluye: ['1 año CS', '1 año Skool', '2 VIP SU mx', '2 Generales a Synergy Unlimited USA 2027'],
    enlace: 'https://www.synergyforeducation.com/offers/hAH7JZbL',
  },
]

export function Info() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="kicker">Para cerrar renovaciones</p>
        <h1 className="font-display text-4xl leading-none font-extrabold tracking-tight uppercase">Info</h1>
        <p className="mt-2 max-w-xl text-sm text-tinta-2">Qué incluye cada renovación, cuánto cuesta y el enlace de pago para mandárselo a la persona.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {PLANES.map((p, i) => (
          <TarjetaPlan key={p.region} plan={p} retraso={i * 0.06} />
        ))}
      </div>
    </div>
  )
}

function TarjetaPlan({ plan, retraso }: { plan: Plan; retraso: number }) {
  const { avisar } = useCRM()
  const [copiado, setCopiado] = useState(false)

  const copiarEnlace = async () => {
    if (await copiar(plan.enlace)) {
      setCopiado(true)
      avisar(`Enlace de ${plan.region} copiado`)
      setTimeout(() => setCopiado(false), 2000)
    } else {
      avisar('No se pudo copiar. Usa "Abrir" y copia el enlace desde ahí.', 'error')
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: retraso, ease: [0.22, 1, 0.36, 1] }}
      className="tarjeta flex flex-col p-5"
    >
      <p className="kicker">{plan.region}</p>
      <p className="mt-1 font-display text-5xl leading-none font-extrabold tracking-tight">{plan.precio}</p>
      <p className="mt-1.5 text-xs font-semibold text-tenue">{plan.nombre}</p>

      <p className="kicker mt-5 mb-2">Incluye</p>
      <ul className="flex flex-col gap-2">
        {plan.incluye.map((x) => (
          <li key={x} className="flex items-center gap-2.5 text-sm font-medium">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#1baf7a]/15 text-[#1baf7a]">
              <Check size={13} strokeWidth={3} />
            </span>
            {x}
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-5">
        <p className="mb-2 truncate rounded-lg bg-papel px-2.5 py-1.5 text-[11px] text-tenue" title={plan.enlace}>
          {plan.enlace}
        </p>
        <div className="flex gap-2">
          <button className="btn-primario flex-1" onClick={() => void copiarEnlace()}>
            {copiado ? <Check size={16} /> : <Copy size={16} />} {copiado ? 'Copiado' : 'Copiar enlace'}
          </button>
          <a className="btn-suave" href={plan.enlace} target="_blank" rel="noreferrer noopener" aria-label={`Abrir el enlace de pago de ${plan.region}`}>
            <ExternalLink size={16} /> Abrir
          </a>
        </div>
      </div>
    </motion.section>
  )
}
