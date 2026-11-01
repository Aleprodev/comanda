import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { api } from '../lib/api.js'
import Bubble from '../components/Bubble.jsx'
import Composer from '../components/Composer.jsx'
import { playSpeech } from '../lib/speech.js'

const STORAGE_KEY = 'comanda.conversation'

function Typing() {
  return (
    <div className="flex justify-start">
      <div className="flex gap-1 rounded-[20px] rounded-bl-md bg-white px-4 py-3 shadow-sm ring-1 ring-black/5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-1.5 animate-bounce rounded-full bg-muted/60" style={{ animationDelay: `${i * 120}ms` }} />
        ))}
      </div>
    </div>
  )
}

function Phone({ children }) {
  return (
    <div className="flex h-full items-center justify-center sm:p-6">
      <div className="flex h-full w-full flex-col overflow-hidden bg-bg sm:h-[780px] sm:max-h-full sm:w-[390px] sm:rounded-[48px] sm:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.35)] sm:ring-[10px] sm:ring-ink">
        {children}
      </div>
    </div>
  )
}

export default function Chat() {
  const [params, setParams] = useSearchParams()
  const [conversationId, setConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  // "Pedir" en la landing llega con el mensaje armado: queda en el input para que lo envíe
  const [text, setText] = useState(() => params.get('q') ?? '')
  const [waiting, setWaiting] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef(null)

  const paidOrderIds = new Set(messages.map((m) => m.meta?.paid_order_id).filter(Boolean))

  const merge = (incoming) =>
    setMessages((prev) => {
      const map = new Map(prev.map((m) => [m.id, m]))
      for (const m of incoming) map.set(m.id, m)
      return [...map.values()].sort((a, b) => a.id - b.id)
    })

  // Crea o recupera la conversación
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let id = localStorage.getItem(STORAGE_KEY)
      if (id) {
        const { data } = await supabase.from('conversations').select('id').eq('id', id).maybeSingle()
        if (!data) id = null
      }
      if (!id) {
        id = (await api.createConversation()).id
        localStorage.setItem(STORAGE_KEY, id)
      }
      if (!cancelled) setConversationId(id)
    })().catch(() => setError('No pudimos conectar con el local. Probá de nuevo en un momento.'))
    return () => {
      cancelled = true
    }
  }, [])

  // Al volver del checkout de Mercado Pago, confirma el pago sin esperar al webhook
  useEffect(() => {
    const paymentId = params.get('payment_id')
    if (paymentId) {
      api.verifyPayment(paymentId).catch(() => {})
    }
    if (paymentId || params.has('pago') || params.has('q')) setParams({}, { replace: true })
  }, [])

  // Historial + mensajes en vivo
  useEffect(() => {
    if (!conversationId) return
    supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('id')
      .then(({ data }) => data && merge(data))

    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => merge([payload.new]),
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [conversationId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, waiting])

  // Texto, audio y foto comparten el mismo circuito: se envía, el servidor responde y se muestra
  async function deliver(request) {
    if (waiting || !conversationId) return
    setError('')
    setWaiting(true)
    try {
      const res = await request()
      merge(res.messages)
      return res
    } catch (err) {
      if (err.data?.messages) merge(err.data.messages)
      setError(
        err.data?.error === 'ai_not_configured'
          ? 'El asistente todavía no está disponible.'
          : 'No se pudo enviar. Probá de nuevo.',
      )
    } finally {
      setWaiting(false)
    }
  }

  function sendText(e) {
    e.preventDefault()
    const value = text.trim()
    if (!value) return
    setText('')
    deliver(() => api.sendText(conversationId, value))
  }

  return (
    <Phone>
      <header className="flex items-center gap-3 border-b border-black/5 bg-white/80 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl sm:pt-9">
        <Link to="/" aria-label="Volver al menú" className="-ml-1 text-2xl leading-none text-accent">
          ‹
        </Link>
        <div className="grid size-10 place-items-center rounded-full bg-linear-to-b from-[#ffd36e] to-warn text-xl">🍕</div>
        <div className="leading-tight">
          <p className="text-[15px] font-semibold tracking-tight">Todo Chévere</p>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <span className="size-1.5 rounded-full bg-ok" /> en línea
          </p>
        </div>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
        {messages.map((m) => (
          <Bubble
            key={m.id}
            message={m}
            paidOrderIds={paidOrderIds}
            showOptions={m.id === messages[messages.length - 1].id && !waiting}
            onPick={(option) => deliver(() => api.sendText(conversationId, option))}
          />
        ))}
        {waiting && <Typing />}
        <div ref={endRef} />
      </div>

      {error && <p className="px-4 pb-1 text-center text-xs text-danger">{error}</p>}

      <Composer
        text={text}
        setText={setText}
        busy={waiting || !conversationId}
        onText={sendText}
        onAudio={async (blob, seconds) => {
          const res = await deliver(() => api.sendAudio(conversationId, blob, seconds))
          // Si hablás, el asistente te responde hablando (como en WhatsApp)
          const reply = res?.messages.findLast((m) => m.role === 'bot' && m.type === 'text')
          if (reply) playSpeech(reply.id)
        }}
        onImage={(blob) => deliver(() => api.sendImage(conversationId, blob))}
      />
    </Phone>
  )
}
