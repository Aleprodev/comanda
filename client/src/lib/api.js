async function request(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.message || data.error || 'request_failed'), { data })
  return data
}

export const api = {
  createConversation: () => request('/api/conversations', { method: 'POST' }),
  sendText: (conversationId, text) =>
    request(`/api/chat/${conversationId}`, { method: 'POST', body: JSON.stringify({ text }) }),
  updateOrder: (orderId, patch) =>
    request(`/api/orders/${orderId}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  staffReply: (conversationId, text) =>
    request(`/api/conversations/${conversationId}/staff`, { method: 'POST', body: JSON.stringify({ text }) }),
  resume: (conversationId) => request(`/api/conversations/${conversationId}/resume`, { method: 'POST' }),
}

export const money = (n) => '$' + Number(n).toLocaleString('es-AR')
