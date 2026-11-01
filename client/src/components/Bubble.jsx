import { money } from '../lib/api.js'
import { playSpeech, stopSpeech, useSpeechStatus } from '../lib/speech.js'

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

function PaymentCard({ meta, paid }) {
  return (
    <div className="w-64 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <p className="text-[13px] text-muted">Pedido #{meta.number}</p>
      <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums">{money(meta.total)}</p>
      {paid ? (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-full bg-ok/15 px-4 py-2.5 text-[14px] font-semibold text-[#1f8a3b]">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
          Pago confirmado
        </div>
      ) : (
        <>
          <a
            href={meta.url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 block rounded-full bg-[#009ee3] px-4 py-2.5 text-center text-[14px] font-semibold text-white transition hover:brightness-110 active:scale-[0.98]"
          >
            Pagar con Mercado Pago
          </a>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-muted">
            <span className="size-1.5 animate-pulse rounded-full bg-warn" />
            Esperando el pago · se confirma solo
          </p>
        </>
      )}
    </div>
  )
}

export default function Bubble({ message, paidOrderIds, showOptions, onPick }) {
  const mine = message.role === 'customer'

  if (message.type === 'audio' && message.meta?.url) {
    return (
      <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[82%] rounded-[20px] p-2 ${mine ? 'rounded-br-md bg-accent text-white' : 'rounded-bl-md bg-white shadow-sm ring-1 ring-black/5'}`}>
          <audio controls preload="metadata" src={message.meta.url} className="h-9 w-56 max-w-full" />
          {message.meta.transcript && (
            <p className={`px-2 pb-1 pt-1.5 text-[13px] leading-snug ${mine ? 'text-white/90' : 'text-muted'}`}>“{message.meta.transcript}”</p>
          )}
        </div>
      </div>
    )
  }

  if (message.type === 'image' && message.meta?.url) {
    const kind = message.meta.kind
    const caption = kind === 'comprobante' ? message.content : kind === 'lista_pedido' ? `Leí: ${message.meta.caption ?? ''}` : ''
    return (
      <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[78%] overflow-hidden rounded-[20px] p-1 ${mine ? 'rounded-br-md bg-accent text-white' : 'rounded-bl-md bg-white shadow-sm ring-1 ring-black/5'}`}>
          <img src={message.meta.url} alt="Foto enviada" loading="lazy" className="max-h-64 w-full rounded-[16px] object-cover" />
          {caption && <p className="px-2.5 pb-1.5 pt-1.5 text-[13px] leading-snug">{caption}</p>}
        </div>
      </div>
    )
  }

  if (message.type === 'payment_link' && message.meta?.url) {
    return (
      <div className="flex justify-start">
        <PaymentCard meta={message.meta} paid={paidOrderIds?.has(message.meta.order_id)} />
      </div>
    )
  }

  if (message.type === 'order_summary' && message.meta?.order) {
    return (
      <div className="flex justify-start">
        <OrderCard order={message.meta.order} />
      </div>
    )
  }

  const options = !mine && showOptions ? message.meta?.options : null

  return (
    <div>
      <div className={`flex items-end gap-1.5 ${mine ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`max-w-[78%] whitespace-pre-wrap rounded-[20px] px-3.5 py-2 text-[15px] leading-snug ${
            mine ? 'rounded-br-md bg-accent text-white' : 'rounded-bl-md bg-white text-ink shadow-sm ring-1 ring-black/5'
          }`}
        >
          {message.content}
        </div>
        {!mine && message.type === 'text' && message.content && <SpeakButton message={message} />}
      </div>

      {/* Respuestas rápidas: solo en el último mensaje, mientras esperan respuesta */}
      {options?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {options.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => onPick?.(o)}
              className="rounded-full bg-white px-4 py-2 text-[14px] font-medium text-accent shadow-sm ring-1 ring-accent/30 transition hover:bg-accent hover:text-white active:scale-95"
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Lee el mensaje en voz alta con la voz de OpenAI (el audio queda guardado: no se paga dos veces)
function SpeakButton({ message }) {
  const status = useSpeechStatus(message.id)
  const busy = status !== 'idle'
  return (
    <button
      type="button"
      onClick={() => (status === 'playing' ? stopSpeech() : playSpeech(message.id, message.meta?.speech_url))}
      aria-label={status === 'playing' ? 'Detener la lectura' : 'Escuchar el mensaje'}
      className={`mb-0.5 grid size-7 shrink-0 place-items-center rounded-full transition active:scale-90 ${
        busy ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-black/5'
      }`}
    >
      {status === 'loading' ? (
        <span className="size-3.5 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
      ) : status === 'playing' ? (
        <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5L6 9H3v6h3l5 4zM15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" />
        </svg>
      )}
    </button>
  )
}
