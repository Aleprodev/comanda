import { db, addMessage, getMenu } from './db.js'
import { business, paymentMethods, paymentLabels, money } from './business.js'
import { createPaymentLink, watchPayment } from './payments/mercadopago.js'

export class OrderError extends Error {}

// Valida contra el menú real y calcula los precios: el modelo nunca decide un importe.
// Valida cada producto contra el menú y fija los precios. Lo usan tanto el cálculo previo
// (para mostrarle el total al cliente) como la creación del pedido.
export function priceItems(menu, rawItems) {
  const byId = new Map(menu.map((p) => [p.id, p]))

  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new OrderError('El pedido no tiene productos.')
  }

  return rawItems.map((it) => {
    const product = byId.get(it.product_id)
    if (!product) throw new OrderError(`El producto "${it.product_id}" no existe en el menú. Usá solo ids del menú.`)
    const qty = Number(it.qty)
    if (!Number.isInteger(qty) || qty < 1 || qty > 100) {
      throw new OrderError(`Cantidad inválida para ${product.name}.`)
    }
    const allowed = product.options?.['cocción']
    let coccion = it.coccion || null
    if (allowed) {
      if (!coccion) throw new OrderError(`Falta definir la cocción (${allowed.join(' o ')}) de ${product.name}.`)
      if (!allowed.includes(coccion)) throw new OrderError(`Cocción inválida para ${product.name}: ${allowed.join(' o ')}.`)
    } else {
      coccion = null
    }
    return {
      product_id: product.id,
      name: product.name,
      emoji: product.emoji,
      qty,
      unit_price: product.price,
      coccion,
      notes: it.notes || null,
    }
  })
}

export async function createOrder(conversationId, args) {
  const menu = await getMenu()
  const items = priceItems(menu, args.items)

  const fulfillment = args.fulfillment
  if (!['delivery', 'pickup'].includes(fulfillment)) throw new OrderError('Falta definir si es delivery o retiro.')
  const address = (args.address || '').trim()
  if (fulfillment === 'delivery' && !address) throw new OrderError('Falta la dirección de entrega.')

  const method = args.payment_method
  if (!paymentMethods().includes(method)) {
    throw new OrderError(`Medio de pago no disponible. Opciones: ${paymentMethods().map((m) => paymentLabels[m]).join(', ')}.`)
  }

  const subtotal = items.reduce((s, it) => s + it.unit_price * it.qty, 0)
  const delivery_fee = fulfillment === 'delivery' ? business.deliveryFee : 0
  const total = subtotal + delivery_fee
  const eta = fulfillment === 'delivery' ? business.etaDeliveryMin : business.etaPickupMin

  const { data: order, error } = await db
    .from('orders')
    .insert({
      conversation_id: conversationId,
      customer_name: args.customer_name || null,
      items,
      subtotal,
      delivery_fee,
      total,
      fulfillment,
      address: fulfillment === 'delivery' ? address : null,
      notes: args.notes || null,
      payment_method: method,
      eta_minutes: eta,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)

  if (args.customer_name) {
    await db.from('conversations').update({ customer_name: args.customer_name }).eq('id', conversationId)
  }

  await addMessage(conversationId, {
    role: 'bot',
    type: 'order_summary',
    content: orderText(order),
    meta: { order_id: order.id, order },
  })

  if (method === 'mercadopago') {
    order.payment_link_sent = await sendPaymentLink(order)
  }

  return order
}

// Un fallo de Mercado Pago no debe perder el pedido: se avisa y se ofrecen otros medios
async function sendPaymentLink(order) {
  try {
    const link = await createPaymentLink(order)
    watchPayment(order)
    await addMessage(order.conversation_id, {
      role: 'bot',
      type: 'payment_link',
      content: `Link de pago de Mercado Pago por ${money(order.total)}`,
      meta: { url: link.url, total: order.total, order_id: order.id, number: order.number },
    })
    return true
  } catch (err) {
    console.error('Mercado Pago:', err.message)
    await addMessage(order.conversation_id, {
      role: 'bot',
      content: `No pude generar el link de pago de Mercado Pago. Podés pagar por transferencia al alias ${business.transferAlias} o en efectivo al recibir.`,
    })
    return false
  }
}

export function orderText(o) {
  const lines = o.items.map((it) => {
    const extra = [it.coccion, it.notes].filter(Boolean).join(', ')
    return `${it.qty} × ${it.name}${extra ? ` (${extra})` : ''}`
  })
  return [
    `Pedido #${o.number}`,
    ...lines,
    o.fulfillment === 'delivery' ? `Envío a ${o.address}: ${money(o.delivery_fee)}` : 'Retiro en el local',
    `Total: ${money(o.total)}`,
    `Pago: ${paymentLabels[o.payment_method]}`,
  ].join('\n')
}
