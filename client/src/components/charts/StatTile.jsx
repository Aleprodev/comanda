import { pct } from './format.js'

// Variación contra el período anterior. El color depende de la dirección Y de si subir es bueno;
// siempre va con flecha y texto, nunca solo color.
export function Delta({ value, upIsGood = true, label = 'vs período anterior' }) {
  if (value == null) return <span className="text-xs text-muted">Sin datos para comparar</span>
  if (Math.abs(value) < 0.05) return <span className="text-xs text-muted">Sin cambios {label}</span>
  const up = value > 0
  const good = up === upIsGood
  return (
    <span className="flex items-center gap-1 text-xs">
      <span className={`font-semibold ${good ? 'text-[#006300]' : 'text-[#d03b3b]'}`}>
        {up ? '▲' : '▼'} {pct(Math.abs(value), 1)}
      </span>
      <span className="text-muted">{label}</span>
    </span>
  )
}

export default function StatTile({ label, value, unit, delta, upIsGood, note }) {
  return (
    <div className="rounded-3xl bg-surface p-5 shadow-sm ring-1 ring-black/5">
      <p className="text-[13px] text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight">
        {value}
        {unit && <span className="ml-1 text-base font-medium text-muted">{unit}</span>}
      </p>
      <div className="mt-1.5 min-h-4">{delta !== undefined ? <Delta value={delta} upIsGood={upIsGood} /> : <span className="text-xs text-muted">{note}</span>}</div>
    </div>
  )
}
