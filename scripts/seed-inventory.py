#!/usr/bin/env python3
"""
seed-inventory.py — One-time seed script to populate Supabase tables from:
  1. APOGRAFI_DIFF.html  → inventory_items  (the DATA array)
  2. SALES_EIDOS.xlsx    → sales_2025
  3. BUYS_EIDOS.xlsx     → buys_2025

Usage:
  pip install supabase openpyxl
  export SUPABASE_URL=https://YOUR_PROJECT.supabase.co
  export SUPABASE_SERVICE_KEY=YOUR_SERVICE_ROLE_KEY
  python3 seed-inventory.py

The SERVICE ROLE key (not anon key) is needed to bypass RLS for inserting.
Find it in: Supabase Dashboard → Settings → API → service_role key
"""

import os, re, ast, json
import openpyxl
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

HTML_PATH    = "/Users/nucintosh/Documents/APOGRAFES LATEST CLD md/APOGRAFI_DIFF.html"
SALES_PATH   = "/Users/nucintosh/Documents/APOGRAFES LATEST CLD md/SALES_EIDOS.xlsx"
BUYS_PATH    = "/Users/nucintosh/Documents/APOGRAFES LATEST CLD md/BUYS_EIDOS.xlsx"

BATCH = 500


def extract_supplier(desc: str) -> str:
    """Extract supplier code from description: 'B172 BASKET...' → 'B172'"""
    m = re.match(r'^([A-Za-z]\d{1,3})\s', desc or "")
    return m.group(1).upper() if m else ""


def extract_data_array(html_path: str):
    """Parse the DATA = [...] array from the HTML file."""
    print(f"Reading HTML: {html_path}")
    with open(html_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Find: const DATA  = [...]
    m = re.search(r'const DATA\s*=\s*(\[.*?\]);', content, re.DOTALL)
    if not m:
        raise ValueError("Could not find DATA array in HTML")

    raw = m.group(1)
    # Replace JS null with Python None for ast.literal_eval
    raw = raw.replace("null", "None")
    data = ast.literal_eval(raw)
    print(f"  Found {len(data)} rows in DATA array")
    return data


def seed_inventory(sb, data):
    """Insert inventory_items rows from DATA array."""
    print("Seeding inventory_items…")

    # Clear existing
    sb.table("inventory_items").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()

    records = []
    for row in data:
        # DATA columns: [code, desc, supplier, q24, c24, q25, c25, status, qty_changed, cost_changed]
        code        = row[0]
        description = row[1]
        supplier    = row[2] if row[2] else extract_supplier(row[1])
        q_2024      = row[3]
        cost_2024   = row[4]
        q_2025      = row[5]
        cost_2025   = row[6]
        status      = row[7]
        qty_changed = row[8]
        cost_changed = row[9]

        records.append({
            "code": code,
            "description": description,
            "supplier": supplier,
            "q_2024": q_2024,
            "cost_2024": cost_2024,
            "q_2025": q_2025,
            "cost_2025": cost_2025,
            "status": status,
            "qty_changed": qty_changed,
            "cost_changed": cost_changed,
        })

    total = len(records)
    for i in range(0, total, BATCH):
        batch = records[i:i + BATCH]
        sb.table("inventory_items").insert(batch).execute()
        print(f"  Inserted {min(i + BATCH, total)}/{total}")

    print(f"  ✓ inventory_items: {total} rows")


def seed_excel(sb, table: str, path: str, qty_col: str, val_col: str):
    """Insert sales_2025 or buys_2025 from an Excel file."""
    print(f"Seeding {table} from {path}…")
    wb = openpyxl.load_workbook(path)
    ws = wb.active

    # Clear existing
    sb.table(table).delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()

    records = []
    for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True)):
        code        = str(row[0] or "").strip()
        description = str(row[1] or "").strip()
        qty         = float(row[2] or 0)
        value       = float(row[3] or 0)
        if not code:
            continue
        supplier = extract_supplier(description)
        records.append({
            "code": code,
            "description": description,
            "supplier": supplier,
            qty_col: qty,
            val_col: value,
        })

    total = len(records)
    for i in range(0, total, BATCH):
        batch = records[i:i + BATCH]
        sb.table(table).insert(batch).execute()
        print(f"  Inserted {min(i + BATCH, total)}/{total}")

    print(f"  ✓ {table}: {total} rows")


def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables")
        return

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    print(f"Connected to Supabase: {SUPABASE_URL}")

    # 1. Inventory
    data = extract_data_array(HTML_PATH)
    seed_inventory(sb, data)

    # 2. Sales
    seed_excel(sb, "sales_2025", SALES_PATH, "qty_sold", "value_sold")

    # 3. Buys
    seed_excel(sb, "buys_2025", BUYS_PATH, "qty_bought", "value_bought")

    print("\n✅ All done! Supabase is ready.")


if __name__ == "__main__":
    main()
