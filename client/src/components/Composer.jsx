import { useRef, useState } from 'react'
import { useRecorder } from '../lib/recorder.js'
import { shrinkImage } from '../lib/image.js'
import CameraModal from './CameraModal.jsx'

const Icon = ({ d, className = 'size-5' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

function MenuItem({ icon, children, onClick }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] hover:bg-bg">
      <Icon d={icon} className="size-[18px] text-accent" />
      {children}
    </button>
  )
}

export default function Composer({ text, setText, busy, onText, onAudio, onImage }) {
  const rec = useRecorder()
  const [menu, setMenu] = useState(false)
  const [camera, setCamera] = useState(false)
  const galleryRef = useRef(null)
  const captureRef = useRef(null)
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches

  async function finishRecording() {
    const seconds = rec.seconds
    const blob = await rec.stop()
    if (blob && blob.size > 1500) onAudio(blob, seconds)
  }

  async function pick(file) {
    if (file) onImage(await shrinkImage(file))
  }

  const takePhoto = () => {
    setMenu(false)
    // En el celular se abre la cámara nativa; en la PC, la webcam dentro de la página
    if (coarse) captureRef.current?.click()
    else setCamera(true)
  }

  const iconBtn = 'grid size-10 shrink-0 place-items-center rounded-full transition active:scale-95 disabled:opacity-30'

  return (
    <>
      {rec.error && <p className="px-4 pb-1 text-center text-xs text-danger">{rec.error}</p>}

      <form
        onSubmit={onText}
        className="relative flex items-center gap-2 border-t border-black/5 bg-white/80 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-xl sm:pb-6"
      >
        {rec.recording ? (
          <>
            <button type="button" onClick={rec.cancel} aria-label="Cancelar grabación" className={`${iconBtn} bg-bg text-muted`}>
              <Icon d="M18 6L6 18M6 6l12 12" />
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full bg-bg px-4 py-2.5 text-[15px] ring-1 ring-black/5">
              <span className="size-2.5 animate-pulse rounded-full bg-danger" />
              <span className="tabular-nums">{mmss(rec.seconds)}</span>
              <span className="truncate text-muted">Grabando…</span>
            </div>
            <button type="button" onClick={finishRecording} aria-label="Enviar audio" className={`${iconBtn} bg-accent text-white`}>
              <Icon d="M12 19V5M5 12l7-7 7 7" className="size-5" />
            </button>
          </>
        ) : (
          <>
            <div className="relative">
              <button type="button" disabled={busy} onClick={() => setMenu((m) => !m)} aria-label="Adjuntar" className={`${iconBtn} bg-bg text-muted ring-1 ring-black/5`}>
                <Icon d="M12 5v14M5 12h14" />
              </button>
              {menu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                  <div className="absolute bottom-12 left-0 z-20 w-56 rounded-2xl bg-white p-1 shadow-xl ring-1 ring-black/10">
                    <MenuItem icon="M3 8h3l2-3h8l2 3h3v11H3zM12 17a4 4 0 100-8 4 4 0 000 8z" onClick={takePhoto}>
                      Sacar foto
                    </MenuItem>
                    <MenuItem
                      icon="M4 5h16v14H4zM4 15l5-5 4 4 3-3 4 4M9 9.5h.01"
                      onClick={() => {
                        setMenu(false)
                        galleryRef.current?.click()
                      }}
                    >
                      Elegir una imagen
                    </MenuItem>
                  </div>
                </>
              )}
            </div>

            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Escribí tu pedido…"
              autoComplete="off"
              enterKeyHint="send"
              className="min-w-0 flex-1 rounded-full bg-bg px-4 py-2.5 text-[15px] outline-none ring-1 ring-black/5 placeholder:text-muted focus:ring-accent/50"
            />

            {text.trim() ? (
              <button type="submit" disabled={busy} aria-label="Enviar" className={`${iconBtn} bg-accent text-white`}>
                <Icon d="M12 19V5M5 12l7-7 7 7" />
              </button>
            ) : (
              <button type="button" disabled={busy} onClick={rec.start} aria-label="Grabar un audio" className={`${iconBtn} bg-accent text-white`}>
                <Icon d="M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zM6 11a6 6 0 0012 0M12 17v4" />
              </button>
            )}
          </>
        )}

        <input ref={galleryRef} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files[0]); e.target.value = '' }} />
        <input ref={captureRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { pick(e.target.files[0]); e.target.value = '' }} />
      </form>

      {camera && (
        <CameraModal
          onClose={() => setCamera(false)}
          onCapture={async (blob) => {
            setCamera(false)
            onImage(await shrinkImage(blob))
          }}
        />
      )}
    </>
  )
}
