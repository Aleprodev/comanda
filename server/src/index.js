import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { db, addMessage, getConversation } from './db.js'
import { business } from './business.js'
import { runAgent, AiNotConfigured } from './ai/agent.js'

const app = express()
app.use(express.json({ limit: '1mb' }))

const wrap = (fn) => (req, res) =>
  Promise.resolve(fn(req, res)).catch((err) => {
    console.error(err)
    res.status(500).json({ error: 'server_error', message: err.message })
  })

app.get('/api/health', (_req, res) =>
  res.json({ ok: true, ai: Boolean(process.env.OPENAI_API_KEY), mercadopago: Boolean(process.env.MP_ACCESS_TOKEN) }),
)

// Nueva conversación con el saludo del local
app.post(
  '/api/conversations',
  wrap(async (_req, res) => {
    const { data: conv, error } = await db.from('conversations').insert({}).select().single()
    if (error) throw new Error(error.message)
    await addMessage(conv.id, {
      role: 'bot',
      content: `¡Hola! Soy el asistente de ${business.name} 🍕 Contame qué te gustaría pedir y te lo armo en un minuto.`,
    })
    res.json({ id: conv.id })
  }),
)

// Mensaje de texto del cliente
app.post(
  '/api/chat/:id',
  wrap(async (req, res) => {
    const text = String(req.body?.text ?? '').trim().slice(0, 2000)
    if (!text) return res.status(400).json({ error: 'empty_message' })

    const conv = await getConversation(req.params.id)
    if (!conv) return res.status(404).json({ error: 'conversation_not_found' })

    const customer = await addMessage(conv.id, { role: 'customer', content: text })
    if (conv.mode === 'human') return res.json({ messages: [customer] })

    try {
      const bot = await runAgent(conv.id)
      res.json({ messages: [customer, ...bot] })
    } catch (err) {
      if (err instanceof AiNotConfigured) {
        return res.status(503).json({ error: 'ai_not_configured', messages: [customer] })
      }
      console.error(err)
      const fallback = await addMessage(conv.id, {
        role: 'bot',
        content: 'Uy, tuve un problema para responderte. ¿Me lo escribís de nuevo?',
      })
      res.json({ messages: [customer, fallback] })
    }
  }),
)

const ORDER_STATUSES = ['new', 'cooking', 'ready', 'delivered']

const statusMessages = {
  cooking: (o) => `🔥 Tu pedido #${o.number} ya está en cocina.`,
  ready: (o) =>
    o.fulfillment === 'delivery'
      ? `🛵 ¡Tu pedido #${o.number} salió! Llega en unos minutos.`
      : `✅ Tu pedido #${o.number} está listo para retirar.`,
  delivered: () => `¡Gracias por elegir ${business.name}! Que lo disfrutes 🍕`,
}

// Panel: cambia el estado o el pago de un pedido y avisa al cliente por el chat
app.patch(
  '/api/orders/:id',
  wrap(async (req, res) => {
    const { status, payment_status } = req.body ?? {}
    const patch = { updated_at: new Date().toISOString() }
    if (status !== undefined) {
      if (!ORDER_STATUSES.includes(status)) return res.status(400).json({ error: 'invalid_status' })
      patch.status = status
    }
    if (payment_status !== undefined) {
      if (!['pending', 'paid'].includes(payment_status)) return res.status(400).json({ error: 'invalid_payment_status' })
      patch.payment_status = payment_status
    }

    const { data: before } = await db.from('orders').select('*').eq('id', req.params.id).maybeSingle()
    if (!before) return res.status(404).json({ error: 'order_not_found' })

    const { data: order, error } = await db.from('orders').update(patch).eq('id', before.id).select().single()
    if (error) throw new Error(error.message)

    if (status && status !== before.status && statusMessages[status]) {
      await addMessage(order.conversation_id, { role: 'bot', type: 'status', content: statusMessages[status](order) })
    }
    if (payment_status === 'paid' && before.payment_status !== 'paid') {
      await addMessage(order.conversation_id, {
        role: 'bot',
        type: 'status',
        content: `¡Recibimos el pago de tu pedido #${order.number}! 💳`,
      })
    }
    res.json({ order })
  }),
)

// Panel: una persona del local responde y el bot deja de contestar en esa conversación
app.post(
  '/api/conversations/:id/staff',
  wrap(async (req, res) => {
    const text = String(req.body?.text ?? '').trim().slice(0, 2000)
    if (!text) return res.status(400).json({ error: 'empty_message' })
    const conv = await getConversation(req.params.id)
    if (!conv) return res.status(404).json({ error: 'conversation_not_found' })

    const message = await addMessage(conv.id, { role: 'staff', content: text })
    await db.from('conversations').update({ mode: 'human', needs_human: false }).eq('id', conv.id)
    res.json({ message })
  }),
)

// Panel: devuelve la conversación al asistente
app.post(
  '/api/conversations/:id/resume',
  wrap(async (req, res) => {
    const { error } = await db
      .from('conversations')
      .update({ mode: 'bot', needs_human: false, human_reason: null })
      .eq('id', req.params.id)
    if (error) throw new Error(error.message)
    res.json({ ok: true })
  }),
)

// En producción el mismo servidor entrega el build del cliente
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist')
if (existsSync(dist)) {
  app.use(express.static(dist))
  app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}

const port = Number(process.env.PORT) || 3000
app.listen(port, () => console.log(`Comanda server en http://localhost:${port}`))
