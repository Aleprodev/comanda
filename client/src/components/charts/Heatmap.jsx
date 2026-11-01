import { useState } from 'react'

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DAYS_LONG = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
// Una sola tinta, de claro a oscuro: más pedidos = más oscuro
const RAMP = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b']

const cellColor = (count, max) => (count === 0 ? 'var(--viz-track)' : RAMP[Math.min(RAMP.length - 1, Math.ceil((count / max) * RAMP.length) - 1)])

export default function Heatmap({ heat }) {
  const { grid, hFrom, hTo, max } = heat
  const hours = Array.from({ length: hTo - hFrom + 1 }, (_, i) => hFrom + i)
  const [tip, setTip] = useState(null)

  let peak = { d: 0, h: hFrom, count: 0 }
  grid.forEach((row, d) => row.forEach((count, h) => count > peak.count && (peak = { d, h, count })))

  const show = (e, d, h, count) => {
    const el = e.currentTarget
    setTip({ left: el.offsetLeft + el.offsetWidth / 2, top: el.offsetTop, d, h, count })
  }

  return (
    <div>
      <p className="text-[13px] text-muted">
        {peak.count > 0 ? (
          <>
            Pico: <b className="font-semibold text-ink">{DAYS_LONG[peak.d]} a las {peak.h} h</b> ({peak.count} {peak.count === 1 ? 'pedido' : 'pedidos'})
          </>
        ) : (
          'Todavía no hay pedidos en este período.'
        )}
      </p>

      <div className="relative mt-4">
        <div
          className="grid items-center gap-[2px]"
          style={{ gridTemplateColumns: `34px repeat(${hours.length}, minmax(0, 1fr))` }}
          onPointerLeave={() => setTip(null)}
        >
          <span />
          {hours.map((h) => (
            <span key={h} className="pb-1 text-center text-[11px] text-muted">
              {h}
            </span>
          ))}
          {grid.map((row, d) => [
            <span key={`l${d}`} className="pr-2 text-right text-[11px] text-muted">
              {DAYS[d]}
            </span>,
            ...hours.map((h) => (
              <button
                key={`${d}-${h}`}
                type="button"
                aria-label={`${DAYS_LONG[d]} ${h} h: ${row[h]} pedidos`}
                onPointerEnter={(e) => show(e, d, h, row[h])}
                onFocus={(e) => show(e, d, h, row[h])}
                onBlur={() => setTip(null)}
                className="h-8 rounded-md outline-none transition hover:ring-2 hover:ring-ink/30 focus-visible:ring-2 focus-visible:ring-ink/40"
                style={{ background: cellColor(row[h], max) }}
              />
            )),
          ])}
        </div>

        {tip && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-xl bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-black/10"
            style={{ left: tip.left, top: tip.top - 6 }}
          >
            <b className="text-sm font-semibold tabular-nums">
              {tip.count} {tip.count === 1 ? 'pedido' : 'pedidos'}
            </b>
            <span className="ml-2 text-muted">
              {DAYS_LONG[tip.d]} {tip.h}:00
            </span>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 text-[11px] text-muted">
        menos
        <span className="flex gap-[2px]">
          {[0, ...RAMP].map((c, i) => (
            <span key={i} className="size-3 rounded-[3px]" style={{ background: i === 0 ? 'var(--viz-track)' : c }} />
          ))}
        </span>
        más
      </div>
    </div>
  )
}
