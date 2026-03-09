"""
SoftOne Web Services client for ws-inventory-report.
Reused from: PYTHON/API_ws_REPORTS/ORACLE FASTAPI SOFTONE EMAIL REPORTS/oracle3-fastapi-deploy/app/softone.py

Env:
  SOFTONE_URL          — e.g. https://aromaioniou.oncloud.gr/s1services/
  SOFTONE_CLIENT_ID    — pre-authenticated session token (from SoftOne Web Accounts), OR
  SOFTONE_USER + SOFTONE_PASSWORD + SOFTONE_APP_ID — to obtain clientID via login + authenticate
  SOFTONE_APP_ID       — e.g. 1971
  SOFTONE_REPORT_OBJECT — e.g. VSALSTATS (sales), VBLSTATS (buys), VFINDINV (inventory)
"""
import logging
import os
from html.parser import HTMLParser
from typing import Any

import requests

logger = logging.getLogger(__name__)

SOFTONE_URL = os.getenv("SOFTONE_URL", "").rstrip("/") + "/" if os.getenv("SOFTONE_URL") else ""
SOFTONE_APP_ID = int(os.getenv("SOFTONE_APP_ID", "1971"))
SOFTONE_REPORT_OBJECT = os.getenv("SOFTONE_REPORT_OBJECT", "VSALSTATS")
# Pre-authenticated token (like oracle3) or leave empty to use login
SOFTONE_CLIENT_ID = os.getenv("SOFTONE_CLIENT_ID")
SOFTONE_USER = os.getenv("SOFTONE_USER")
SOFTONE_PASSWORD = os.getenv("SOFTONE_PASSWORD")

_DATE_HDR = "\u0397\u039c\u0395\u03a1"  # ΗΜΕΡ (Ημερ/νία)


class TableParser(HTMLParser):
    """Parse SoftOne HTML table response."""

    def __init__(self):
        super().__init__()
        self.rows: list[list[str]] = []
        self.current_row: list[str] = []
        self.in_cell = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in ("td", "th"):
            self.in_cell = True
            self.current_row.append("")
        elif tag == "tr":
            self.current_row = []

    def handle_endtag(self, tag: str) -> None:
        if tag in ("td", "th"):
            self.in_cell = False
        elif tag == "tr" and self.current_row:
            self.rows.append(self.current_row)

    def handle_data(self, data: str) -> None:
        if self.in_cell and self.current_row:
            self.current_row[-1] += data.strip()


def _post(service: str, payload: dict[str, Any]) -> dict:
    """POST to SoftOne S1services."""
    if not SOFTONE_URL:
        raise ValueError("SOFTONE_URL is not set")
    body = {"service": service, "appId": SOFTONE_APP_ID, **payload}
    r = requests.post(
        SOFTONE_URL,
        json=body,
        timeout=30,
        headers={"Content-Type": "application/json", "Accept-Charset": "utf-8"},
    )
    r.raise_for_status()
    data = r.json()
    if data.get("error"):
        raise RuntimeError(f"SoftOne API error: {data['error']}")
    return data


def get_client_id() -> str:
    """Return SOFTONE_CLIENT_ID from env, or obtain via login + authenticate."""
    if SOFTONE_CLIENT_ID:
        return SOFTONE_CLIENT_ID
    if not SOFTONE_USER or not SOFTONE_PASSWORD:
        raise ValueError(
            "Set either SOFTONE_CLIENT_ID or (SOFTONE_USER + SOFTONE_PASSWORD)"
        )
    # Step 1: login
    login = _post("login", {
        "username": SOFTONE_USER,
        "password": SOFTONE_PASSWORD,
    })
    if not login.get("success") or not login.get("clientID"):
        raise RuntimeError("SoftOne login failed")
    temp_id = login["clientID"]
    objs = login.get("objs", [])
    if not objs:
        raise RuntimeError("SoftOne login: no objs (company/branch)")
    o = objs[0]
    company = o.get("COMPANY", "1000")
    branch = o.get("BRANCH", "1000")
    module = o.get("MODULE", "0")
    refid = o.get("REFID", "1")
    # Step 2: authenticate
    auth = _post("authenticate", {
        "clientID": temp_id,
        "company": company,
        "branch": branch,
        "module": module,
        "refid": refid,
    })
    if not auth.get("success") or not auth.get("clientID"):
        raise RuntimeError("SoftOne authenticate failed")
    return auth["clientID"]


