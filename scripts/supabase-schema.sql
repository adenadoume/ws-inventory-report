-- Run this in Supabase Dashboard → SQL Editor
-- All tables prefixed with ws_ (ws-inventory-report app)

-- 1. ws_inventory_items
create table if not exists ws_inventory_items (
  id           uuid primary key default gen_random_uuid(),
  code         text not null,
  description  text,
  supplier     text,
  q_2024       numeric,
  cost_2024    numeric,
  q_2025       numeric,
  cost_2025    numeric,
  status       text check (status in ('same','changed','missing','new')),
  qty_changed  smallint default 0,
  cost_changed smallint default 0
);
create index if not exists idx_ws_inv_code on ws_inventory_items(code);
create index if not exists idx_ws_inv_supplier on ws_inventory_items(supplier);

-- 2. ws_sales_2025
create table if not exists ws_sales_2025 (
  id           uuid primary key default gen_random_uuid(),
  code         text not null,
  description  text,
  supplier     text,
  qty_sold     numeric default 0,
  value_sold   numeric default 0,
  uploaded_at  timestamptz default now()
);
create index if not exists idx_ws_sales_code on ws_sales_2025(code);
create index if not exists idx_ws_sales_sup on ws_sales_2025(supplier);

-- 3. ws_buys_2025
create table if not exists ws_buys_2025 (
  id           uuid primary key default gen_random_uuid(),
  code         text not null,
  description  text,
  supplier     text,
  qty_bought   numeric default 0,
  value_bought numeric default 0,
  uploaded_at  timestamptz default now()
);
create index if not exists idx_ws_buys_code on ws_buys_2025(code);
create index if not exists idx_ws_buys_sup on ws_buys_2025(supplier);

-- 4. ws_upload_history (NEW: data_payload JSONB column)
create table if not exists ws_upload_history (
  id           uuid primary key default gen_random_uuid(),
  table_name   text not null,
  filename     text,
  row_count    int,
  uploaded_at  timestamptz default now(),
  uploaded_by  text,
  data_payload jsonb
);

-- 5. ws_inventory_adjustments (Phase 2: corrections for Jan–Feb 2026)
create table if not exists ws_inventory_adjustments (
  id           uuid primary key default gen_random_uuid(),
  code         text not null,
  description  text,
  qty_delta    numeric not null,
  reason       text,
  filename     text,
  applied_at   timestamptz default now(),
  applied_by   text
);
create index if not exists idx_ws_adj_code on ws_inventory_adjustments(code);

-- RLS: enable on all tables, allow authenticated users to read/write
alter table ws_inventory_items       enable row level security;
alter table ws_sales_2025            enable row level security;
alter table ws_buys_2025             enable row level security;
alter table ws_upload_history        enable row level security;
alter table ws_inventory_adjustments enable row level security;

create policy "ws: authenticated read inventory" on ws_inventory_items
  for select to authenticated using (true);

create policy "ws: authenticated read sales" on ws_sales_2025
  for select to authenticated using (true);

create policy "ws: authenticated manage sales" on ws_sales_2025
  for all to authenticated using (true) with check (true);

create policy "ws: authenticated read buys" on ws_buys_2025
  for select to authenticated using (true);

create policy "ws: authenticated manage buys" on ws_buys_2025
  for all to authenticated using (true) with check (true);

create policy "ws: authenticated read upload history" on ws_upload_history
  for select to authenticated using (true);

create policy "ws: authenticated insert upload history" on ws_upload_history
  for insert to authenticated with check (true);

create policy "ws: authenticated read adjustments" on ws_inventory_adjustments
  for select to authenticated using (true);
create policy "ws: authenticated manage adjustments" on ws_inventory_adjustments
  for all to authenticated using (true) with check (true);

-- Allow app to import/update inventory via Excel upload (ΑΠΟΓΡΑΦΗ tab)
create policy "ws: authenticated manage inventory" on ws_inventory_items
  for all to authenticated using (true) with check (true);
