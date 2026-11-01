import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const upsert = (list, row, sortKey) => {
  const next = list.some((r) => r.id === row.id) ? list.map((r) => (r.id === row.id ? row : r)) : [row, ...list]
  return next.sort((a, b) => (a[sortKey] < b[sortKey] ? 1 : -1))
}

// Pedidos y conversaciones, con actualización en vivo
export function usePanelData() {
  const [orders, setOrders] = useState([])
  const [conversations, setConversations] = useState([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('conversations').select('*').order('last_message_at', { ascending: false }),
    ]).then(([o, c]) => {
      if (!alive) return
      setOrders(o.data ?? [])
      setConversations(c.data ?? [])
      setReady(true)
    })

    const channel = supabase
      .channel('panel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (p) => {
        if (p.eventType === 'DELETE') setOrders((l) => l.filter((r) => r.id !== p.old.id))
        else setOrders((l) => upsert(l, p.new, 'created_at'))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, (p) => {
        if (p.eventType === 'DELETE') setConversations((l) => l.filter((r) => r.id !== p.old.id))
        else setConversations((l) => upsert(l, p.new, 'last_message_at'))
      })
      .subscribe()

    return () => {
      alive = false
      supabase.removeChannel(channel)
    }
  }, [])

  return { orders, conversations, ready }
}
