import { createClient } from '@supabase/supabase-js'

export const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const check = ({ data, error }) => {
  if (error) throw new Error(error.message)
  return data
}

export async function addMessage(conversationId, { role, type = 'text', content = '', meta = {} }) {
  const row = check(
    await db
      .from('messages')
      .insert({ conversation_id: conversationId, role, type, content, meta })
      .select()
      .single(),
  )
  await db.from('conversations').update({ last_message_at: row.created_at }).eq('id', conversationId)
  return row
}

export async function getConversation(id) {
  return check(await db.from('conversations').select('*').eq('id', id).maybeSingle())
}

export async function getMenu() {
  return check(
    await db.from('products').select('*').eq('available', true).order('sort', { ascending: true }),
  )
}

export async function getHistory(conversationId, limit = 24) {
  const rows = check(
    await db
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit),
  )
  return rows.reverse()
}

export async function lastOrder(conversationId) {
  return check(
    await db
      .from('orders')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  )
}
