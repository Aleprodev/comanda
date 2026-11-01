import OpenAI from 'openai'
import { db, addMessage, getMenu, getHistory, lastOrder } from '../db.js'
import { business, paymentMethods, paymentLabels, money } from '../business.js'
import { createOrder, priceItems, OrderError } from '../orders.js'

export class AiNotConfigured extends Error {}

let client
export function openai() {
  if (!process.env.OPENAI_API_KEY) throw new AiNotConfigured('Falta OPENAI_API_KEY')
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return client
}

const statusText = {
  new: 'recibido, todavía no entró a cocina',
  cooking: 'en cocina',
  ready: 'listo',
  delivered: 'entregado',
}

function systemPrompt(menu) {
  const methods = paymentMethods().map((m) => paymentLabels[m]).join(', ')
  const lines = menu.map((p) => {
    const opts = p.options?.['cocción'] ? ` [cocción: ${p.options['cocción'].join('/')}]` : ''
    return `- ${p.id} | ${p.name} | ${p.category} | ${money(p.price)}${opts}`
  })
  return `Sos el asistente de WhatsApp de ${business.name} (${business.tagline}, ${business.city}). Atendés a los clientes como lo haría un buen empleado del local: cálido, ágil y claro. Hablás en español rioplatense (vos), con mensajes cortos, como en WhatsApp. Usás pocos emojis. No usás markdown ni asteriscos ni listas con guiones: texto plano, y para listar usá una línea por ítem.

DATOS DEL NEGOCIO
- Horario: ${business.hours}.
- Delivery: ${money(business.deliveryFee)}, zonas: ${business.deliveryZones}. Demora aprox. ${business.etaDeliveryMin} min. Retiro por el local: ${business.etaPickupMin} min.
- Medios de pago disponibles: ${methods}. Transferencia al alias ${business.transferAlias} (${business.transferHolder}).

MENÚ (única fuente de verdad; nunca inventes productos ni precios)
${lines.join('\n')}

CÓMO TOMAR UN PEDIDO
1. Entendé lo que pide el cliente aunque lo diga desordenado ("una docena, 6 de carne y el resto de pollo" = 6 carne + 6 pollo). Una docena = 12.
2. Si algo es ambiguo o falta, preguntalo, de a una o dos cosas por mensaje: cocción de las empanadas (horno o frita), delivery o retiro, dirección, medio de pago, cantidad. Antes de preguntar, revisá TODO lo que el cliente ya dijo en la conversación y no repitas una pregunta ya respondida. Si dio una dirección o dijo "mandar", "enviar" o "llevar", es delivery; si dijo "retiro" o "paso a buscar", es retiro. Cuando ya tenés todos los datos, no pidas nada más: armá el resumen y pedí confirmación.
3. "Mitad y mitad": cargá UN solo ítem con el product_id de la pizza más cara de las dos, qty 1, y en notes escribí "mitad X / mitad Y" con los NOMBRES de las pizzas (por ejemplo "mitad Muzzarella / mitad Napolitana"), nunca con ids. Las notas siempre son texto legible para la cocina.
4. Antes de crear el pedido, llamá SIEMPRE a calcular_pedido y resumí todo (productos, envío, total y medio de pago) con los importes que devuelve, sin hacer cuentas vos: el total del resumen tiene que ser exactamente el "total" de esa herramienta. El resumen tiene una línea por producto, el costo de envío si hay y una línea final "Total: $X" con el importe en pesos de la herramienta; nunca se omite el total. Pedí confirmación explícita ("¿Lo confirmo?").
5. Solo cuando el cliente confirme, llamá a crear_pedido. Después de crearlo, avisale en una línea que ya está registrado y, según el medio de pago: Mercado Pago → el link aparece solo en el chat como un botón "Pagar", indicale que lo toque (si el resultado dice que no se pudo enviar, ofrecé transferencia o efectivo); transferencia → pasale el alias y pedile el comprobante; efectivo → que paga al recibir.
6. Si pide algo que no está en el menú, decilo con amabilidad y sugerí algo parecido del menú.
7. Si el cliente pregunta por su pedido, usá estado_pedido.
8. Si se enoja, reclama, pide hablar con una persona o es algo que no podés resolver, llamá a derivar_a_humano.
9. Si te escriben algo que no tiene que ver con el negocio, redirigí amablemente al pedido.

BOTONES DE RESPUESTA RÁPIDA
Tu respuesta final es UN solo objeto con "mensaje" (el texto) y "opciones" (los botones que ve el cliente debajo del mensaje). Un mensaje por turno, con una sola pregunta.
- Cuando tu pregunta tiene pocas respuestas posibles, ofrecelas como opciones: cocción de las empanadas (Al horno / Fritas), delivery o retiro (Delivery / Retiro en el local), medio de pago (solo los disponibles), una confirmación (Sí, confirmalo / Quiero cambiar algo), o elegir entre un par de productos.
- Máximo 4 opciones, textos cortos. Cada opción tiene que poder enviarse tal cual como la respuesta del cliente (por ejemplo "Al horno", "Delivery", "Sí, confirmalo").
- Si la pregunta es abierta (la dirección, el nombre, qué quiere pedir) o no preguntás nada, "opciones" va vacío.
- Nunca repitas las opciones dentro del texto del mensaje como lista: el texto pregunta y los botones responden.`
}

