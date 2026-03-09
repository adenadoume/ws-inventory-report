# ws-inventory-report

**Απογραφή Αποθέματος 2024 vs 2025** — React + Supabase + (optional) FastAPI for Excel and Oracle/SoftOne.

- **Frontend**: React 19 + Vite + Supabase Auth; tabs: ΣΤΟΚ ΑΠΟΓΡΑΦΗ | ΣΤΟΚ−ΑΓΟΡΕΣ+ΠΩΛΗΣΕΙΣ | ΑΓΟΡΕΣ | ΠΩΛΗΣΕΙΣ.
- **Deploy**: Vercel (React), GitHub (code), Supabase (auth + data).
- **Backend**: Python FastAPI in `api/` — Excel upload → Supabase; future Oracle/SoftOne sync (see [ARCHITECTURE_ROADMAP.md](ARCHITECTURE_ROADMAP.md)).

Original standalone app (no backend): `apografi.html`.

---

## Quick start

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In SQL Editor, run `scripts/supabase-schema.sql`.
3. Copy `.env.example` to `.env` and set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

### 2. Frontend (React)

```bash
npm install
npm run dev
```

Open the URL shown (e.g. http://localhost:5173). Sign in with Supabase Auth (email or provider you configured).

### 3. Backend (FastAPI, optional)

Used for server-side Excel parsing and (Phase 3) Oracle/SoftOne sync.

```bash
cd api
pip install -r requirements.txt
cp .env.example .env   # set SUPABASE_URL, SUPABASE_SERVICE_KEY
uvicorn app.main:app --reload
```

API: http://localhost:8000 — docs at http://localhost:8000/docs.  
Endpoints: `POST /excel/sales`, `POST /excel/buys` (upload Excel → Supabase).

### 4. GitHub

Repo: **adenadoume/ws-inventory-report**

```bash
git add .
git commit -m "your message"
git push origin main
```

### 5. Vercel

1. [vercel.com](https://vercel.com) → Import **adenadoume/ws-inventory-report**.
2. If the app is in a subfolder (e.g. monorepo), set **Root Directory** to `apps/ws-inventory-report`.
3. Add environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
4. Deploy. The `vercel.json` in this folder configures the SPA rewrite.

---

## Connections summary

| What        | Where |
|------------|--------|
| **Supabase** | `.env`: `VITE_SUPABASE_*`; backend: `api/.env` with `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` |
| **GitHub**   | https://github.com/adenadoume/ws-inventory-report |
| **Vercel**   | Import repo, set env, deploy |
| **FastAPI**  | `api/` — Excel → Supabase; later Oracle/SoftOne (see [CONNECTIONS.md](CONNECTIONS.md)) |

Full list and Oracle/SoftOne env: **[CONNECTIONS.md](CONNECTIONS.md)**.

---

## Seed data (one-time)

From your machine (with Supabase service key):

```bash
export SUPABASE_URL=https://YOUR_PROJECT.supabase.co
export SUPABASE_SERVICE_KEY=your_service_role_key
python3 scripts/seed-inventory.py
```

Uses: `APOGRAFI_DIFF.html`, `SALES_EIDOS.xlsx`, `BUYS_EIDOS.xlsx` (paths in script; adjust if needed).

---

## Reference

- **apografi.html** — Original 2024 vs 2025 comparison (ExcelJS, no Supabase).
- **source-project-backup** (monorepo) — Refine + Ant Design + Supabase; app preferences reference.
- **ARCHITECTURE_ROADMAP.md** — Phase 2 (inventory date correction), Phase 3 (FastAPI + SoftOne/Oracle).
