"""
ws-inventory-report API: Excel upload → Supabase; SoftOne sync (Oracle/SoftOne connection).
Run: uvicorn app.main:app --reload
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import excel, sync
from app.softone_client import is_configured as softone_configured

app = FastAPI(
    title="ws-inventory-report API",
    description="Excel upload and SoftOne sync for inventory report (oracle3 connection)",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(excel.router)
app.include_router(sync.router)


@app.get("/")
async def root():
    return {"app": "ws-inventory-report-api", "docs": "/docs"}


@app.get("/api/status")
async def status():
    """Status: Excel API + SoftOne connection (from oracle3-fastapi-deploy)."""
    return {
        "excel_api": "ok",
        "softone_configured": softone_configured(),
    }
