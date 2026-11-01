import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePanelData } from '../hooks/usePanelData.js'
import OrderCard from '../components/panel/OrderCard.jsx'
import Inbox from '../components/panel/Inbox.jsx'
import { money } from '../lib/api.js'

const columns = [
  { key: 'new', title: 'Nuevos', dot: 'bg-accent' },
  { key: 'cooking', title: 'En cocina', dot: 'bg-warn' },
  { key: 'ready', title: 'Listos', dot: 'bg-ok' },
  { key: 'delivered', title: 'Entregados', dot: 'bg-muted' },
]

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl bg-surface px-4 py-3 shadow-sm ring-1 ring-black/5">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-xl font-semibold tracking-tight tabular-nums">{value}</p>
    </div>
  )
}

export default function Panel() {
  const { orders, conversations, ready } = usePanelData()
  const [now, setNow] = useState(Date.now())
  const [inbox, setInbox] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  const startOfDay = new Date().setHours(0, 0, 0, 0)
  const today = orders.filter((o) => new Date(o.created_at).getTime() >= startOfDay)
  const open = orders.filter((o) => o.status !== 'delivered').length
  const alerts = conversations.filter((c) => c.needs_human).length

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-black/5 bg-bg/80 px-5 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-full bg-linear-to-b from-[#ffd36e] to-warn text-lg">🍕</div>
          <div className="leading-tight">
            <h1 className="text-[15px] font-semibold tracking-tight">Todo Chévere</h1>
            <p className="text-xs text-muted">Panel del local</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/pedir" className="hidden rounded-full px-3 py-1.5 text-sm text-accent hover:bg-accent/10 sm:block">
            Ver chat del cliente
          </Link>
          <button
            onClick={() => setInbox(true)}
            className="relative rounded-full bg-surface px-4 py-1.5 text-sm font-medium shadow-sm ring-1 ring-black/5 transition hover:bg-white active:scale-95"
          >
            Conversaciones
            {alerts > 0 && (
              <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-warn text-[11px] font-semibold text-white">
                {alerts}
              </span>
            )}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-3 px-5 pt-5">
        <Metric label="Pedidos de hoy" value={today.length} />
        <Metric label="Facturado hoy" value={money(today.reduce((s, o) => s + o.total, 0))} />
        <Metric label="En curso" value={open} />
      </div>

      <main className="flex-1 overflow-x-auto px-5 py-5">
        <div className="grid min-w-[1000px] grid-cols-4 gap-4 lg:min-w-0">
          {columns.map((col) => {
            const list = orders.filter((o) => o.status === col.key).sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
            return (
              <section key={col.key} className="rounded-3xl bg-black/[0.03] p-3">
                <h2 className="flex items-center gap-2 px-2 pb-3 pt-1 text-[13px] font-semibold tracking-tight">
                  <span className={`size-2 rounded-full ${col.dot}`} />
                  {col.title}
                  <span className="font-normal text-muted">{list.length}</span>
                </h2>
                <div className="space-y-3">
                  {list.map((o) => (
                    <OrderCard key={o.id} order={o} now={now} />
                  ))}
                  {ready && list.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted">Sin pedidos</p>}
                </div>
              </section>
            )
          })}
        </div>
      </main>

      {inbox && <Inbox conversations={conversations} onClose={() => setInbox(false)} />}
    </div>
  )
}
