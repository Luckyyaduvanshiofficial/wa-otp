"""Operator-editable runtime configuration from the PB `settings` single row,
merged over env fallbacks. Cached in memory for 60s."""

import time

from ..core.config import get_settings
from ..core.security import decrypt_secret
from .pocketbase import wa_collection

_TTL_SECONDS = 60.0
_cache: dict = {"data": None, "at": 0.0}

# Fields that must be present before a real (non-mock) delivery is attempted.
REQUIRED_LIVE_KEYS = ("meta_phone_number_id", "meta_token")


async def get_app_settings(pb) -> dict:
    now = time.monotonic()
    if _cache["data"] is not None and now - _cache["at"] < _TTL_SECONDS:
        return _cache["data"]

    env = get_settings()
    row: dict = {}
    try:
        res = await pb.list(wa_collection("settings"), per_page=1)
        if res.get("items"):
            row = res["items"][0]
    except Exception:
        row = {}

    meta_token = ""
    if row.get("meta_token_enc"):
        meta_token = decrypt_secret(row["meta_token_enc"]) or ""

    data = {
        "meta_phone_number_id": row.get("meta_phone_number_id") or env.meta_phone_number_id,
        "meta_token": meta_token or env.meta_access_token,
        "meta_template": row.get("meta_template") or env.meta_template,
        "meta_template_lang": row.get("meta_template_lang") or env.meta_template_lang,
        "tg_bot_token": row.get("tg_bot_token") or "",
        "tg_bot_username": row.get("tg_bot_username") or "",
        "free_monthly_limit": _int(row.get("free_monthly_limit"), env.free_monthly_limit),
        "per_phone_hourly": _int(row.get("per_phone_hourly"), env.per_phone_hourly),
        "code_ttl_seconds": _int(row.get("code_ttl_seconds"), env.code_ttl_seconds),
        "max_attempts": _int(row.get("max_attempts"), env.max_attempts),
        "ratelimit_per_min": _int(row.get("ratelimit_per_min"), env.ratelimit_per_min),
    }
    _cache["data"] = data
    _cache["at"] = now
    return data


def invalidate_settings_cache() -> None:
    _cache["data"] = None
    _cache["at"] = 0.0


def _int(value, fallback: int) -> int:
    try:
        v = int(value)
        return v if v > 0 else fallback
    except (TypeError, ValueError):
        return fallback
