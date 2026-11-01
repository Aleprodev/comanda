import crypto from 'node:crypto'

// Login mínimo del dueño: usuario y clave por entorno (por defecto admin / admin).
// El token es un HMAC con vencimiento; no hay base de usuarios.
const SESSION_MS = 12 * 60 * 60 * 1000
const secret = () => process.env.SESSION_SECRET || process.env.SUPABASE_SECRET_KEY || 'comanda-dev'
const sign = (payload) => crypto.createHmac('sha256', secret()).update(payload).digest('base64url')

// Se comparan hashes para que la comparación no dependa del largo ni se corte antes
const same = (a, b) => {
  const ha = crypto.createHash('sha256').update(String(a)).digest()
  const hb = crypto.createHash('sha256').update(String(b)).digest()
  return crypto.timingSafeEqual(ha, hb)
}

function makeToken() {
  const payload = `admin.${Date.now() + SESSION_MS}`
  return `${payload}.${sign(payload)}`
}

function validToken(token = '') {
  const [role, exp, sig] = token.split('.')
  if (role !== 'admin' || !exp || !sig) return false
  const expected = sign(`${role}.${exp}`)
  return sig.length === expected.length && same(sig, expected) && Date.now() < Number(exp)
}

export function requireAdmin(req, res, next) {
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  if (!validToken(token)) return res.status(401).json({ error: 'unauthorized' })
  next()
}

export function login(req, res) {
  const { user = '', password = '' } = req.body ?? {}
  const okUser = same(user, process.env.ADMIN_USER || 'admin')
  const okPass = same(password, process.env.ADMIN_PASSWORD || 'admin')
  if (!(okUser && okPass)) return res.status(401).json({ error: 'invalid_credentials' })
  res.json({ token: makeToken() })
}
