"""Per-key in-memory sliding-window rate limiter and the X-Api-Key dependency.

API keys are stored sha256-hashed; lookup results are cached 60s. The limiter
is process-local (single uvicorn worker on the small VPS) — swap for Redis if
that ever changes.
"""

import asyncio
import time
from collections import deque

import httpx
from fastapi import Request, Security
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer

from .core.errors import (
    InvalidApiKey,
    InvalidUserToken,
    KeyDisabled,
    RateLimited,
    UpstreamUnavailable,
)
from .core.security import sha256_hex
from .services.pocketbase import PocketBaseError, wa_collection
from .services.settings import get_app_settings

_API_KEY_TTL = 60.0
_api_key_cache: dict[str, tuple[dict, float]] = {}

# Single-worker process: plain dicts of asyncio.Lock are fine (unbounded by
# design — one entry per key id / (owner, phone) pair, cleared on restart).
_key_locks: dict[str, asyncio.Lock] = {}
_verify_locks: dict[tuple[str, str], asyncio.Lock] = {}


def key_lock(key_id: str) -> asyncio.Lock:
    """Serializes /v1/otp/send per API key (quota -> delivery -> ledger writes)."""
    return _key_locks.setdefault(key_id, asyncio.Lock())


def verify_lock(owner_id: str, phone: str) -> asyncio.Lock:
    """Serializes /v1/otp/verify per (owner, phone): two concurrent verifies of
    the same code must not both consume the single-use row (double spend)."""
    return _verify_locks.setdefault((owner_id, phone), asyncio.Lock())


def invalidate_api_key(key_hash: str) -> None:
    """Drop a resolved key from the 60 s auth cache (regenerate/deactivate)."""
    _api_key_cache.pop(key_hash, None)


class RateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = {}

    def check(self, key: str, limit: int, window_seconds: float = 60.0) -> bool:
        now = time.monotonic()
        hits = self._hits.setdefault(key, deque())
        while hits and now - hits[0] > window_seconds:
            hits.popleft()
        if len(hits) >= limit:
            return False
        hits.append(now)
        return True

    def reset(self) -> None:
        self._hits.clear()


rate_limiter = RateLimiter()


class IdempotencyStore:
    """Replay cache for POST /v1/otp/send's optional Idempotency-Key header.
    Process-local like the rate limiter (single uvicorn worker; entries are
    lost on restart — a retry after a restart just sends a new code). Entries
    expire with the code TTL so a replay can never outlive the code it
    returned: past expiry, a retry must send a fresh code, not replay a
    dead one."""

    def __init__(self) -> None:
        self._entries: dict[tuple[str, str], tuple[float, dict]] = {}

    def get(self, key: tuple[str, str]) -> dict | None:
        entry = self._entries.get(key)
        if entry is None:
            return None
        expires, body = entry
        if time.monotonic() >= expires:
            del self._entries[key]
            return None
        return body

    def put(self, key: tuple[str, str], body: dict, ttl_seconds: float) -> None:
        if len(self._entries) > 10_000:  # bound memory: drop expired first
            now = time.monotonic()
            for stale in [k for k, (exp, _) in self._entries.items() if exp <= now]:
                del self._entries[stale]
        self._entries[key] = (time.monotonic() + ttl_seconds, body)

    def reset(self) -> None:
        self._entries.clear()


idempotency_store = IdempotencyStore()

# Declared as security objects (not plain Header) so FastAPI registers them
# in the OpenAPI securitySchemes — the Authorize button in /docs then works.
_api_key_header = APIKeyHeader(
    name="X-Api-Key",
    auto_error=False,
    description="Developer API key (waotp_…); shown once at creation.",
)
_dashboard_bearer = HTTPBearer(
    auto_error=False,
    description="PocketBase dashboard session token (login on the dashboard).",
)


async def resolve_api_key(request: Request, x_api_key: str | None) -> dict:
    """Returns {"api_key": row, "owner": user_row} or raises 401/403."""
    if not x_api_key:
        raise InvalidApiKey(missing_header=True)

    key_hash = sha256_hex(x_api_key)
    now = time.monotonic()

    cached = _api_key_cache.get(key_hash)
    if cached and now - cached[1] < _API_KEY_TTL:
        api_key, owner = cached[0]
    else:
        pb = request.app.state.pb
        res = await pb.list(wa_collection("api_keys"), filter=f"key_hash='{key_hash}'", per_page=1)
        items = res.get("items") or []
        if not items:
            raise InvalidApiKey()
        api_key = items[0]
        if not api_key.get("active"):
            raise KeyDisabled()
        # owner lives in the app's own auth collection ({prefix}users when
        # running on a shared instance) — never in other apps' user pools
        owner = await pb.get_one(wa_collection("users"), api_key["owner"])
        if owner.get("status") == "suspended":
            raise KeyDisabled()
        _api_key_cache[key_hash] = ((api_key, owner), now)

    app_cfg = await get_app_settings(request.app.state.pb)
    if not rate_limiter.check(api_key["id"], app_cfg["ratelimit_per_min"]):
        raise RateLimited(retry_after_seconds=60)

    return {"api_key": api_key, "owner": owner, "config": app_cfg}


async def require_api_key(
    request: Request, x_api_key: str | None = Security(_api_key_header)
) -> dict:
    return await resolve_api_key(request, x_api_key)


async def require_pb_user(
    request: Request, credentials: HTTPAuthorizationCredentials | None = Security(_dashboard_bearer)
) -> dict:
    """Dashboard auth: PocketBase user token in Authorization: Bearer <token>."""
    if credentials is None:
        raise InvalidUserToken()
    token = credentials.credentials
    try:
        res = await request.app.state.pb.auth_refresh(token)
    except PocketBaseError as exc:
        if exc.status_code == 401:
            raise InvalidUserToken() from exc
        raise UpstreamUnavailable() from exc
    except httpx.HTTPError as exc:  # PB unreachable is not a bad token
        raise UpstreamUnavailable() from exc
    return res.get("record") or {}
