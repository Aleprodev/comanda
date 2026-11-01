import { useEffect, useState } from 'react'
import { api } from './api.js'

// Un solo audio a la vez: si arranca otro, el anterior se corta
let current = null // { id, audio }
let state = null // { id, status: 'loading' | 'playing' }
const listeners = new Set()
const notify = (next) => {
  state = next
  listeners.forEach((fn) => fn(next))
}

export function stopSpeech() {
  current?.audio.pause()
  current = null
  notify(null)
}

export async function playSpeech(messageId, knownUrl) {
  stopSpeech()
  notify({ id: messageId, status: 'loading' })
  try {
    const url = knownUrl ?? (await api.speech(messageId)).url
    const audio = new Audio(url)
    current = { id: messageId, audio }
    audio.onended = () => current?.audio === audio && stopSpeech()
    await audio.play() // el navegador puede bloquearlo si no hubo un gesto reciente: queda el botón 🔊
    if (current?.audio === audio) notify({ id: messageId, status: 'playing' })
  } catch {
    stopSpeech()
  }
}

// Estado de un mensaje: 'idle' | 'loading' | 'playing'
export function useSpeechStatus(messageId) {
  const [status, setStatus] = useState(state?.id === messageId ? state.status : 'idle')
  useEffect(() => {
    const fn = (s) => setStatus(s?.id === messageId ? s.status : 'idle')
    listeners.add(fn)
    return () => listeners.delete(fn)
  }, [messageId])
  return status
}
