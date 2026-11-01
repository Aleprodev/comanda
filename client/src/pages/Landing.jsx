import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { api, money } from '../lib/api.js'

const categories = [
  { key: 'pizzas', title: 'Pizzas', note: 'Grandes, para compartir' },
  { key: 'empanadas', title: 'Empanadas', note: 'Precio por unidad · al horno o fritas' },
  { key: 'minutas', title: 'Minutas', note: '' },
  { key: 'bebidas', title: 'Bebidas', note: '' },
  { key: 'postres', title: 'Postres', note: '' },
]

const payLabel = { mercadopago: 'Mercado Pago', transfer: 'Transferencia', cash: 'Efectivo' }

const orderText = (p) => (p.category === 'empanadas' ? `Quiero empanadas de ${p.name}` : `Quiero ${p.category === 'pizzas' ? 'una pizza ' : ''}${p.name}`)

const steps = [
  { n: '1', title: 'Escribí o mandá un audio', text: 'Pedí como se lo pedirías a una persona. El asistente entiende y te pregunta lo que falta.' },
  { n: '2', title: 'Confirmá y pagá', text: 'Revisás el resumen con el total exacto y pagás con Mercado Pago, transferencia o efectivo.' },
  { n: '3', title: 'Seguilo en vivo', text: 'Te avisamos por el mismo chat cuando entra a cocina y cuando sale hacia tu casa.' },
]

function MenuCard({ product }) {
  return (
    <article className="flex flex-col rounded-3xl bg-surface p-5 shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="grid size-14 place-items-center rounded-2xl bg-bg text-3xl">{product.emoji}</div>
      <h3 className="mt-4 text-[17px] font-semibold tracking-tight">{product.name}</h3>
      <p className="mt-1 flex-1 text-[14px] leading-snug text-muted">{product.description}</p>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-[17px] font-semibold tabular-nums">{money(product.price)}</span>
        <Link
          to={`/pedir?q=${encodeURIComponent(orderText(product))}`}
          className="rounded-full bg-accent/10 px-4 py-1.5 text-sm font-medium text-accent transition hover:bg-accent hover:text-white"
        >
          Pedir
        </Link>
      </div>
    </article>
  )
}

