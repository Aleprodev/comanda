import { useState } from 'react'
import { money, moneyAxis, niceMax, useSize } from './format.js'

const H = 250
const M = { t: 16, r: 70, b: 30, l: 54 }

// Una serie de acento (este período) sobre una de contexto en gris (período anterior)
export default function SalesChart({ series, prev }) {
  const [ref, width] = useSize()
  const [hover, setHover] = useState(null)

  const n = series.length
  const w = Math.max(width, 320)
  const iw = w - M.l - M.r
  const ih = H - M.t - M.b
  const top = niceMax(Math.max(1, ...series.map((s) => s.value), ...(prev ?? []).map((s) => s.value)))
  const x = (i) => M.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw)
  const y = (v) => M.t + ih - (v / top) * ih
  const line = (list) => list.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(s.value).toFixed(1)}`).join('')

  const path = line(series)
  const area = `${path}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z`
  const ticks = [0, top / 2, top]
  const step = Math.ceil(n / 6)
  const last = series[n - 1]

  const move = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const rel = (e.clientX - rect.left - M.l) / iw
    setHover(Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1)))))
  }
  const key = (e) => {
    if (e.key === 'ArrowRight') setHover((h) => Math.min(n - 1, (h ?? -1) + 1))
    if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? n) - 1))
  }

  const h = hover != null ? series[hover] : null
  const hp = hover != null && prev ? prev[hover] : null

  return (
    <div ref={ref} className="relative">
      <svg width={w} height={H} role="img" aria-label="Evolución de las ventas">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={w - M.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--viz-base)' : 'var(--viz-grid)'} strokeWidth="1" />
            <text x={M.l - 10} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--viz-muted)">
              {moneyAxis(t)}
            </text>
          </g>
        ))}

        {series.map((s, i) => {
          const isLast = i === n - 1
          // Las etiquetas del medio se omiten si quedarían pegadas a la última
          if (!isLast && (i % step !== 0 || n - 1 - i < step * 0.7)) return null
          return (
            <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : isLast ? 'end' : 'middle'} fontSize="11" fill="var(--viz-muted)">
              {s.label}
            </text>
          )
        })}

        {prev && <path d={line(prev)} fill="none" stroke="var(--viz-base)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
        <path d={area} fill="var(--s1)" opacity="0.1" />
        <path d={path} fill="none" stroke="var(--s1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={M.t} y2={y(0)} stroke="var(--viz-base)" strokeWidth="1" />}
        <circle cx={x(hover ?? n - 1)} cy={y((h ?? last).value)} r="4" fill="var(--s1)" stroke="var(--viz-surface)" strokeWidth="2" />
        {hover == null && (
          <text x={x(n - 1) + 10} y={y(last.value) + 4} fontSize="12" fontWeight="600" fill="var(--viz-ink)">
            {moneyAxis(last.value)}
          </text>
        )}

        <rect
          x={M.l}
          y={M.t}
          width={iw}
          height={ih + 8}
          fill="transparent"
          tabIndex={0}
          style={{ outline: 'none' }}
          onPointerMove={move}
          onPointerLeave={() => setHover(null)}
          onFocus={() => setHover((v) => v ?? n - 1)}
          onBlur={() => setHover(null)}
          onKeyDown={key}
        />
      </svg>

      {h && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-44 rounded-xl bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-black/10"
          style={{ left: Math.min(Math.max(x(hover) - 88, 0), w - 176) }}
        >
          <p className="text-muted">
            {h.label}
            {h.partial && ' (parcial)'}
          </p>
          <p className="mt-1 flex items-center gap-2">
            <span className="h-0.5 w-3 rounded bg-(--s1)" />
            <b className="text-sm font-semibold tabular-nums">{money(h.value)}</b>
            <span className="text-muted">{h.orders} {h.orders === 1 ? 'pedido' : 'pedidos'}</span>
          </p>
          {hp && (
            <p className="mt-1 flex items-center gap-2 text-muted">
              <span className="h-0.5 w-3 rounded bg-(--viz-base)" />
              <span className="tabular-nums">{money(hp.value)}</span>
              <span>antes</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
