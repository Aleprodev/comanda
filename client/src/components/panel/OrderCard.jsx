import { useState } from 'react'
import { api, money } from '../../lib/api.js'

const payLabel = { mercadopago: 'Mercado Pago', transfer: 'Transferencia', cash: 'Efectivo' }

const next = {
  new: { to: 'cooking', label: 'Pasar a cocina' },
  cooking: { to: 'ready', label: 'Marcar listo' },
  ready: { to: 'delivered', label: 'Entregado' },
}

const payBadge = {
  paid: ['Pagado', 'bg-ok/15 text-[#1f8a3b]'],
  pending: ['Pago pendiente', 'bg-warn/15 text-[#b36b00]'],
  mismatch: ['Monto no coincide', 'bg-danger/15 text-danger'],
}

export const minutesSince = (iso, now) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000))

export default function OrderCard({ order, now }) {
  const [busy, setBusy] = useState(false)
  const mins = minutesSince(order.created_at, now)
  const late = mins >= 15 && (order.status === 'new' || order.status === 'cooking')
  const [badgeText, badgeClass] = payBadge[order.payment_status]
  const step = next[order.status]

  async function update(patch) {
    setBusy(true)
    try {
      await api.updateOrder(order.id, patch)
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight">Pedido #{order.number}</h3>
          <p className="text-xs text-muted">{order.customer_name || 'Cliente'}</p>
        </div>
        <span className={`text-xs font-medium tabular-nums ${late ? 'text-danger' : 'text-muted'}`}>
          {order.status === 'delivered' ? 'entregado' : `hace ${mins} min`}
        </span>
      </div>

      <ul className="mt-3 space-y-1 text-[13px]">
        {order.items.map((it, i) => (
          <li key={i}>
            <span className="font-medium tabular-nums">{it.qty}×</span> {it.name}
            {(it.coccion || it.notes) && (
              <span className="block pl-5 text-[11px] text-muted">{[it.coccion, it.notes].filter(Boolean).join(' · ')}</span>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-muted">
        {order.fulfillment === 'delivery' ? `🛵 ${order.address}` : '🏪 Retira en el local'}
        {order.notes && <span className="block">📝 {order.notes}</span>}
      </p>

      <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badgeClass}`}>{badgeText}</span>
          <span className="text-[11px] text-muted">{payLabel[order.payment_method]}</span>
        </div>
        <span className="text-base font-semibold tracking-tight tabular-nums">{money(order.total)}</span>
      </div>

      {(step || order.payment_status !== 'paid') && (
        <div className="mt-3 flex gap-2">
          {step && (
            <button
              disabled={busy}
              onClick={() => update({ status: step.to })}
              className="flex-1 rounded-full bg-accent px-3 py-2 text-[13px] font-medium text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
            >
              {step.label}
            </button>
          )}
          {order.payment_status !== 'paid' && (
            <button
              disabled={busy}
              onClick={() => update({ payment_status: 'paid' })}
              className="rounded-full bg-bg px-3 py-2 text-[13px] font-medium text-ink ring-1 ring-black/5 transition hover:bg-black/5 active:scale-[0.98] disabled:opacity-50"
            >
              Marcar pagado
            </button>
          )}
        </div>
      )}
    </article>
  )
}
