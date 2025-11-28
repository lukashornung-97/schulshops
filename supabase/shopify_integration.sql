-- ============================================================
-- Shopify Integration
-- ============================================================

-- Tabelle für Shopify-Verbindungen pro Shop
create table public.shopify_connections (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops(id) on delete cascade,
  shop_domain   text not null,                    -- z.B. "ihr-shop.myshopify.com"
  access_token  text not null,                    -- Shopify Admin API Access Token
  storefront_access_token text,                   -- Optional: Storefront API Token
  active        boolean not null default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique(shop_id)                                 -- Ein Shop kann nur eine aktive Shopify-Verbindung haben
);

create index if not exists idx_shopify_connections_shop_id
  on public.shopify_connections (shop_id);

-- Tabelle für synchronisierte Produkte (Mapping zwischen unseren Produkten und Shopify)
create table public.shopify_product_mappings (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references public.products(id) on delete cascade,
  shopify_product_id text not null,                -- Shopify Product ID (gid://shopify/Product/...)
  shopify_variant_ids text[],                      -- Array von Shopify Variant IDs
  last_synced_at    timestamptz default now(),
  created_at        timestamptz default now()
);

create index if not exists idx_shopify_product_mappings_product_id
  on public.shopify_product_mappings (product_id);

create index if not exists idx_shopify_product_mappings_shopify_product_id
  on public.shopify_product_mappings (shopify_product_id);


