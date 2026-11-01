import multer from 'multer'
import { toFile } from 'openai'
import { db, addMessage, getConversation } from './db.js'
import { openai, runAgent, AiNotConfigured } from './ai/agent.js'
import { money } from './business.js'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } })

const extFor = (mime = '') => {
  if (mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac')) return 'm4a'
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('wav')) return 'wav'
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3'
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  if (mime.includes('webm')) return 'webm'
  return 'jpg'
}

async function storeFile(conversationId, buffer, mime) {
  const path = `${conversationId}/${Date.now()}.${extFor(mime)}`
  const { error } = await db.storage.from('attachments').upload(path, buffer, { contentType: mime })
  if (error) throw new Error('Storage: ' + error.message)
  return db.storage.from('attachments').getPublicUrl(path).data.publicUrl
}

async function transcribe(buffer, mime) {
  const file = await toFile(buffer, `audio.${extFor(mime)}`, { type: mime })
  const res = await openai().audio.transcriptions.create({
    file,
    model: process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe',
    language: 'es',
    prompt: 'Pedido a una pizzería argentina: pizza muzzarella, napolitana, fugazzeta, calabresa, empanadas de carne, pollo, jamón y queso, humita, caprese, verdura, al horno o fritas, delivery, retiro, Mercado Pago, transferencia, efectivo.',
  })
  return (res.text ?? '').trim()
}

const imageSchema = {
  name: 'analisis_imagen',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['kind', 'monto', 'destinatario', 'fecha', 'texto_pedido', 'resumen'],
    properties: {
      kind: { type: 'string', enum: ['comprobante', 'lista_pedido', 'otro'] },
      monto: { type: ['number', 'null'], description: 'Importe en pesos, sin símbolo, con punto decimal' },
      destinatario: { type: ['string', 'null'] },
      fecha: { type: ['string', 'null'] },
      texto_pedido: { type: ['string', 'null'], description: 'Transcripción de la lista de pedido' },
      resumen: { type: 'string', description: 'Una frase que describe la imagen' },
    },
  },
}

async function analyzeImage(buffer, mime) {
  const res = await openai().chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    temperature: 0,
    response_format: { type: 'json_schema', json_schema: imageSchema },
    messages: [
      {
        role: 'system',
        content:
          'Analizás imágenes que un cliente de una pizzería argentina envía por WhatsApp. ' +
          '"comprobante": captura o foto de una transferencia o pago (banco, Mercado Pago, otra billetera); extraé el monto total en pesos, el destinatario y la fecha. ' +
          '"lista_pedido": una lista escrita (a mano o en texto) con lo que quiere pedir; transcribila completa en texto_pedido. ' +
          '"otro": cualquier otra cosa. Si un dato no se ve con claridad, devolvé null: no lo inventes.',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Analizá esta imagen.' },
          { type: 'image_url', image_url: { url: `data:${mime};base64,${buffer.toString('base64')}` } },
        ],
      },
    ],
  })
  return JSON.parse(res.choices[0].message.content)
}

// Compara el comprobante con el último pedido por transferencia que espera pago
async function checkReceipt(conv, analysis) {
  const say = (content, extra = {}) => addMessage(conv.id, { role: 'bot', content, ...extra })

  const { data: order } = await db
    .from('orders')
    .select('*')
    .eq('conversation_id', conv.id)
    .eq('payment_method', 'transfer')
    .eq('payment_status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!order) {
    return [await say('Recibí tu comprobante, pero no tengo ningún pedido por transferencia esperando el pago. ¿Querés hacer un pedido?')]
  }
  if (analysis.monto == null) {
    return [await say(`No pude leer el monto del comprobante. ¿Me confirmás cuánto transferiste? El total del pedido #${order.number} es ${money(order.total)}.`)]
  }

  const receipt = { monto: analysis.monto, destinatario: analysis.destinatario, fecha: analysis.fecha }
  if (Math.abs(analysis.monto - order.total) <= 1) {
    await db
      .from('orders')
      .update({ payment_status: 'paid', payment_meta: { receipt, verified_by: 'ai_receipt' }, updated_at: new Date().toISOString() })
      .eq('id', order.id)
    return [
      await say(`¡Recibimos tu transferencia de ${money(analysis.monto)}! Tu pedido #${order.number} ya está pago ✅`, {
        type: 'status',
        meta: { paid_order_id: order.id },
      }),
    ]
  }

  await db
    .from('orders')
    .update({ payment_status: 'mismatch', payment_meta: { receipt, expected: order.total }, updated_at: new Date().toISOString() })
    .eq('id', order.id)
  await db.from('conversations').update({ needs_human: true, human_reason: `Transferencia de ${money(analysis.monto)} para un pedido de ${money(order.total)}` }).eq('id', conv.id)
  return [
    await say(`Vi una transferencia por ${money(analysis.monto)}, pero el total del pedido #${order.number} es ${money(order.total)}. Ya avisé al local para que lo revise y te confirme.`),
  ]
}

