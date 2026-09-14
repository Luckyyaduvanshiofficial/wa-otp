"""Free-tier quota and per-phone throttle, both sourced from append-only data:
- monthly quota counts `messages` rows with channel=whatsapp + status=sent this
  calendar month (UTC) — Telegram is unlimited/free per PRD §7 and never counts
- per-phone throttle counts `otp_codes` rows created in the trailing hour
  (both channels: victim-number protection)
"""

from datetime import datetime, timedelta, timezone

from .pocketbase import wa_collection

MONTH_LIMIT_FALLBACK_NOTE = "limits live in the settings collection"


def month_window(now: datetime) -> tuple[datetime, datetime]:
    """(start of current UTC month, start of next UTC month)."""
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if now.month == 12:
        end = datetime(now.year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end = datetime(now.year, now.month + 1, 1, tzinfo=timezone.utc)
    return start, end


def reset_utc_iso(now: datetime) -> str:
    _, end = month_window(now)
    return end.strftime("%Y-%m-%dT%H:%M:%SZ")


def pb_date(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


async def monthly_used(pb, owner_id: str, now: datetime) -> int:
    start, _ = month_window(now)
    res = await pb.list(
        wa_collection("messages"),
        filter=(
            f"owner='{owner_id}' && channel='whatsapp' && status='sent' "
            f"&& created>='{pb_date(start)}'"
        ),
        per_page=1,
    )
    return int(res.get("totalItems", 0))


async def phone_sends_last_hour(pb, owner_id: str, phone: str, now: datetime) -> int:
    since = now - timedelta(hours=1)
    res = await pb.list(
        wa_collection("otp_codes"),
        filter=f"owner='{owner_id}' && phone='{phone}' && created>='{pb_date(since)}'",
        per_page=1,
    )
    return int(res.get("totalItems", 0))
