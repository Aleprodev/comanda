export const business = {
  name: 'Todo Chévere',
  tagline: 'Pizzas & empanadas',
  city: 'Rosario',
  hours: 'Todos los días de 19:00 a 23:30',
  deliveryFee: 1500,
  deliveryZones: 'Centro, Pichincha, Echesortu, Fisherton, Abasto y Alberdi',
  etaDeliveryMin: 40,
  etaPickupMin: 25,
  transferAlias: 'todochevere.pizza',
  transferHolder: 'Todo Chévere S.R.L.',
}

// Medios de pago realmente disponibles (Mercado Pago solo si hay credenciales)
export function paymentMethods() {
  const methods = ['transfer', 'cash']
  if (process.env.MP_ACCESS_TOKEN) methods.unshift('mercadopago')
  return methods
}

export const paymentLabels = {
  mercadopago: 'Mercado Pago',
  transfer: 'Transferencia',
  cash: 'Efectivo',
}

export const money = (n) => '$' + Number(n).toLocaleString('es-AR')
