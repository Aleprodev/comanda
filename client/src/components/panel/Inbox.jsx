import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { api } from '../../lib/api.js'

const ago = (iso) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'ahora'
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h`
}

function Thread({ conversation }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef(null)

  useEffect(() => {
    const merge = (rows) =>
      setMessages((prev) => {
        const map = new Map(prev.map((m) => [m.id, m]))
        for (const m of rows) map.set(m.id, m)
        return [...map.values()].sort((a, b) => a.id - b.id)
      })
    setMessages([])
    supabase.from('messages').select('*').eq('conversation_id', conversation.id).order('id').then(({ data }) => data && merge(data))
    const channel = supabase
      .channel(`thread-${conversation.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversation.id}` },
        (p) => merge([p.new]),
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [conversation.id])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  async function reply(e) {
    e.preventDefault()
    const value = text.trim()
    if (!value || busy) return
    setBusy(true)
    setText('')
    try {
      await api.staffReply(conversation.id, value)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {conversation.needs_human && (
        <div className="mx-4 mt-3 rounded-xl bg-warn/15 px-3 py-2 text-xs text-[#8a5300]">
          <b>Pide atención humana.</b> {conversation.human_reason}
        </div>
      )}
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {messages.map((m) => {
          const customer = m.role === 'customer'
          return (
            <div key={m.id} className={`flex ${customer ? 'justify-start' : 'justify-end'}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-1.5 text-[13px] leading-snug ${
                  customer
                    ? 'bg-white ring-1 ring-black/5'
                    : m.role === 'staff'
                      ? 'bg-accent text-white'
                      : 'bg-black/5 text-ink/80'
                }`}
              >
                {m.role === 'bot' && <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide opacity-50">Asistente</span>}
                {m.content}
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>
      <div className="border-t border-black/5 px-4 py-3">
        {conversation.mode === 'human' && (
          <button onClick={() => api.resume(conversation.id)} className="mb-2 text-xs font-medium text-accent hover:underline">
            Devolver al asistente
          </button>
        )}
        <form onSubmit={reply} className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Responder como el local…"
            className="min-w-0 flex-1 rounded-full bg-bg px-4 py-2 text-sm outline-none ring-1 ring-black/5 focus:ring-accent/50"
          />
          <button disabled={!text.trim() || busy} className="rounded-full bg-accent px-4 text-sm font-medium text-white disabled:opacity-30">
            Enviar
          </button>
        </form>
      </div>
    </div>
  )
}

export default function Inbox({ conversations, onClose }) {
  const [selectedId, setSelectedId] = useState(null)
  const sorted = [...conversations].sort(
    (a, b) => Number(b.needs_human) - Number(a.needs_human) || (a.last_message_at < b.last_message_at ? 1 : -1),
  )
  const selected = conversations.find((c) => c.id === selectedId)

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-black/20 backdrop-blur-[2px]" onClick={onClose}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col bg-surface shadow-2xl sm:rounded-l-3xl"
      >
        <header className="flex items-center justify-between border-b border-black/5 px-4 py-3">
          {selected ? (
            <button onClick={() => setSelectedId(null)} className="text-sm font-medium text-accent">
              ‹ Conversaciones
            </button>
          ) : (
            <h2 className="text-[15px] font-semibold tracking-tight">Conversaciones</h2>
          )}
          <button onClick={onClose} className="grid size-7 place-items-center rounded-full bg-bg text-muted" aria-label="Cerrar">
            ✕
          </button>
        </header>

        {selected ? (
          <Thread conversation={selected} />
        ) : (
          <ul className="flex-1 divide-y divide-line/50 overflow-y-auto">
            {sorted.length === 0 && <li className="p-8 text-center text-sm text-muted">Todavía no hay conversaciones.</li>}
            {sorted.map((c) => (
              <li key={c.id}>
                <button onClick={() => setSelectedId(c.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-bg">
                  <span className="grid size-9 place-items-center rounded-full bg-bg text-sm">👤</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{c.customer_name || `Cliente ${c.id.slice(0, 4)}`}</span>
                    <span className="block text-xs text-muted">
                      {c.mode === 'human' ? 'Atiende una persona' : 'Atiende el asistente'} · {ago(c.last_message_at)}
                    </span>
                  </span>
                  {c.needs_human && <span className="size-2.5 rounded-full bg-warn" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  )
}
