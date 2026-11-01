import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { setToken } from '../lib/auth.js'

export default function Login() {
  const navigate = useNavigate()
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { token } = await api.login(user.trim(), password)
      setToken(token)
      navigate('/panel', { replace: true })
    } catch (err) {
      setError(err.message === 'invalid_credentials' ? 'Usuario o contraseña incorrectos.' : 'No pudimos iniciar sesión. Probá de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  const field =
    'w-full rounded-xl bg-bg px-4 py-3 text-[15px] outline-none ring-1 ring-black/5 placeholder:text-muted focus:ring-2 focus:ring-accent/50'

  return (
    <main className="grid min-h-full place-items-center bg-linear-to-b from-[#fff3dc] via-[#fff9ef] to-bg px-5 py-10">
      <form onSubmit={submit} className="w-full max-w-sm rounded-[32px] bg-surface p-8 shadow-xl shadow-black/5 ring-1 ring-black/5">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-linear-to-b from-[#ffd36e] to-warn text-3xl">🍕</div>
        <h1 className="mt-5 text-center text-2xl font-semibold tracking-tight">Panel del local</h1>
        <p className="mt-1 text-center text-[14px] text-muted">Acceso solo para el dueño de Todo Chévere</p>

        <div className="mt-7 space-y-3">
          <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="Usuario" autoComplete="username" autoCapitalize="none" autoFocus className={field} />
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" type="password" autoComplete="current-password" className={field} />
        </div>

        {error && (
          <p role="alert" className="mt-3 text-center text-[13px] text-danger">
            {error}
          </p>
        )}

        <button
          disabled={busy || !user || !password}
          className="mt-5 w-full rounded-full bg-accent py-3 text-[15px] font-medium text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
        >
          {busy ? 'Entrando…' : 'Entrar'}
        </button>

        <Link to="/" className="mt-5 block text-center text-[13px] text-accent hover:underline">
          ‹ Volver al sitio
        </Link>
      </form>
    </main>
  )
}
