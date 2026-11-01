import { MercadoPagoConfig, Preference, Payment } from 'mercadopago'
import { db, addMessage } from '../db.js'

export const mpConfigured = () => Boolean(process.env.MP_ACCESS_TOKEN)

const config = () => new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN })
const baseUrl = () => (process.env.PUBLIC_URL || '').replace(/\/$/, '')

// Crea el link de Checkout Pro con el detalle exacto del pedido
export async function createPaymentLink(order) {
  const base = baseUrl()
  const secure = base.startsWith('https://')

  const items = order.items.map((it) => ({
    id: it.product_id,
    title: it.name,
    quantity: it.qty,
    unit_price: it.unit_price,
    currency_id: 'ARS',
  }))
  if (order.delivery_fee > 0) {
    items.push({ id: 'envio', title: 'Envío', quantity: 1, unit_price: order.delivery_fee, currency_id: 'ARS' })
  }

  const body = {
    items,
    external_reference: order.id,
    statement_descriptor: 'TODO CHEVERE',
    back_urls: {
      success: `${base}/pedir?pago=ok`,
      pending: `${base}/pedir?pago=pendiente`,
      failure: `${base}/pedir?pago=error`,
    },
  }
  // Mercado Pago solo acepta auto_return y webhooks con URLs públicas HTTPS
  if (secure) {
    body.auto_return = 'approved'
    body.notification_url = `${base}/api/webhooks/mercadopago`
  }

  const pref = await new Preference(config()).create({ body })
  await db.from('orders').update({ mp_preference_id: pref.id }).eq('id', order.id)
  return { id: pref.id, url: pref.init_point }
}

// El webhook no puede llegar a localhost ni a un servidor caído, así que además se consulta
// activamente: cada pedido con link de pago se vigila hasta que se acredite o pasen 30 minutos.
const WATCH_INTERVAL_MS = 4000
const WATCH_MAX_MS = 30 * 60 * 1000
const watching = new Set()

export function watchPayment(order) {
  if (!mpConfigured() || watching.has(order.id)) return
  watching.add(order.id)
  const deadline = new Date(order.created_at).getTime() + WATCH_MAX_MS

  const tick = async () => {
    let finished = false
    try {
      const res = await new Payment(config()).search({
        options: { external_reference: order.id, criteria: 'desc', sort: 'date_created' },
      })
      const approved = res.results?.find((p) => p.status === 'approved')
      if (approved) {
        await syncPayment(approved.id)
        finished = true
      }
    } catch (err) {
      console.error('Vigilancia de pago MP:', err.message)
    }
    if (finished || Date.now() > deadline) watching.delete(order.id)
    else setTimeout(tick, WATCH_INTERVAL_MS)
  }
  setTimeout(tick, WATCH_INTERVAL_MS)
}

// Al arrancar, retoma la vigilancia de los pedidos que quedaron esperando un pago
export async function resumeWatchers() {
  if (!mpConfigured()) return
  const since = new Date(Date.now() - WATCH_MAX_MS).toISOString()
  const { data } = await db
    .from('orders')
    .select('*')
    .eq('payment_method', 'mercadopago')
    .eq('payment_status', 'pending')
    .gte('created_at', since)
  data?.forEach(watchPayment)
}

async function markPaid(order, payment) {
  // El filtro hace la operación idempotente: webhook y verificación pueden llegar los dos
  const { data } = await db
    .from('orders')
    .update({
      payment_status: 'paid',
      payment_meta: { payment_id: payment.id, status: payment.status, amount: payment.transaction_amount },
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)
    .neq('payment_status', 'paid')
    .select()
  if (data?.length) {
    await addMessage(order.conversation_id, {
      role: 'bot',
      type: 'status',
      content: `¡Recibimos el pago de tu pedido #${order.number}! 💳`,
      meta: { paid_order_id: order.id },
    })
  }
}

// Consulta el pago a Mercado Pago (nunca se confía en lo que manda el cliente) y actualiza el pedido
export async function syncPayment(paymentId) {
  const payment = await new Payment(config()).get({ id: paymentId })
  if (!payment?.external_reference) return null

  const { data: order } = await db.from('orders').select('*').eq('id', payment.external_reference).maybeSingle()
  if (!order || order.payment_method !== 'mercadopago') return null

  if (payment.status === 'approved') {
    if (Math.round(payment.transaction_amount) === order.total) {
      await markPaid(order, payment)
    } else {
      await db
        .from('orders')
        .update({ payment_status: 'mismatch', payment_meta: { payment_id: payment.id, amount: payment.transaction_amount } })
        .eq('id', order.id)
    }
  }
  return { order_id: order.id, status: payment.status }
}
