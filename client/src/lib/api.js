async function request(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.message || data.error || 'request_failed'), { data })
  return data
}

// Los archivos van como multipart: el navegador pone el Content-Type con su boundary
async function upload(path, form) {
  const res = await fetch(path, { method: 'POST', body: form })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error || 'upload_failed'), { data })
  return data
}

const audioExt = (type = '') => (type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm')

export const api = {
  sendAudio: (conversationId, blob, seconds) => {
    const form = new FormData()
    form.append('audio', blob, `nota.${audioExt(blob.type)}`)
    form.append('seconds', String(seconds))
    return upload(`/api/chat/${conversationId}/audio`, form)
  },
  sendImage: (conversationId, blob) => {
    const form = new FormData()
    form.append('image', blob, 'foto.jpg')
    return upload(`/api/chat/${conversationId}/image`, form)
  },
  createConversation: () => request('/api/conversations', { method: 'POST' }),
  sendText: (conversationId, text) =>
    request(`/api/chat/${conversationId}`, { method: 'POST', body: JSON.stringify({ text }) }),
  getBusiness: () => request('/api/business'),
  verifyPayment: (paymentId) => request(`/api/payments/verify?payment_id=${encodeURIComponent(paymentId)}`),
  updateOrder: (orderId, patch) =>
    request(`/api/orders/${orderId}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  staffReply: (conversationId, text) =>
    request(`/api/conversations/${conversationId}/staff`, { method: 'POST', body: JSON.stringify({ text }) }),
  resume: (conversationId) => request(`/api/conversations/${conversationId}/resume`, { method: 'POST' }),
}

export const money = (n) => '$' + Number(n).toLocaleString('es-AR')
