// Ranking horizontal: una tinta, barras finas con el extremo redondeado y el valor en la punta
export default function RankBars({ items, format }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  if (items.length === 0) return <p className="py-6 text-center text-sm text-muted">Todavía no hay ventas en este período.</p>

  return (
    <ol className="space-y-3">
      {items.map((it) => {
        const w = (it.value / max) * 100
        return (
          <li key={it.id} className="group grid grid-cols-[minmax(0,9.5rem)_1fr] items-center gap-3" title={`${it.name}: ${format(it.value)}`}>
            <span className="truncate text-[13px]">
              <span className="mr-1.5">{it.emoji}</span>
              {it.name}
            </span>
            <span className="relative flex h-5 items-center">
              <span
                className="h-3 rounded-r-[4px] bg-(--s1) transition group-hover:brightness-110"
                style={{ width: `calc(${w}% - 3.5rem)`, minWidth: 4 }}
              />
              <span className="ml-2 text-[12px] font-semibold tabular-nums text-ink">{format(it.value)}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
