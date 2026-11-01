import { useEffect, useRef, useState } from 'react'

export const money = (n) => '$' + Math.round(n).toLocaleString('es-AR')

// Ejes: completos hasta 9.999, compactos desde ahí ($12K, $1,5M)
export function moneyAxis(n) {
  if (n >= 1e6) return '$' + (n / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + 'M'
  if (n >= 1e4) return '$' + Math.round(n / 1e3) + 'K'
  return money(n)
}

// Techo con la mitad también redonda (2/1, 4/2, 6/3, 8/4, 10/5): el eje lleva 0, mitad y techo
export function niceMax(v) {
  const exp = 10 ** Math.floor(Math.log10(v))
  const f = v / exp
  const step = [2, 4, 6, 8, 10].find((s) => f <= s) ?? 10
  return step * exp
}

export const pct = (n, d = 0) => `${n.toLocaleString('es-AR', { maximumFractionDigits: d })}%`

// Ancho real del contenedor, para que el texto SVG no se estire
export function useSize() {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(el)
    setWidth(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}
