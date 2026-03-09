"""Supabase client for server-side writes (Excel sync, future Oracle sync)."""
import os
from supabase import create_client

url = os.environ.get("SUPABASE_URL", "")
key = os.environ.get("SUPABASE_SERVICE_KEY", "")

def get_supabase():
    if not url or not key:
        raise ValueError("Set SUPABASE_URL and SUPABASE_SERVICE_KEY")
    return create_client(url, key)
