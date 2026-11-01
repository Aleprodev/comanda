import { useEffect, useRef, useState } from 'react'

// Cámara en vivo para la PC (en el celular se usa la cámara nativa del sistema)
export default function CameraModal({ onCapture, onClose }) {
  const video = useRef(null)
  const stream = useRef(null)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Este navegador no puede usar la cámara. Hace falta abrir el sitio con HTTPS.')
      return
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } } })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop())
        stream.current = s
        video.current.srcObject = s
        setReady(true)
      })
      .catch(() => setError('No tengo permiso para usar la cámara. Habilitala en el navegador.'))
    return () => {
      cancelled = true
      stream.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  function capture() {
    const v = video.current
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    canvas.getContext('2d').drawImage(v, 0, 0)
    canvas.toBlob((blob) => blob && onCapture(blob), 'image/jpeg', 0.9)
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="relative aspect-[4/3] bg-black">
          {error ? (
            <p className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white/80">{error}</p>
          ) : (
            <video ref={video} autoPlay playsInline muted className="size-full object-cover" />
          )}
        </div>
        <div className="flex items-center justify-between gap-3 p-4">
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm font-medium text-muted hover:bg-black/5">
            Cancelar
          </button>
          <button
            onClick={capture}
            disabled={!ready}
            aria-label="Sacar foto"
            className="grid size-14 place-items-center rounded-full ring-4 ring-accent/30 transition active:scale-95 disabled:opacity-30"
          >
            <span className="size-10 rounded-full bg-accent" />
          </button>
          <span className="w-20" />
        </div>
      </div>
    </div>
  )
}
