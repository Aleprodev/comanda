-- Comanda: esquema base

create table public.products (
  id text primary key,
  name text not null,
  category text not null check (category in ('pizzas','empanadas','minutas','bebidas','postres')),
  price integer not null check (price >= 0),
  description text not null default '',
  options jsonb not null default '{}'::jsonb,
  emoji text not null default '',
  sort integer not null default 0,
  available boolean not null default true
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  customer_name text,
  phone text,
  mode text not null default 'bot' check (mode in ('bot','human')),
  needs_human boolean not null default false,
  human_reason text,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('customer','bot','staff')),
  type text not null default 'text'
    check (type in ('text','audio','image','order_summary','payment_link','status')),
  content text not null default '',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number integer generated always as identity,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  customer_name text,
  items jsonb not null default '[]'::jsonb,
  subtotal integer not null default 0,
  delivery_fee integer not null default 0,
  discount integer not null default 0,
  total integer not null default 0,
  fulfillment text not null check (fulfillment in ('delivery','pickup')),
  address text,
  notes text,
  status text not null default 'new' check (status in ('new','cooking','ready','delivered')),
  payment_method text not null check (payment_method in ('mercadopago','transfer','cash')),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','mismatch')),
  payment_meta jsonb not null default '{}'::jsonb,
  mp_preference_id text,
  eta_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_conversation_idx on public.orders (conversation_id);

-- RLS: el navegador solo lee; escribe únicamente el servidor (secret key)
alter table public.products enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.orders enable row level security;

create policy "public read products" on public.products for select to anon, authenticated using (true);
create policy "public read conversations" on public.conversations for select to anon, authenticated using (true);
create policy "public read messages" on public.messages for select to anon, authenticated using (true);
create policy "public read orders" on public.orders for select to anon, authenticated using (true);

alter publication supabase_realtime add table public.messages, public.orders, public.conversations;

-- Storage para fotos del chat
insert into storage.buckets (id, name, public) values ('attachments', 'attachments', true)
on conflict (id) do nothing;

-- Menú de Todo Chévere
insert into public.products (id, name, category, price, description, options, emoji, sort) values
  ('pz-muzza',      'Muzzarella',            'pizzas',    13500, 'Salsa de tomate, muzzarella y aceitunas.', '{}', '🍕', 1),
  ('pz-napo',       'Napolitana',            'pizzas',    15500, 'Muzzarella, rodajas de tomate, ajo y perejil.', '{}', '🍅', 2),
  ('pz-fugazzeta',  'Fugazzeta',             'pizzas',    15000, 'Rellena de muzzarella con cebolla dorada.', '{}', '🧅', 3),
  ('pz-especial',   'Especial',              'pizzas',    16500, 'Muzzarella, jamón cocido y morrones asados.', '{}', '⭐', 4),
  ('pz-calabresa',  'Calabresa',             'pizzas',    16500, 'Muzzarella y longaniza calabresa.', '{}', '🌶️', 5),
  ('pz-4quesos',    'Cuatro quesos',         'pizzas',    17500, 'Muzzarella, roquefort, provolone y parmesano.', '{}', '🧀', 6),
  ('pz-rucula',     'Rúcula y crudo',        'pizzas',    18500, 'Muzzarella, jamón crudo, rúcula y parmesano.', '{}', '🥬', 7),
  ('em-carne',      'Carne a cuchillo',      'empanadas',  1700, 'Carne cortada a cuchillo, cebolla, huevo y aceituna.', '{"cocción":["horno","frita"]}', '🥟', 10),
  ('em-pollo',      'Pollo',                 'empanadas',  1700, 'Pollo, cebolla de verdeo y morrón.', '{"cocción":["horno","frita"]}', '🥟', 11),
  ('em-jyq',        'Jamón y queso',         'empanadas',  1700, 'Jamón cocido y muzzarella.', '{"cocción":["horno","frita"]}', '🥟', 12),
  ('em-humita',     'Humita',                'empanadas',  1700, 'Choclo cremoso con salsa blanca.', '{"cocción":["horno","frita"]}', '🌽', 13),
  ('em-caprese',    'Caprese',               'empanadas',  1700, 'Muzzarella, tomate y albahaca.', '{"cocción":["horno","frita"]}', '🌿', 14),
  ('em-verdura',    'Verdura',               'empanadas',  1700, 'Acelga, salsa blanca y queso.', '{"cocción":["horno","frita"]}', '🥬', 15),
  ('mn-mila-napo',  'Milanesa napolitana con fritas', 'minutas', 14500, 'Milanesa de ternera con jamón, salsa y muzzarella, con papas fritas.', '{}', '🍽️', 20),
  ('mn-fritas',     'Papas fritas',          'minutas',    6500, 'Porción grande para compartir.', '{}', '🍟', 21),
  ('bb-coca',       'Coca-Cola 1,5 L',       'bebidas',    4500, '', '{}', '🥤', 30),
  ('bb-agua',       'Agua mineral 1,5 L',    'bebidas',    2500, '', '{}', '💧', 31),
  ('bb-cerveza',    'Cerveza Quilmes 1 L',   'bebidas',    4800, 'Retornable.', '{}', '🍺', 32),
  ('ps-flan',       'Flan casero con dulce de leche', 'postres', 4500, '', '{}', '🍮', 40),
  ('ps-tiramisu',   'Tiramisú',              'postres',    5500, '', '{}', '🍰', 41);
