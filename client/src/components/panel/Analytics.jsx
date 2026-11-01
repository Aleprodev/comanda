import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { RANGES, compute } from '../../lib/analytics.js'
import SalesChart from '../charts/SalesChart.jsx'
import Heatmap from '../charts/Heatmap.jsx'
import RankBars from '../charts/RankBars.jsx'
import SegBar from '../charts/SegBar.jsx'
import StatTile, { Delta } from '../charts/StatTile.jsx'
import { money, pct } from '../charts/format.js'

const CATEGORIES = {
  pizzas: ['Pizzas', 's1'],
  empanadas: ['Empanadas', 's2'],
  minutas: ['Minutas', 's3'],
  bebidas: ['Bebidas', 's4'],
  postres: ['Postres', 's5'],
}
const PAYMENTS = { mercadopago: ['Mercado Pago', 's1'], transfer: ['Transferencia', 's2'], cash: ['Efectivo', 's3'] }
const FULFILLMENT = { delivery: ['Delivery', 's1'], pickup: ['Retiro en el local', 's2'] }

const withMeta = (list, meta) => list.map((i) => ({ ...i, label: meta[i.key][0], color: meta[i.key][1] }))

function Card({ title, subtitle, children, className = '' }) {
  return (
    <section className={`rounded-3xl bg-surface p-6 shadow-sm ring-1 ring-black/5 ${className}`}>
      <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
      {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

function Segmented({ options, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full bg-black/[0.05] p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          role="radio"
          aria-checked={value === o.key}
          onClick={() => onChange(o.key)}
          className={`rounded-full px-3.5 py-1 text-[13px] font-medium transition ${
            value === o.key ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function Analytics({ orders, conversations, now }) {
  const [range, setRange] = useState('7d')
  const [metric, setMetric] = useState('units')
  const [products, setProducts] = useState([])

  useEffect(() => {
    supabase.from('products').select('id,category').then(({ data }) => setProducts(data ?? []))
  }, [])

  const a = useMemo(() => compute({ orders, conversations, products, range, now }), [orders, conversations, products, range, now])

  const ranked = [...a.products].sort((x, y) => y[metric] - x[metric]).slice(0, 8).map((p) => ({ ...p, value: p[metric] }))
  const prepChange = a.prep != null && a.prepPrev ? ((a.prep - a.prepPrev) / a.prepPrev) * 100 : null
  const prevLabel = range === 'today' ? 'vs ayer a esta hora' : 'vs período anterior'

  return (
    <div className="viz space-y-5 px-5 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Período" options={RANGES} value={range} onChange={setRange} />
        <p className="text-xs text-muted">Todo lo de abajo se calcula sobre el período elegido.</p>
      </div>

      {/* Ventas: la cifra principal de la vista */}
      <section className="rounded-3xl bg-surface p-6 shadow-sm ring-1 ring-black/5">
        <p className="text-[13px] text-muted">Ventas</p>
        <div className="mt-1 flex flex-wrap items-end gap-x-4 gap-y-1">
          <p className="text-6xl font-semibold leading-none tracking-tighter">{money(a.sales)}</p>
          <div className="pb-1">
            <Delta value={a.salesChange} label={prevLabel} />
          </div>
        </div>

        <div className="mt-6">
          {a.orders === 0 && <p className="mb-2 text-sm text-muted">Todavía no hay pedidos en este período.</p>}
          <SalesChart series={a.series} prev={a.prevSeries} />
        </div>

        <ul className="mt-2 flex items-center gap-5 text-[12px] text-ink-2" style={{ color: 'var(--viz-ink-2)' }}>
          <li className="flex items-center gap-2">
            <span className="h-0.5 w-4 rounded bg-(--s1)" />
            Este período
          </li>
          {a.prevSeries && (
            <li className="flex items-center gap-2">
              <span className="h-0.5 w-4 rounded bg-(--viz-base)" />
              {range === 'today' ? 'Ayer a esta hora' : 'Período anterior'}
            </li>
          )}
        </ul>

        <details className="mt-4 text-[13px]">
          <summary className="cursor-pointer text-accent">Ver como tabla</summary>
          <div className="mt-3 max-h-64 overflow-auto rounded-2xl ring-1 ring-black/5">
            <table className="w-full text-left tabular-nums">
              <thead className="sticky top-0 bg-bg text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">{a.hourly ? 'Hora' : 'Día'}</th>
                  <th className="px-3 py-2 font-medium">Ventas</th>
                  <th className="px-3 py-2 font-medium">Pedidos</th>
                  {a.prevSeries && <th className="px-3 py-2 font-medium">Antes</th>}
                </tr>
              </thead>
              <tbody>
                {a.series.map((s, i) => (
                  <tr key={s.t} className="border-t border-line/40">
                    <td className="px-3 py-1.5">{s.label}</td>
                    <td className="px-3 py-1.5">{money(s.value)}</td>
                    <td className="px-3 py-1.5">{s.orders}</td>
                    {a.prevSeries && <td className="px-3 py-1.5 text-muted">{money(a.prevSeries[i].value)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Pedidos" value={a.orders} delta={a.ordersChange} />
        <StatTile label="Ticket promedio" value={a.orders ? money(a.ticket) : '—'} delta={a.ticketChange} />
        <StatTile label="Tiempo hasta listo" value={a.prep != null ? Math.round(a.prep) : '—'} unit={a.prep != null ? 'min' : ''} delta={a.prep != null ? prepChange : undefined} upIsGood={false} note="Aún sin pedidos listos" />
        <StatTile label="Chats que terminan en pedido" value={a.conversion != null ? pct(a.conversion) : '—'} note={`${a.conversations} ${a.conversations === 1 ? 'conversación' : 'conversaciones'}`} />
        <StatTile label="Resueltos por el asistente" value={a.automation != null ? pct(a.automation) : '—'} note="Sin intervención humana" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Horas pico" subtitle="Pedidos por día de la semana y hora">
          <Heatmap heat={a.heat} />
        </Card>

        <Card title="Lo que más se vende" subtitle={metric === 'units' ? 'Unidades vendidas' : 'Ingresos por producto'}>
          <div className="mb-4">
            <Segmented
              label="Ordenar por"
              value={metric}
              onChange={setMetric}
              options={[
                { key: 'units', label: 'Unidades' },
                { key: 'revenue', label: 'Ingresos' },
              ]}
            />
          </div>
          <RankBars items={ranked} format={(v) => (metric === 'units' ? `${v} u.` : money(v))} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="De dónde vienen los ingresos" subtitle="Por categoría, sin contar el envío">
          <SegBar items={withMeta(a.categories.filter((c) => CATEGORIES[c.key]), CATEGORIES)} formatValue={money} />
        </Card>

        <Card title="Cómo piden y cómo pagan" subtitle="Cantidad de pedidos">
          <div className="space-y-6">
            <div>
              <p className="mb-2 text-[13px] text-muted">Medio de pago</p>
              <SegBar items={withMeta(a.payments, PAYMENTS)} formatValue={(v) => `${v} ${v === 1 ? 'pedido' : 'pedidos'}`} />
            </div>
            <div>
              <p className="mb-2 text-[13px] text-muted">Entrega</p>
              <SegBar items={withMeta(a.fulfillment, FULFILLMENT)} formatValue={(v) => `${v} ${v === 1 ? 'pedido' : 'pedidos'}`} />
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
