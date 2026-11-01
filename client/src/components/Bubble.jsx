import { money } from '../lib/api.js'

const payLabel = { mercadopago: 'Mercado Pago', transfer: 'Transferencia', cash: 'Efectivo' }

function OrderCard({ order }) {
  return (
    <div className="w-64 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold tracking-tight">Pedido #{order.number}</span>
        <span className="rounded-full bg-ok/15 px-2 py-0.5 text-[11px] font-medium text-[#1f8a3b]">Registrado</span>
      </div>
      <ul className="mt-3 space-y-1.5 text-[13px]">
        {order.items.map((it, i) => (
          <li key={i} className="flex justify-between gap-3">
            <span>
              {it.qty} × {it.name}
              {(it.coccion || it.notes) && (
                <span className="block text-[11px] text-muted">{[it.coccion, it.notes].filter(Boolean).join(' · ')}</span>
              )}
            </span>
            <span className="tabular-nums text-muted">{money(it.unit_price * it.qty)}</span>
          </li>
        ))}
        {order.delivery_fee > 0 && (
          <li className="flex justify-between text-muted">
            <span>Envío</span>
            <span className="tabular-nums">{money(order.delivery_fee)}</span>
          </li>
        )}
      </ul>
      <div className="mt-3 flex items-baseline justify-between border-t border-line/70 pt-3">
        <span className="text-[13px] text-muted">{payLabel[order.payment_method]}</span>
        <span className="text-lg font-semibold tracking-tight tabular-nums">{money(order.total)}</span>
      </div>
      <p className="mt-2 text-[11px] text-muted">
        {order.fulfillment === 'delivery' ? `Envío a ${order.address}` : 'Retiro en el local'} · ~{order.eta_minutes} min
      </p>
    </div>
  )
}

export default function Bubble({ message }) {
  const mine = message.role === 'customer'

  if (message.type === 'order_summary' && message.meta?.order) {
    return (
      <div className="flex justify-start">
        <OrderCard order={message.meta.order} />
      </div>
    )
  }

  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[78%] whitespace-pre-wrap rounded-[20px] px-3.5 py-2 text-[15px] leading-snug ${
          mine ? 'rounded-br-md bg-accent text-white' : 'rounded-bl-md bg-white text-ink shadow-sm ring-1 ring-black/5'
        }`}
      >
        {message.content}
      </div>
    </div>
  )
}