export function registerMediaRoutes(app, wrap) {
  const guard = (fn) =>
    wrap(async (req, res) => {
      try {
        await fn(req, res)
      } catch (err) {
        if (err instanceof AiNotConfigured) return res.status(503).json({ error: 'ai_not_configured' })
        throw err
      }
    })

  // Nota de voz: se transcribe y el texto entra al agente como si lo hubiera escrito
  app.post(
    '/api/chat/:id/audio',
    upload.single('audio'),
    guard(async (req, res) => {
      const conv = await getConversation(req.params.id)
      if (!conv) return res.status(404).json({ error: 'conversation_not_found' })
      if (!req.file?.size) return res.status(400).json({ error: 'empty_audio' })

      const mime = req.file.mimetype || 'audio/webm'
      const transcript = await transcribe(req.file.buffer, mime)
      const url = await storeFile(conv.id, req.file.buffer, mime)
      const customer = await addMessage(conv.id, {
        role: 'customer',
        type: 'audio',
        content: transcript,
        meta: { url, transcript, seconds: Number(req.body?.seconds) || null },
      })

      if (!transcript) {
        const bot = await addMessage(conv.id, { role: 'bot', content: 'No llegué a escuchar el audio. ¿Lo grabás de nuevo o me lo escribís?' })
        return res.json({ messages: [customer, bot] })
      }
      if (conv.mode === 'human') return res.json({ messages: [customer] })
      res.json({ messages: [customer, ...(await runAgent(conv.id))] })
    }),
  )

  // Foto: comprobante de transferencia, lista escrita a mano u otra cosa
  app.post(
    '/api/chat/:id/image',
    upload.single('image'),
    guard(async (req, res) => {
      const conv = await getConversation(req.params.id)
      if (!conv) return res.status(404).json({ error: 'conversation_not_found' })
      if (!req.file?.size) return res.status(400).json({ error: 'empty_image' })

      const mime = req.file.mimetype?.startsWith('image/') ? req.file.mimetype : 'image/jpeg'
      const analysis = await analyzeImage(req.file.buffer, mime)
      const url = await storeFile(conv.id, req.file.buffer, mime)

      const content =
        analysis.kind === 'comprobante'
          ? `Comprobante de transferencia${analysis.monto != null ? ` por ${money(analysis.monto)}` : ''}`
          : analysis.kind === 'lista_pedido'
            ? `[Foto con la lista del pedido] ${analysis.texto_pedido ?? ''}`.trim()
            : `[El cliente mandó una foto: ${analysis.resumen}]`

      const customer = await addMessage(conv.id, {
        role: 'customer',
        type: 'image',
        content,
        meta: { url, kind: analysis.kind, caption: analysis.kind === 'lista_pedido' ? analysis.texto_pedido : analysis.resumen, analysis },
      })

      if (conv.mode === 'human') return res.json({ messages: [customer] })
      const bot = analysis.kind === 'comprobante' ? await checkReceipt(conv, analysis) : await runAgent(conv.id)
      res.json({ messages: [customer, ...bot], analysis: { kind: analysis.kind } })
    }),
  )
}
