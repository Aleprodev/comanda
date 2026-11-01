import { useRef, useState } from 'react'

// Chrome/Firefox/Edge graban webm; Safari (iPhone y Mac) solo mp4. Se elige el primero que el navegador soporte.
const MIMES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
const MAX_SECONDS = 90

export function useRecorder() {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')
  const recorder = useRef(null)
  const chunks = useRef([])
  const timer = useRef(null)
  const stream = useRef(null)
  const stopRef = useRef(null)

  function cleanup() {
    clearInterval(timer.current)
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
    setRecording(false)
  }

  async function start() {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Este navegador no puede grabar audio. Hace falta abrir el sitio con HTTPS.')
      return false
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError('No tengo permiso para usar el micrófono. Habilitalo en el navegador.')
      return false
    }

    const mimeType = MIMES.find((m) => MediaRecorder.isTypeSupported(m))
    recorder.current = new MediaRecorder(stream.current, mimeType ? { mimeType } : undefined)
    chunks.current = []
    recorder.current.ondataavailable = (e) => e.data.size && chunks.current.push(e.data)
    recorder.current.start()

    setSeconds(0)
    setRecording(true)
    timer.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) stopRef.current?.()
        return s + 1
      })
    }, 1000)
    return true
  }

  // Devuelve el audio grabado (o null si no había nada)
  const stop = () =>
    new Promise((resolve) => {
      const r = recorder.current
      if (!r || r.state === 'inactive') {
        cleanup()
        return resolve(null)
      }
      r.onstop = () => {
        const blob = new Blob(chunks.current, { type: r.mimeType || 'audio/webm' })
        cleanup()
        resolve(blob)
      }
      r.stop()
    })
  stopRef.current = stop

  function cancel() {
    const r = recorder.current
    if (r && r.state !== 'inactive') {
      r.onstop = null
      r.stop()
    }
    cleanup()
  }

  return { recording, seconds, error, setError, start, stop, cancel }
}
