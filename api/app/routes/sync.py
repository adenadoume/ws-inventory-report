"""
SoftOne sync routes — use Oracle/SoftOne connection from oracle3-fastapi-deploy.
GET /sync/status — whether SoftOne is configured.
POST /sync/sales — fetch sales report from SoftOne for a given date (YYYYMMDD); returns row count (and optionally push to Supabase later).
"""
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/sync", tags=["sync"])


@router.get("/status")
async def sync_status():
    """Whether SoftOne env is configured (SOFTONE_URL + SOFTONE_CLIENT_ID or user/password)."""
    from app.softone_client import is_configured
    return {"softone_configured": is_configured()}


@router.post("/sales")
async def sync_sales(
    date: str | None = Query(None, description="YYYYMMDD, default today"),
):
    """
    Fetch sales report from SoftOne (VSALSTATS) for the given date.
    Returns parsed row count; Phase 3 can extend to push to Supabase ws_sales_2025.
    """
    from app.softone_client import (
        get_report_data,
        get_report_info,
        is_configured,
        parse_html_report,
    )

    if not is_configured():
        raise HTTPException(
            503,
            "SoftOne not configured. Set SOFTONE_URL and SOFTONE_CLIENT_ID (or SOFTONE_USER/SOFTONE_PASSWORD) in env.",
        )
    filter_date = date or datetime.now().strftime("%Y%m%d")
    try:
        info = get_report_info(date=filter_date)
        req_id = info["reqID"]
        total_pages = info["pagenum"]
        all_data = []
        headers = None
        pending = []
        for page in range(1, total_pages + 1):
            html = get_report_data(req_id, pagenum=page)
            headers, page_data, pending = parse_html_report(
                html, reuse_headers=headers, pending_rows=pending, filter_date=filter_date
            )
            all_data.extend(page_data)
        # Flush last pending if any
        if pending and headers:
            all_data.extend(pending)
        return {
            "date": filter_date,
            "rows": len(all_data),
            "pages": total_pages,
            "message": "Fetch from SoftOne OK; add Supabase write in Phase 3.",
        }
    except Exception as e:
        raise HTTPException(502, f"SoftOne fetch failed: {e}")