def get_report_info(date: str | None = None) -> dict:
    """Get report reference (reqID, pagenum) from SoftOne. Date format YYYYMMDD."""
    from datetime import datetime

    client_id = get_client_id()
    filter_date = date or datetime.now().strftime("%Y%m%d")
    filters = f"FDATE={filter_date};TDATE={filter_date}"
    payload = {
        "clientID": client_id,
        "object": SOFTONE_REPORT_OBJECT,
        "list": "_Στατιστική Μικτού Κέρδους",
        "form": "Στατιστικά πωλήσεων",
        "filters": filters,
    }
    data = _post("getReportInfo", payload)
    req_id = data.get("reqID")
    if not req_id:
        raise RuntimeError("SoftOne getReportInfo: no reqID")
    npages = data.get("npages") or data.get("pagenum") or 1
    return {"reqID": req_id, "pagenum": npages}


def get_report_data(req_id: str, pagenum: int = 1) -> str:
    """Get report HTML for a page. SoftOne returns HTML, not JSON."""
    if not SOFTONE_URL:
        raise ValueError("SOFTONE_URL is not set")
    client_id = get_client_id()
    payload = {
        "service": "getReportData",
        "clientID": client_id,
        "appId": SOFTONE_APP_ID,
        "reqID": req_id,
        "pagenum": pagenum,
    }
    r = requests.post(
        SOFTONE_URL,
        json=payload,
        timeout=30,
        headers={"Content-Type": "application/json", "Accept-Charset": "utf-8"},
    )
    r.raise_for_status()
    return r.text


def get_browser_info(object_name: str, list_name: str = "", filters: str = "") -> dict:
    """SoftOne getBrowserInfo — returns reqID and fields for getBrowserData."""
    client_id = get_client_id()
    payload = {
        "clientID": client_id,
        "object": object_name,
        "list": list_name,
        "filters": filters,
    }
    return _post("getBrowserInfo", payload)


def get_browser_data(req_id: str, start: int = 0, limit: int = 1000) -> dict:
    """SoftOne getBrowserData — returns rows for a given reqID."""
    client_id = get_client_id()
    payload = {
        "clientID": client_id,
        "reqID": req_id,
        "start": start,
        "limit": limit,
    }
    return _post("getBrowserData", payload)


def parse_html_report(
    html_data: str,
    reuse_headers: list[str] | None = None,
    pending_rows: list[dict] | None = None,
    filter_date: str | None = None,
) -> tuple[list[str], list[dict], list[dict]]:
    """
    Parse SoftOne HTML report into (headers, data_rows, pending_rows).
    Same logic as oracle3-fastapi-deploy/app/softone.py parse_html_report.
    """
    from datetime import datetime

    parser = TableParser()
    parser.feed(html_data)
    rows = parser.rows
    if not rows:
        return (reuse_headers or [], [], pending_rows or [])

    header_row_idx = 0
    for i, row in enumerate(rows):
        if len(row) > 1:
            header_row_idx = i
            break
    if reuse_headers:
        headers = reuse_headers
        data_start = 0
    else:
        headers = [c.strip() for c in rows[header_row_idx]]
        data_start = header_row_idx + 1

    kwdikos_key = next(
        (h for h in headers if "\u039a\u03a9\u0394\u0399\u039a" in h.upper()), None
    )
    data: list[dict] = []
    current_product_rows = list(pending_rows) if pending_rows else []

    for row in rows[data_start:]:
        if len(row) == len(headers):
            if not any(cell.strip() for cell in row[:4]):
                continue
            row_dict = {}
            for i, header in enumerate(headers):
                row_dict[header] = row[i].strip() if i < len(row) else ""
            current_product_rows.append(row_dict)
        elif len(row) == 7 and "\u03a3\u03cd\u03bd\u03bf\u03bb\u03b1" in row[1]:
            product_code = row[1].split(":", 1)[1].strip() if ":" in row[1] else ""
            if product_code and kwdikos_key:
                for r in current_product_rows:
                    r["_client_code"] = r.get(kwdikos_key, "")
                    r[kwdikos_key] = product_code
            data.extend(current_product_rows)
            current_product_rows = []

    date_key = next((h for h in headers if _DATE_HDR in h.upper()), None)
    if filter_date and date_key:
        try:
            target = datetime.strptime(filter_date, "%Y%m%d").strftime("%d/%m/%Y")
            data = [r for r in data if r.get(date_key, "") == target]
        except ValueError:
            pass
    return (headers, data, current_product_rows)


def is_configured() -> bool:
    """True if SoftOne connection can be used (URL + either client ID or user/password)."""
    if not SOFTONE_URL:
        return False
    if SOFTONE_CLIENT_ID:
        return True
    return bool(SOFTONE_USER and SOFTONE_PASSWORD)
