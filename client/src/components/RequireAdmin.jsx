import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { clearToken, getToken } from '../lib/auth.js'

// El panel solo se muestra con una sesión válida (el servidor lo confirma al entrar)
export default function RequireAdmin({ children }) {
  const [status, setStatus] = useState(getToken() ? 'checking' : 'denied')

  useEffect(() => {
    if (!getToken()) return
    api
      .checkAdmin()
      .then(() => setStatus('ok'))
      .catch(() => {
        clearToken()
        setStatus('denied')
      })
  }, [])

  if (status === 'denied') return <Navigate to="/login" replace />
  if (status === 'checking') return <div className="grid h-full place-items-center text-sm text-muted">Cargando…</div>
  return children
}
