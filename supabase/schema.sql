-- ============================================================
-- Grund-Setup (nur falls noch nicht vorhanden)
-- ============================================================
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. Schulen
-- ============================================================
create table public.schools (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  short_code text unique,             -- z.B. "GSG-HH"
  city       text,
  country    text default 'DE',
  created_at timestamptz default now()
);

-- ============================================================
-- 2. Shops je Schule
-- ============================================================
create table public.shops (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  name          text not null,
  slug          text unique not null,          -- z.B. "abitur-2026-gsg-hh"
  status        text not null default 'draft', -- draft | live | closed
  currency      text not null default 'EUR',
  shop_open_at  timestamptz,                   -- Shopöffnung
  shop_close_at timestamptz,                   -- Shopschließung
  created_at    timestamptz default now()
);

create index if not exists idx_shops_school_id
  on public.shops (school_id);

-- ============================================================
-- 3. Produkte
-- ============================================================
create table public.products (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  name        text not null,
  description text,
  base_price  numeric(10,2) not null,
  active      boolean not null default true,
  sort_index  int default 0,
  created_at  timestamptz default now()
);

create index if not exists idx_products_shop_id
  on public.products (shop_id);

-- ============================================================
-- 4. Produkt-Varianten (Größen, Farben, etc.)
-- ============================================================
create table public.product_variants (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid not null references public.products(id) on delete cascade,
  name             text not null,              -- z.B. "M", "L", "XL"
  color_name       text,                       -- z.B. "Navy"
  color_hex        text,                       -- z.B. "#101145"
  additional_price numeric(10,2) default 0,    -- Aufschlag (z.B. 3XL)
  sku              text,                       -- optional für Lager/Produktion
  active           boolean default true
);

create index if not exists idx_product_variants_product_id
  on public.product_variants (product_id);

-- ============================================================
-- 5. Bestellungen
-- ============================================================
create table public.orders (
  id             uuid primary key default gen_random_uuid(),
  shop_id        uuid not null references public.shops(id) on delete cascade,
  user_id        uuid references auth.users(id), -- optional (wenn registriert)
  customer_name  text not null,
  customer_email text,
  class_name     text,                           -- z.B. "10b"
  status         text not null default 'pending',-- pending | paid | cancelled | fulfilled
  total_amount   numeric(10,2) not null default 0,
  created_at     timestamptz default now()
);

create index if not exists idx_orders_shop_id
  on public.orders (shop_id);

-- ============================================================
-- 6. Bestellpositionen
-- ============================================================
create table public.order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  product_id  uuid not null references public.products(id),
  variant_id  uuid references public.product_variants(id),
  quantity    int not null,
  unit_price  numeric(10,2) not null,
  line_total  numeric(10,2) not null
);

create index if not exists idx_order_items_order_id
  on public.order_items (order_id);

-- ============================================================
-- 7. Nutzer-Rollen (Rechteverwaltung)
-- ============================================================
create table public.user_roles (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  school_id uuid references public.schools(id),
  shop_id   uuid references public.shops(id),
  role      text not null,  -- z.B. 'superadmin', 'school_admin', 'shop_admin', 'viewer'
  created_at timestamptz default now()
);

create index if not exists idx_user_roles_user_id
  on public.user_roles (user_id);

-- ============================================================
-- 8. CRM: Ansprechpartner und Kontaktdaten für Schulen
-- ============================================================
create table public.school_contacts (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  first_name    text not null,
  last_name     text not null,
  title         text,                       -- z.B. "Schulleiter", "Sekretärin"
  role          text,                       -- z.B. "Schulleitung", "Verwaltung", "IT"
  email         text,
  phone         text,
  mobile        text,
  notes         text,                       -- Notizen zum Kontakt
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists idx_school_contacts_school_id
  on public.school_contacts (school_id);

-- Trigger für updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_school_contacts_updated_at
  before update on public.school_contacts
  for each row
  execute function update_updated_at_column();

