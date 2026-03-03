# ws-inventory-report — Architecture Roadmap

## Current State (Phase 1 — Complete)
- React 19 + Vite + Supabase app deployed at adenadoume/ws-inventory-report
- 4 tabs: ΣΤΟΚ ΑΠΟΓΡΑΦΗ | ΣΤΟΚ−ΑΓΟΡΕΣ+ΠΩΛΗΣΕΙΣ | ΑΓΟΡΕΣ | ΠΩΛΗΣΕΙΣ
- Data seeded manually from Excel files via `scripts/seed-inventory.py`
- SALES_EIDOS.xlsx and BUYS_EIDOS.xlsx uploadable via the app UI

---

## Phase 2 — Inventory Date Correction (IMMEDIATE NEED)

### The Problem
The ΔΦΑΠ (Δελτίο Φυσικής Απογραφής) physical count was done in **February 2026**, not
December 31, 2025. This means the `inventory_items.q_2025` values already reflect the
warehouse state as of ~Feb 26, 2026, NOT Dec 31, 2025.

### Why This Matters
Between Jan 1, 2026 and the inventory date (~Feb 26, 2026):
- **Sales were made** → items physically left the warehouse, so the Feb count is LOWER than Dec 31
- **Purchases arrived** → items arrived after Dec 31, so the Feb count is HIGHER than Dec 31

### Correction Formula
```
True Stock Dec 31, 2025 = Physical Count (Feb 2026) + Sales (Jan–Feb 2026) − Buys (Jan–Feb 2026)
```

Or equivalently: to go from physical count (Feb) back to Dec 31:
- ADD back every item sold between Jan 1 – Feb 26 (they left the shelf, so were there on Dec 31)
- SUBTRACT every item bought between Jan 1 – Feb 26 (they arrived after Dec 31)

### Implementation Needed in the App

#### Two upload buttons to add to the ΣΤΟΚ ΑΠΟΓΡΑΦΗ / inventory management UI:

**Button 1: "⬆ Αφαίρεση Αγορών (Ιαν–Φεβ 2026)"**
- Upload Excel: Κωδικός | Ποσότητα (purchases Jan–Feb 2026)
- Action: `inventory_items.q_2025 -= qty_bought` for each matching code
- Store uploaded adjustments in a new Supabase table `inventory_adjustments`

**Button 2: "⬆ Πρόσθεση Πωλήσεων (Ιαν–Φεβ 2026)"**
- Upload Excel: Κωδικός | Ποσότητα (sales Jan–Feb 2026)
- Action: `inventory_items.q_2025 += qty_sold` for each matching code
- Adds back items that were on the shelf on Dec 31 but sold before the count

#### New Supabase table: `inventory_adjustments`
```sql
create table inventory_adjustments (
  id           uuid primary key default gen_random_uuid(),
  code         text not null,
  description  text,
  qty_delta    numeric not null,  -- positive = add, negative = subtract
  reason       text,              -- 'sales_jan_feb_2026' | 'buys_jan_feb_2026' | 'manual'
  filename     text,
  applied_at   timestamptz default now(),
  applied_by   text
);
```

The app should show a "correction history" so you can always see what adjustments were applied
and undo them (by inserting a reverse record and re-applying).

**IMPORTANT: Never overwrite q_2025 permanently** — instead recalculate on the fly:
```
effective_q_2025 = q_2025 + SUM(qty_delta WHERE code matches)
```
This keeps the raw physical count intact and all corrections auditable.

---

## Phase 3 — SoftOne FastAPI Integration (FUTURE)

### Goal
Replace all manual Excel uploads with live data pulled directly from SoftOne via Python FastAPI,
following the exact same pattern as:
`PYTHON/API_ws_REPORTS/ORACLE FASTAPI SOFTONE EMAIL REPORTS/oracle3-fastapi-deploy/`

### SoftOne Reports to Pull

| Data | SoftOne Report | Notes |
|------|---------------|-------|
| **Πωλήσεις 2025** (SALES) | VSALSTATS or equivalent sales-by-item report | Same API as existing daily report |
| **Αγορές 2025** (BUYS) | Purchase statistics by item (VBLSTATS or similar) | Needs testing in SoftOne |
| **Απογραφή 2025** (Inventory ΔΦΑΠ current year) | VFINDINV or physical inventory report | The Feb 2026 ΔΦΑΠ entries |
| **Απογραφή 2024** (Inventory previous year) | Same report, previous year | For Dec 31, 2024 baseline |
| **Αγορές/Πωλήσεις Ιαν–Φεβ 2026** | Date-filtered sales & purchases | For Phase 2 correction |

### FastAPI Architecture (mirror oracle3-fastapi-deploy)

```
fastapi-softone-inventory/
├── app/
│   ├── main.py              # FastAPI app
│   ├── softone_client.py    # SoftOne WS API client (reuse from oracle3)
│   ├── routes/
│   │   ├── inventory.py     # GET /api/inventory?year=2025
│   │   ├── sales.py         # GET /api/sales?year=2025
│   │   ├── buys.py          # GET /api/buys?year=2025
│   │   └── sync.py          # POST /api/sync → push all to Supabase
│   └── supabase_client.py   # Supabase write client
├── Dockerfile
└── .env
```

### SoftOne WS API Pattern (from oracle3)
```python
# Auth
POST https://{softone_host}/S1services
{"service":"login","username":...,"password":...,"appId":...}
→ clientID

# Get report data
POST https://{softone_host}/S1services
{"service":"getBrowserInfo","clientID":...,"object":"VSALSTATS",...}
→ field list

POST https://{softone_host}/S1services
{"service":"getBrowserData","clientID":...,"object":"VSALSTATS",
 "LIST":"_Στατιστική Μικτού Κέρδους","FORM":"Στατιστικά πωλήσεων",...}
→ data rows
```

### Sync Flow
```
SoftOne → FastAPI (parse + transform) → Supabase tables → React app reads Supabase
```

The React app calls FastAPI endpoints to trigger a sync, or syncs run on a schedule
(daily cron on Oracle VM, same as existing email report setup).

### FastAPI Endpoints for the React App
```
POST /api/sync/sales      → pull sales from SoftOne → update sales_2025 in Supabase
POST /api/sync/buys       → pull buys from SoftOne → update buys_2025 in Supabase
POST /api/sync/inventory  → pull ΔΦΑΠ from SoftOne → update inventory_items in Supabase
GET  /api/status          → last sync timestamps for each table
```

### Deploy
Same Oracle VM as the existing report: `141.147.44.143`
Docker container, port mapping, .env with SoftOne + Supabase credentials.

---

## Phase 4 — Live Inventory Calculation (FUTURE)

Once SoftOne integration is live, the app can calculate **real-time stock** without any manual
Excel uploads:

```
Real-time Stock = ΔΦΑΠ Dec 31, 2024 + Αγορές 2025 (full year) − Πωλήσεις 2025 (full year)
                + Αγορές Ιαν–Φεβ 2026 − Πωλήσεις Ιαν–Φεβ 2026
```

The ΔΦΑΠ (physical count) becomes the anchor, and all movements are tracked via SoftOne.

---

## Notes on SoftOne Report Objects (from existing project)

- Use `ITEM` object (not `MTRL`) for product lookups
- Use `CUSTOMER` object (not `TRDR`) for customer lookups
- Greek column matching: use patterns avoiding accented vowels (e.g. `ΑΞ` not `ΑΞΙ`)
- SoftOne cloud (oncloud.gr) uses the SAME Web Services API as on-premise
- Date format for API: `YYYYMMDD`
- Encode responses as UTF-8 to handle Greek characters

---

_Last updated: March 2026_
