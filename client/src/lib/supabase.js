import { createClient } from '@supabase/supabase-js'

// La publishable key es pública por diseño: el acceso real lo limita RLS (solo lectura).
const url = import.meta.env.VITE_SUPABASE_URL || 'https://luihahbvputtwwizihhq.supabase.co'
const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_A-z8gRy1YygJP2ltybZWHA_1MbEjGnp'

export const supabase = createClient(url, key, { auth: { persistSession: false } })
