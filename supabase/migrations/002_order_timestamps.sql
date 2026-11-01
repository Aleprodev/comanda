-- Momento en que cada pedido entró a cada estado (para medir tiempos de cocina)
alter table public.orders
  add column cooking_at timestamptz,
  add column ready_at timestamptz,
  add column delivered_at timestamptz;