const replySchema = {
  name: 'respuesta',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['mensaje', 'opciones'],
    properties: {
      mensaje: { type: 'string' },
      opciones: { type: 'array', items: { type: 'string' } },
    },
  },
}

// Primer objeto JSON completo de un texto (a veces el modelo pega más de uno)
function firstJsonObject(s) {
  const start = s.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < s.length; i++) {
    const c = s[i]
    if (inString) {
      if (escaped) escaped = false
      else if (c === '\\') escaped = true
      else if (c === '"') inString = false
    } else if (c === '"') inString = true
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) return s.slice(start, i + 1)
  }
  return null
}

// El modelo responde en JSON. Se usa solo la primera respuesta: una pregunta por mensaje.
function parseReply(content) {
  const raw = String(content ?? '')
  try {
    const { mensaje, opciones } = JSON.parse(firstJsonObject(raw))
    return { text: String(mensaje ?? '').trim(), options: (opciones ?? []).map((o) => String(o).trim()).filter(Boolean).slice(0, 4) }
  } catch {
    return { text: raw.trim(), options: [] }
  }
}

const tools = [
  {
    type: 'function',
    function: {
      name: 'crear_pedido',
      description:
        'Registra el pedido confirmado por el cliente. Solo usarla después de que el cliente confirmó el resumen.',
      strict: true,
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['items', 'fulfillment', 'address', 'payment_method', 'customer_name', 'notes'],
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['product_id', 'qty', 'coccion', 'notes'],
              properties: {
                product_id: { type: 'string', description: 'id exacto del menú' },
                qty: { type: 'integer' },
                coccion: { type: ['string', 'null'], enum: ['horno', 'frita', null], description: 'Solo para empanadas' },
                notes: { type: ['string', 'null'] },
              },
            },
          },
          fulfillment: { type: 'string', enum: ['delivery', 'pickup'] },
          address: { type: ['string', 'null'], description: 'Obligatoria si es delivery' },
          payment_method: { type: 'string', enum: ['mercadopago', 'transfer', 'cash'] },
          customer_name: { type: ['string', 'null'] },
          notes: { type: ['string', 'null'], description: 'Aclaraciones generales del pedido' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calcular_pedido',
      description:
        'Calcula el total EXACTO del pedido con los precios del menú. Llamala siempre antes de mostrarle el resumen al cliente: el total que le digas tiene que ser el que devuelve esta herramienta.',
      strict: true,
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['items', 'fulfillment'],
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['product_id', 'qty', 'coccion', 'notes'],
              properties: {
                product_id: { type: 'string' },
                qty: { type: 'integer' },
                coccion: { type: ['string', 'null'], enum: ['horno', 'frita', null] },
                notes: { type: ['string', 'null'] },
              },
            },
          },
          fulfillment: { type: 'string', enum: ['delivery', 'pickup'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'derivar_a_humano',
      description: 'Pasa la conversación a una persona del local.',
      strict: true,
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['motivo'],
        properties: { motivo: { type: 'string' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'estado_pedido',
      description: 'Consulta el estado del último pedido de esta conversación.',
      strict: true,
      parameters: { type: 'object', additionalProperties: false, required: [], properties: {} },
    },
  },
]

function toOpenAiMessages(history) {
  const out = []
  for (const m of history) {
    if (m.role === 'customer') {
      out.push({ role: 'user', content: m.content || '(mensaje vacío)' })
    } else if (m.role === 'bot' && m.content) {
      out.push({ role: 'assistant', content: m.content })
    }
  }
  return out
}

async function runTool(conversationId, name, rawArgs) {
  let args
  try {
    args = JSON.parse(rawArgs || '{}')
  } catch {
    return { error: 'Argumentos inválidos.' }
  }

  if (name === 'calcular_pedido') {
    try {
      const items = priceItems(await getMenu(), args.items)
      const subtotal = items.reduce((s, it) => s + it.qty * it.unit_price, 0)
      const envio = args.fulfillment === 'delivery' ? business.deliveryFee : 0
      return {
        lineas: items.map((it) => ({ producto: it.name, cantidad: it.qty, precio_unitario: it.unit_price, subtotal: it.qty * it.unit_price })),
        subtotal,
        envio,
        total: subtotal + envio,
      }
    } catch (e) {
      if (e instanceof OrderError) return { error: e.message }
      throw e
    }
  }

  if (name === 'crear_pedido') {
    try {
      const o = await createOrder(conversationId, args)
      return {
        ok: true,
        numero: o.number,
        total: o.total,
        medio_pago: o.payment_method,
        entrega: o.fulfillment,
        demora_min: o.eta_minutes,
        alias_transferencia: o.payment_method === 'transfer' ? business.transferAlias : undefined,
        link_de_pago_enviado_al_chat: o.payment_method === 'mercadopago' ? o.payment_link_sent : undefined,
      }
    } catch (e) {
      if (e instanceof OrderError) return { error: e.message }
      throw e
    }
  }

  if (name === 'derivar_a_humano') {
    await db
      .from('conversations')
      .update({ needs_human: true, human_reason: args.motivo || null })
      .eq('id', conversationId)
    return { ok: true, mensaje: 'Una persona del local va a continuar la conversación.' }
  }

  if (name === 'estado_pedido') {
    const o = await lastOrder(conversationId)
    if (!o) return { error: 'Esta conversación no tiene pedidos.' }
    return { numero: o.number, estado: statusText[o.status], pago: o.payment_status, total: o.total }
  }

  return { error: `Herramienta desconocida: ${name}` }
}

// Corre el agente sobre el historial y guarda la respuesta del bot.
export async function runAgent(conversationId) {
  const ai = openai()
  const [menu, history] = await Promise.all([getMenu(), getHistory(conversationId)])
  const messages = [{ role: 'system', content: systemPrompt(menu) }, ...toOpenAiMessages(history)]
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const produced = []

  for (let i = 0; i < 6; i++) {
    const res = await ai.chat.completions.create({
      model,
      messages,
      tools,
      temperature: 0.4,
      response_format: { type: 'json_schema', json_schema: replySchema },
    })
    const msg = res.choices[0].message
    messages.push(msg)

    if (!msg.tool_calls?.length) {
      const reply = parseReply(msg.content)
      if (reply.text) {
        produced.push(await addMessage(conversationId, { role: 'bot', content: reply.text, meta: { options: reply.options } }))
      }
      return produced
    }

    for (const call of msg.tool_calls) {
      const result = await runTool(conversationId, call.function.name, call.function.arguments)
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) })
    }
  }

  produced.push(
    await addMessage(conversationId, {
      role: 'bot',
      content: 'Perdón, me trabé con tu pedido. ¿Me lo repetís?',
    }),
  )
  return produced
}
