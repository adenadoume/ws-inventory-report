-- Fix: "new row violates row-level security policy for table ws_inventory_items"
-- Run this in Supabase Dashboard → SQL Editor
-- This allows authenticated users to INSERT and UPDATE ws_inventory_items (Excel import).

drop policy if exists "ws: authenticated manage inventory" on ws_inventory_items;
create policy "ws: authenticated manage inventory" on ws_inventory_items
  for all to authenticated using (true) with check (true);