export default function Landing() {
  const [products, setProducts] = useState([])
  const [business, setBusiness] = useState(null)

  useEffect(() => {
    supabase
      .from('products')
      .select('*')
      .eq('available', true)
      .order('sort')
      .then(({ data }) => setProducts(data ?? []))
    api.getBusiness().then(setBusiness).catch(() => {})
  }, [])

  return (
    <div className="min-h-full bg-bg">
      <nav className="sticky top-0 z-10 border-b border-black/5 bg-bg/75 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <a href="#top" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
            <span className="grid size-7 place-items-center rounded-full bg-linear-to-b from-[#ffd36e] to-warn text-sm">🍕</span>
            Todo Chévere
          </a>
          <div className="flex items-center gap-1 text-sm">
            <a href="#menu" className="hidden rounded-full px-3 py-1.5 text-muted transition hover:text-ink sm:block">Menú</a>
            <a href="#como" className="hidden rounded-full px-3 py-1.5 text-muted transition hover:text-ink sm:block">Cómo funciona</a>
            <Link to="/pedir" className="rounded-full bg-accent px-4 py-1.5 font-medium text-white transition hover:brightness-110">
              Hacé tu pedido
            </Link>
          </div>
        </div>
      </nav>

      <header id="top" className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-linear-to-b from-[#fff3dc] via-[#fff9ef] to-bg" />
        <div className="mx-auto max-w-4xl px-5 pb-20 pt-20 text-center sm:pb-28 sm:pt-28">
          <p className="text-sm font-medium text-[#b36b00]">Pizzas & empanadas · Rosario</p>
          <h1 className="mt-3 text-6xl font-semibold leading-[1.02] tracking-tighter sm:text-8xl">
            Todo <span className="bg-linear-to-r from-[#ff9f0a] to-[#ff453a] bg-clip-text text-transparent">chévere</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-xl leading-snug text-muted sm:text-2xl">
            Pedí en un minuto, por chat o con un audio. Sin esperas, sin mensajes perdidos.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/pedir" className="rounded-full bg-accent px-7 py-3 text-[17px] font-medium text-white shadow-lg shadow-accent/25 transition hover:brightness-110 active:scale-[0.98]">
              Hacé tu pedido
            </Link>
            <a href="#menu" className="rounded-full px-7 py-3 text-[17px] font-medium text-accent transition hover:bg-accent/10">
              Ver el menú ›
            </a>
          </div>
          <div className="mt-14 flex justify-center gap-4 text-6xl sm:text-7xl" aria-hidden>
            <span className="-rotate-6">🍕</span>
            <span className="translate-y-3">🥟</span>
            <span className="rotate-6">🍟</span>
          </div>
        </div>
      </header>

      <main>
        <section id="menu" className="mx-auto max-w-6xl scroll-mt-16 px-5 py-16">
          <h2 className="text-center text-4xl font-semibold tracking-tight sm:text-5xl">El menú</h2>
          <p className="mt-3 text-center text-lg text-muted">Tocá "Pedir" y arrancamos el pedido por vos.</p>

          {categories.map((c) => {
            const list = products.filter((p) => p.category === c.key)
            if (list.length === 0) return null
            return (
              <div key={c.key} className="mt-14">
                <div className="mb-5 flex items-baseline gap-3">
                  <h3 className="text-2xl font-semibold tracking-tight">{c.title}</h3>
                  {c.note && <span className="text-sm text-muted">{c.note}</span>}
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((p) => (
                    <MenuCard key={p.id} product={p} />
                  ))}
                </div>
              </div>
            )
          })}
        </section>

        <section id="como" className="scroll-mt-16 bg-surface py-20">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="text-center text-4xl font-semibold tracking-tight sm:text-5xl">Así de simple</h2>
            <div className="mt-12 grid gap-10 sm:grid-cols-3">
              {steps.map((s) => (
                <div key={s.n} className="text-center">
                  <div className="mx-auto grid size-12 place-items-center rounded-full bg-bg text-xl font-semibold text-accent">{s.n}</div>
                  <h3 className="mt-4 text-xl font-semibold tracking-tight">{s.title}</h3>
                  <p className="mx-auto mt-2 max-w-xs text-[15px] leading-snug text-muted">{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {business && (
          <section className="mx-auto grid max-w-6xl gap-4 px-5 py-16 sm:grid-cols-3">
            {[
              ['Horario', business.hours],
              ['Delivery', `${money(business.deliveryFee)} · ${business.deliveryZones}`],
              ['Medios de pago', business.paymentMethods.map((m) => payLabel[m]).join(' · ')],
            ].map(([title, text]) => (
              <div key={title} className="rounded-3xl bg-surface p-6 shadow-sm ring-1 ring-black/5">
                <h3 className="text-[13px] font-medium uppercase tracking-wide text-muted">{title}</h3>
                <p className="mt-2 text-[17px] leading-snug">{text}</p>
              </div>
            ))}
          </section>
        )}
      </main>

      <footer className="border-t border-black/5 py-8 text-center text-sm text-muted">
        <p>© Todo Chévere · Rosario</p>
        <Link to="/panel" className="mt-1 inline-block text-accent hover:underline">
          Panel del local ›
        </Link>
      </footer>

      <Link
        to="/pedir"
        aria-label="Abrir el chat para pedir"
        className="fixed bottom-5 right-5 z-10 grid size-14 place-items-center rounded-full bg-accent text-2xl text-white shadow-xl shadow-accent/30 transition hover:scale-105 active:scale-95"
      >
        💬
      </Link>
    </div>
  )
}
