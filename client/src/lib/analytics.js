export const RANGES = [
  { key: 'today', label: 'Hoy', days: 1 },
  { key: '7d', label: '7 días', days: 7 },
  { key: '30d', label: '30 días', days: 30 },
  { key: 'all', label: 'Todo', days: null },
]

const DAY = 86400000
const startOfDay = (t) => new Date(t).setHours(0, 0, 0, 0)

const sum = (list, f) => list.reduce((s, x) => s + f(x), 0)
const pct = (a, b) => (b ? (a / b) * 100 : null)

// Variación contra el período anterior: null si no hay con qué comparar
const change = (cur, prev) => (prev ? ((cur - prev) / prev) * 100 : null)

export function dayLabel(t) {
  return new Date(t).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', '')
}

export function compute({ orders, conversations, products, range, now }) {
  const def = RANGES.find((r) => r.key === range)
  const today = startOfDay(now)
  const firstOrder = orders.length ? Math.min(...orders.map((o) => new Date(o.created_at).getTime())) : today
  const start = def.days ? today - (def.days - 1) * DAY : startOfDay(firstOrder)
  const end = today + DAY
  const length = end - start
  const prevStart = def.days ? start - length : null

  const inRange = (t, a, b) => t >= a && t < b
  const cur = orders.filter((o) => inRange(new Date(o.created_at).getTime(), start, end))
  // Se compara contra el mismo tramo ya transcurrido del período anterior (ayer hasta esta hora,
  // la semana pasada hasta este día): así hoy, que no terminó, no parece una caída
  const elapsed = Math.min(length, now - start)
  const prev = prevStart ? orders.filter((o) => inRange(new Date(o.created_at).getTime(), prevStart, prevStart + elapsed)) : []

  // Evolución de ventas: por hora si es "hoy", por día en el resto
  const hourly = range === 'today'
  const binMs = hourly ? 3600000 : DAY
  // "Hoy" llega hasta la hora actual: las horas futuras no son un cero real
  const bins = hourly ? new Date(now).getHours() + 1 : Math.max(1, Math.round(length / DAY))
  const binStart = hourly ? today : start
  const makeSeries = (list, from) => {
    const s = Array.from({ length: bins }, (_, i) => ({
      t: from + i * binMs,
      label: hourly ? `${String(i).padStart(2, '0')}:00` : dayLabel(from + i * binMs),
      value: 0,
      orders: 0,
    }))
    for (const o of list) {
      const i = Math.floor((new Date(o.created_at).getTime() - from) / binMs)
      if (s[i]) {
        s[i].value += o.total
        s[i].orders += 1
      }
    }
    return s
  }
  const series = makeSeries(cur, binStart)
  // El último día del período es hoy y todavía no terminó: no es una caída real
  if (!hourly) Object.assign(series[series.length - 1], { partial: true, label: `${series[series.length - 1].label} · hoy` })
  const prevSeries = prevStart ? makeSeries(prev, prevStart) : null

  // Totales
  const sales = sum(cur, (o) => o.total)
  const prevSales = sum(prev, (o) => o.total)
  const ticket = cur.length ? sales / cur.length : 0
  const prevTicket = prev.length ? prevSales / prev.length : 0

  const prepMinutes = (list) => {
    const times = list.filter((o) => o.ready_at).map((o) => (new Date(o.ready_at) - new Date(o.created_at)) / 60000)
    return times.length ? sum(times, (x) => x) / times.length : null
  }

  // Conversaciones del período: cuántas terminaron en pedido y cuántas resolvió el asistente
  const convs = conversations.filter((c) => inRange(new Date(c.created_at).getTime(), start, end))
  const withOrder = new Set(cur.map((o) => o.conversation_id))
  const handed = convs.filter((c) => c.needs_human || c.mode === 'human').length

  // Mapa de calor: día de la semana (lunes = 0) por hora
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0))
  for (const o of cur) {
    const d = new Date(o.created_at)
    grid[(d.getDay() + 6) % 7][d.getHours()] += 1
  }
  const hoursWith = cur.map((o) => new Date(o.created_at).getHours())
  const hFrom = Math.min(18, ...hoursWith)
  const hTo = Math.max(23, ...hoursWith)

  // Productos y categorías
  const catOf = new Map(products.map((p) => [p.id, p.category]))
  const byProduct = new Map()
  const byCategory = new Map()
  for (const o of cur) {
    for (const it of o.items) {
      const p = byProduct.get(it.product_id) ?? { id: it.product_id, name: it.name, emoji: it.emoji, units: 0, revenue: 0 }
      p.units += it.qty
      p.revenue += it.qty * it.unit_price
      byProduct.set(it.product_id, p)
      const cat = catOf.get(it.product_id) ?? 'otros'
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + it.qty * it.unit_price)
    }
  }

  const count = (key, values) => values.map((v) => ({ key: v, value: cur.filter((o) => o[key] === v).length }))

  return {
    hourly,
    series,
    prevSeries,
    sales,
    salesChange: change(sales, prevSales),
    orders: cur.length,
    ordersChange: change(cur.length, prev.length),
    ticket,
    ticketChange: change(ticket, prevTicket),
    prep: prepMinutes(cur),
    prepPrev: prepMinutes(prev),
    conversations: convs.length,
    conversion: pct(convs.filter((c) => withOrder.has(c.id)).length, convs.length),
    automation: convs.length ? pct(convs.length - handed, convs.length) : null,
    heat: { grid, hFrom, hTo, max: Math.max(1, ...grid.flat()) },
    products: [...byProduct.values()],
    categories: [...byCategory.entries()].map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value),
    payments: count('payment_method', ['mercadopago', 'transfer', 'cash']),
    fulfillment: count('fulfillment', ['delivery', 'pickup']),
  }
}
