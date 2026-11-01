// Datos de ejemplo para mostrar el panel de análisis.
//   npm run seed:demo -w server           carga 14 días de pedidos de ejemplo
//   npm run seed:demo -w server -- --clear  borra solo los datos de ejemplo
// Todo lo que carga queda marcado con phone = 'demo' en la conversación, así que --clear
// no toca pedidos reales.
import { randomUUID } from 'node:crypto'
import { db } from '../src/db.js'

const DAYS = 14
const NAMES = ['Lucía', 'Martín', 'Sofía', 'Mateo', 'Valentina', 'Joaquín', 'Camila', 'Tomás', 'Julieta', 'Nicolás', 'Agustina', 'Franco', 'Milagros', 'Bruno', 'Paula', 'Ezequiel']
const STREETS = ['Córdoba', 'Santa Fe', 'Mendoza', 'Pellegrini', 'Oroño', 'San Martín', 'Corrientes', 'Entre Ríos', 'Rioja', 'Sarmiento']

if (process.argv.includes('--clear')) {
  const { data, error } = await db.from('conversations').delete().eq('phone', 'demo').select('id')
  if (error) throw new Error(error.message)
  console.log(`Borradas ${data.length} conversaciones de ejemplo (con sus pedidos y mensajes).`)
  process.exit(0)
}

// Generador con semilla: el mismo resultado en cada corrida
let seed = 20261101
const rnd = () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
const between = (a, b) => a + rnd() * (b - a)
const weighted = (entries) => {
  let r = rnd() * entries.reduce((s, [, w]) => s + w, 0)
  for (const [v, w] of entries) if ((r -= w) <= 0) return v
  return entries[0][0]
}

const { data: menu, error: menuError } = await db.from('products').select('*').eq('available', true)
if (menuError) throw new Error(menuError.message)
const by = (cat) => menu.filter((p) => p.category === cat)
// Algunas pizzas se piden mucho más que otras
const pizzaWeights = { 'pz-muzza': 30, 'pz-napo': 22, 'pz-fugazzeta': 18, 'pz-especial': 12, 'pz-calabresa': 9, 'pz-4quesos': 6, 'pz-rucula': 3 }
const empWeights = { 'em-carne': 32, 'em-pollo': 22, 'em-jyq': 20, 'em-humita': 12, 'em-caprese': 8, 'em-verdura': 6 }
const byWeights = (cat, w) => weighted(by(cat).map((p) => [p, w[p.id] ?? 5]))

const line = (product, qty, extra = {}) => ({
  product_id: product.id,
  name: product.name,
  emoji: product.emoji,
  qty,
  unit_price: product.price,
  coccion: product.options?.['cocción'] ? (rnd() < 0.78 ? 'horno' : 'frita') : null,
  notes: null,
  ...extra,
})

function makeItems() {
  const items = []
  if (rnd() < 0.62) items.push(line(byWeights('pizzas', pizzaWeights), weighted([[1, 70], [2, 25], [3, 5]])))
  if (rnd() < 0.5 || items.length === 0) {
    const docenas = weighted([[6, 35], [12, 45], [18, 10], [24, 10]])
    items.push(line(byWeights('empanadas', empWeights), docenas / 2))
    if (rnd() < 0.6) items.push(line(byWeights('empanadas', empWeights), docenas / 2))
  }
  if (rnd() < 0.15) items.push(line(pick(by('minutas')), 1))
  if (rnd() < 0.42) items.push(line(pick(by('bebidas')), weighted([[1, 80], [2, 20]])))
  if (rnd() < 0.12) items.push(line(pick(by('postres')), 1))
  return items
}

const now = Date.now()
const startToday = new Date().setHours(0, 0, 0, 0)
const weekday = [1.2, 0.6, 0.6, 0.7, 0.85, 1.45, 1.65] // domingo..sábado
const hourWeights = [[19, 12], [20, 22], [21, 30], [22, 22], [23, 8]]

const convs = []
const orders = []

for (let d = DAYS - 1; d >= 0; d--) {
  const dayStart = startToday - d * 86400000
  const dow = new Date(dayStart).getDay()
  const growth = 1 + (DAYS - d) * 0.025 // el negocio viene creciendo
  const count = Math.round(11 * weekday[dow] * growth * between(0.85, 1.15))

  for (let i = 0; i < count; i++) {
    const hour = weighted(hourWeights)
    const created = dayStart + hour * 3600000 + between(0, 3300000)
    if (created > now - 60000) continue

    const items = makeItems()
    const delivery = rnd() < 0.68
    const subtotal = items.reduce((s, it) => s + it.qty * it.unit_price, 0)
    const fee = delivery ? 1500 : 0
    const method = weighted([['mercadopago', 46], ['transfer', 24], ['cash', 30]])
    const name = pick(NAMES)

    const prepMin = between(14, 28) + (hour >= 21 ? 6 : 0) + (dow === 5 || dow === 6 ? 4 : 0)
    const cooking = created + between(2, 6) * 60000
    const ready = created + prepMin * 60000
    const delivered = ready + between(delivery ? 12 : 4, delivery ? 26 : 12) * 60000
    const age = (now - created) / 60000
    const status = age > prepMin + 30 ? 'delivered' : age > prepMin ? 'ready' : age > 5 ? 'cooking' : 'new'

    const convId = randomUUID()
    convs.push({ id: convId, customer_name: name, phone: 'demo', needs_human: false, mode: 'bot', created_at: new Date(created - between(2, 9) * 60000).toISOString(), last_message_at: new Date(created).toISOString() })
    orders.push({
      conversation_id: convId,
      customer_name: name,
      items,
      subtotal,
      delivery_fee: fee,
      total: subtotal + fee,
      fulfillment: delivery ? 'delivery' : 'pickup',
      address: delivery ? `${pick(STREETS)} ${Math.round(between(100, 3900))}` : null,
      status,
      payment_method: method,
      payment_status: method === 'cash' && status !== 'delivered' ? 'pending' : 'paid',
      eta_minutes: delivery ? 40 : 25,
      created_at: new Date(created).toISOString(),
      cooking_at: status === 'new' ? null : new Date(cooking).toISOString(),
      ready_at: status === 'new' || status === 'cooking' ? null : new Date(ready).toISOString(),
      delivered_at: status === 'delivered' ? new Date(delivered).toISOString() : null,
      updated_at: new Date(Math.min(now, delivered)).toISOString(),
    })
  }
}

// Gente que escribe y no termina pidiendo (consultas, curiosos) y algunos reclamos
const extra = Math.round(orders.length * 0.4)
for (let i = 0; i < extra; i++) {
  const t = now - between(0, DAYS * 86400000)
  const handoff = rnd() < 0.18
  convs.push({
    id: randomUUID(),
    customer_name: pick(NAMES),
    phone: 'demo',
    needs_human: false,
    mode: handoff ? 'human' : 'bot',
    created_at: new Date(t).toISOString(),
    last_message_at: new Date(t).toISOString(),
  })
}

const chunk = (list, n) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n))
for (const part of chunk(convs, 200)) {
  const { error } = await db.from('conversations').insert(part)
  if (error) throw new Error('conversations: ' + error.message)
}
for (const part of chunk(orders, 200)) {
  const { error } = await db.from('orders').insert(part)
  if (error) throw new Error('orders: ' + error.message)
}
console.log(`Cargados ${orders.length} pedidos y ${convs.length} conversaciones de ejemplo (${DAYS} días).`)
process.exit(0)
