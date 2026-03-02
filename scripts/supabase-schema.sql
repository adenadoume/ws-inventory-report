-- Run this in Supabase Dashboard → SQL Editor

-- 1. inventory_items
create table if not exists inventory_items (
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
create index if not exists idx_inv_code on inventory_items(code);
create index if not exists idx_inv_supplier on inventory_items(supplier);

-- 2. sales_2025
create table if not exists sales_2025 (
  id           uuid primary key default gen_random_uuid(),
  code         text not null,
  description  text,
  supplier     text,
  qty_sold     numeric default 0,
  value_sold   numeric default 0,
  uploaded_at  timestamptz default now()
);
create index if not exists idx_sales_code on sales_2025(code);
create index if not exists idx_sales_sup on sales_2025(supplier);

-- 3. buys_2025
create table if not exists buys_2025 (
  id           uuid primary key default gen_random_uuid(),
  code         text not null,
  description  text,
  supplier     text,
  qty_bought   numeric default 0,
  value_bought numeric default 0,
  uploaded_at  timestamptz default now()
);
create index if not exists idx_buys_code on buys_2025(code);
create index if not exists idx_buys_sup on buys_2025(supplier);

-- 4. upload_history
create table if not exists upload_history (
  id           uuid primary key default gen_random_uuid(),
  table_name   text not null,
  filename     text,
  row_count    int,
  uploaded_at  timestamptz default now(),
  uploaded_by  text
);

-- RLS: enable on all tables, allow authenticated users to read
alter table inventory_items enable row level security;
alter table sales_2025       enable row level security;
alter table buys_2025        enable row level security;
alter table upload_history   enable row level security;

create policy "Authenticated can read inventory" on inventory_items
  for select to authenticated using (true);

create policy "Authenticated can read sales" on sales_2025
  for select to authenticated using (true);

create policy "Authenticated can manage sales" on sales_2025
  for all to authenticated using (true) with check (true);

create policy "Authenticated can read buys" on buys_2025
  for select to authenticated using (true);

create policy "Authenticated can manage buys" on buys_2025
  for all to authenticated using (true) with check (true);

create policy "Authenticated can read history" on upload_history
  for select to authenticated using (true);

create policy "Authenticated can insert history" on upload_history
  for insert to authenticated with check (true);

-- Inventory is read-only for users (seeded by admin script)
-- To allow users to also import inventory via the app, add:
-- create policy "Authenticated can manage inventory" on inventory_items
--   for all to authenticated using (true) with check (true);
