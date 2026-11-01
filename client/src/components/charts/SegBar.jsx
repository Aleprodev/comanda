import { useState } from 'react'
import { pct, useSize } from './format.js'

// Una entidad, un color fijo: no cambia si otra categoría desaparece del filtro
export const SERIES = { s1: 'var(--s1)', s2: 'var(--s2)', s3: 'var(--s3)', s4: 'var(--s4)', s5: 'var(--s5)' }
const DARK_TEXT = new Set(['s4']) // texto casi negro sobre el amarillo; blanco sobre el resto

// Una totalidad partida en bloques (28px). El porcentaje va dentro si cabe; la leyenda solo lleva nombres.
export default function SegBar({ items, formatValue }) {
  const [ref, width] = useSize()
  const [tip, setTip] = useState(null)
  const total = items.reduce((s, i) => s + i.value, 0)
  const parts = items.filter((i) => i.value > 0)

  // El contenedor medido existe siempre: si se montara recién con los datos, nunca se mediría
  if (total === 0) {
    return (
      <div ref={ref}>
        <p className="py-3 text-sm text-muted">Todavía no hay datos en este período.</p>
      </div>
    )
  }

  return (
    <div ref={ref}>
      <div className="relative">
        <div className="flex h-7 gap-[2px]" role="img" aria-label={parts.map((p) => `${p.label} ${pct((p.value / total) * 100)}`).join(', ')}>
          {parts.map((p) => {
            const share = (p.value / total) * 100
            const px = (share / 100) * width
            return (
              <button
                key={p.key}
                type="button"
                onPointerEnter={(e) => setTip({ p, share, left: e.currentTarget.offsetLeft + e.currentTarget.offsetWidth / 2 })}
                onPointerLeave={() => setTip(null)}
                onFocus={(e) => setTip({ p, share, left: e.currentTarget.offsetLeft + e.currentTarget.offsetWidth / 2 })}
                onBlur={() => setTip(null)}
                className={`flex items-center overflow-visible rounded-[4px] px-2 text-left text-xs font-semibold outline-none transition hover:brightness-105 focus-visible:ring-2 focus-visible:ring-ink/40 ${
                  DARK_TEXT.has(p.color) ? 'text-[#0b0b0b]' : 'text-white'
                }`}
                style={{ width: `${share}%`, background: SERIES[p.color] }}
              >
                {px >= 46 && <span className="whitespace-nowrap">{pct(share)}</span>}
              </button>
            )
          })}
        </div>

        {tip && (
          <div
            className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-xl bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-black/10"
            style={{ left: tip.left }}
          >
            <b className="text-sm font-semibold tabular-nums">{formatValue(tip.p.value)}</b>
            <span className="ml-2 text-muted">
              {tip.p.label} · {pct(tip.share, 1)}
            </span>
          </div>
        )}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {items.map((i) => (
          <li key={i.key} className={`flex items-center gap-1.5 text-[12px] ${i.value > 0 ? 'text-ink-2' : 'text-muted'}`} style={{ color: 'var(--viz-ink-2)' }}>
            <span className="size-2.5 rounded-[3px]" style={{ background: SERIES[i.color] }} />
            {i.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
