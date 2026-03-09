# ws-inventory-report — Connections & Deployment

This document lists all connections needed to build and run the full app: **React (Vercel)** + **Supabase** + **Python FastAPI (Excel + Oracle/SoftOne)**.

---

## 1. Supabase

- **Dashboard**: [supabase.com](https://supabase.com) → your project
- **Env (frontend)** — set in Vercel and locally in `.env`:
  - `VITE_SUPABASE_URL` = `https://YOUR_PROJECT.supabase.co`
  - `VITE_SUPABASE_ANON_KEY` = anon/public key (safe for browser)
- **Env (backend/FastAPI)** — for Excel sync and server-side writes:
  - `SUPABASE_URL` = same as above
  - `SUPABASE_SERVICE_KEY` = **service_role** key (Dashboard → Settings → API); never expose in frontend.

Run `scripts/supabase-schema.sql` in Supabase SQL Editor to create tables and RLS.

---

## 2. GitHub

- **Repo**: [github.com/adenadoume/ws-inventory-report](https://github.com/adenadoume/ws-inventory-report)
- **Push**:
  ```bash
  git add .
  git commit -m "your message"
  git push origin main
  ```

---

## 3. Vercel (React frontend)

- **Connect**: [vercel.com](https://vercel.com) → Import Git repository → `adenadoume/ws-inventory-report`
- **Root directory**: `apps/ws-inventory-report` if this app lives in a monorepo; otherwise leave as repo root.
- **Build**: `npm run build` (default)
- **Env**: In Vercel project → Settings → Environment Variables, add:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- **Optional**: If the React app calls the FastAPI backend, add `VITE_API_URL` = your FastAPI base URL.

---

## 4. Python FastAPI backend (Excel + Oracle)

- **Location**: `api/` in this repo (or deploy separately).
- **Role**:
  - Accept Excel uploads (inventory, sales, buys), parse with openpyxl/pandas, write to Supabase.
  - (Phase 3) Call Oracle/SoftOne Web Services, transform data, sync to Supabase.
- **Env** (backend `.env` or host env):
  - `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (see §1)
  - **SoftOne** (same as oracle3 — see `PYTHON/API_ws_REPORTS/ORACLE FASTAPI SOFTONE EMAIL REPORTS/oracle3-fastapi-deploy`):
    - `SOFTONE_URL` (e.g. `https://aromaioniou.oncloud.gr/s1services/`)
    - Either `SOFTONE_CLIENT_ID` (pre-authenticated token from SoftOne Web Accounts), or `SOFTONE_USER` + `SOFTONE_PASSWORD`
    - `SOFTONE_APP_ID` (e.g. `1971`), `SOFTONE_REPORT_OBJECT` (e.g. `VSALSTATS`)
- **Run locally**:
  ```bash
  cd api && pip install -r requirements.txt && uvicorn app.main:app --reload
  ```
- **Deploy**: Same VM as existing reports (e.g. `141.147.44.143`) via Docker, or any host that runs Python (Railway, Render, etc.). React app then calls `VITE_API_URL`.

---

## 5. Reference: Original app and backups

- **Original standalone app** (no Supabase/Vercel): `apografi.html` — 2024 vs 2025 inventory comparison, ExcelJS, local only.
- **Source project backup** (app preferences): `/Users/nucintosh/PYTHON/MONOREPO/source-project-backup` — Refine + Ant Design + Supabase pattern; use for UI/UX preferences if needed.
- **Claude project** (APOGRAFES): `/Users/nucintosh/.claude/projects/-Users-nucintosh-Documents-APOGRAFES-LATEST-CLD-md` — chat history for this domain.

---

## Quick checklist

| Connection    | What you need |
|-------------|----------------|
| **Supabase** | Project URL + anon key (frontend) + service key (backend) |
| **GitHub**   | Repo `adenadoume/ws-inventory-report`, push `main` |
| **Vercel**   | Import repo, set `VITE_SUPABASE_*` env, deploy |
| **FastAPI**  | `api/` in repo, `SUPABASE_*` and (later) SoftOne/Oracle env |

All connections are in place to build the full app: **GitHub** (code), **Vercel** (React), **Supabase** (auth + data), **FastAPI** (Excel handling + future Oracle/SoftOne sync).
