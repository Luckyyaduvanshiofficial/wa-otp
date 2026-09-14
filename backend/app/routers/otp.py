import logging
import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from ..core.errors import (
    DeliveryFailed,
    InvalidApiKey,
    InvalidRequest,
    KeyDisabled,
    NotConfigured,
    NotLinked,
    PhoneThrottled,
    QuotaExceeded,
    RateLimited,
    UpstreamUnavailable,
    error_responses,
)
from ..core.security import generate_otp_code, make_link_token, normalize_phone
from ..dependencies import idempotency_store, key_lock, require_api_key, verify_lock
from ..services import meta as meta_service
from ..services import telegram as telegram_service
from ..services.otp import create_otp, verify_otp
from ..services.pocketbase import PocketBaseError, wa_collection
from ..services.quota import (
    month_window,
    monthly_used,
    phone_sends_last_hour,
    reset_utc_iso,
)
from ..services.settings import get_app_settings

router = APIRouter(prefix="/v1/otp", tags=["otp"])
logger = logging.getLogger("waotp")

CUSTOM_CODE_PATTERN = r"^[A-Za-z0-9]{4,10}$"

SEND_RESPONSES = error_responses(
    InvalidRequest, InvalidApiKey, KeyDisabled, RateLimited, QuotaExceeded,
    PhoneThrottled, NotLinked, NotConfigured, DeliveryFailed, UpstreamUnavailable,
)
VERIFY_RESPONSES = error_responses(InvalidRequest, InvalidApiKey, KeyDisabled, RateLimited)
USAGE_RESPONSES = error_responses(InvalidApiKey, KeyDisabled, RateLimited, UpstreamUnavailable)


class SendIn(BaseModel):
    to: str = Field(min_length=5, max_length=20)
    channel: Literal["whatsapp", "telegram"] = "whatsapp"
    code: str | None = Field(default=None, pattern=CUSTOM_CODE_PATTERN)


class VerifyIn(BaseModel):
    to: str = Field(min_length=5, max_length=20)
    code: str = Field(min_length=1, max_length=10)


class SendOut(BaseModel):
    ok: bool
    mode: str
    channel: str
    request_id: str
    wa_message_id: str
    expires_in: int
    free_used: int
    free_limit: int
    reset_utc: str


class VerifyOut(BaseModel):
    ok: bool
    verified: bool


class UsageOut(BaseModel):
    plan: str
    used: int
    limit: int
    reset_utc: str


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _validate_idempotency_key(value: str | None) -> str | None:
    """Optional Idempotency-Key header: 1-255 visible ASCII characters.
    Invalid values 400 rather than being silently ignored — a client that
    believes it has idempotency protection must not discover it never did."""
    if value is None:
        return None
    key = value.strip()
    if not key or len(key) > 255 or any(not 0x21 <= ord(ch) <= 0x7E for ch in key):
        raise InvalidRequest(detail="Idempotency-Key must be 1-255 visible ASCII characters")
    return key


@router.post("/send", response_model=SendOut, responses=SEND_RESPONSES)
async def send_otp(
    body: SendIn,
    request: Request,
    ctx=Depends(require_api_key),
    idempotency_key: str | None = Header(default=None),
):
    idem = _validate_idempotency_key(idempotency_key)
    phone = normalize_phone(body.to)
    if phone is None:
        raise InvalidRequest(detail="to must be a valid phone number (E.164, e.g. 919876543210)")

    pb = request.app.state.pb
    owner = ctx["owner"]
    api_key = ctx["api_key"]
    cfg = ctx["config"]
    now = _utcnow()

    # Serialize the whole send (quota check -> throttle check -> provider
    # delivery -> ledger writes) per API key. The lock intentionally spans the
    # provider await: without it, two concurrent sends could both pass the
    # quota/throttle checks before either wrote its ledger rows.
    async with key_lock(api_key["id"]):
        # Idempotency replay: a retry with the same Idempotency-Key inside
        # the code's lifetime returns the original response instead of
        # double-sending. Checked inside the per-key lock so a concurrent
        # duplicate waits for — and then replays — the first send.
        if idem is not None:
            replayed = idempotency_store.get((api_key["id"], idem))
            if replayed is not None:
                return JSONResponse(content=replayed, headers={"Idempotency-Replayed": "true"})

        # Monthly quota counts WhatsApp-delivered sends only; Telegram is
        # unlimited and free (PRD §7) so it never hits this gate.
        used = await monthly_used(pb, owner["id"], now)
        if body.channel == "whatsapp" and used >= cfg["free_monthly_limit"]:
            retry_after = max(60, int((month_window(now)[1] - now).total_seconds()))
            raise QuotaExceeded(
                free_used=used,
                free_limit=cfg["free_monthly_limit"],
                reset_utc=reset_utc_iso(now),
                headers={"Retry-After": str(retry_after)},
            )

        # Per-phone throttle stays for BOTH channels (victim-number protection).
        recent = await phone_sends_last_hour(pb, owner["id"], phone, now)
        if recent >= cfg["per_phone_hourly"]:
            raise PhoneThrottled(retry_after_seconds=3600)

        # 6-digit platform code, or the caller's custom code.
        code = body.code or generate_otp_code()

        provider_message_id = ""
        mock = get_mock_delivery(request)
        if body.channel == "whatsapp":
            if not mock and (not cfg["meta_phone_number_id"] or not cfg["meta_token"]):
                raise NotConfigured(detail="WhatsApp is not configured yet (settings collection)")
            if mock:
                provider_message_id = f"mock-{uuid.uuid4().hex[:12]}"
            else:
                try:
                    provider_message_id = await meta_service.send_otp_template(
                        request.app.state.http,
                        cfg["meta_phone_number_id"],
                        cfg["meta_token"],
                        phone,
                        code,
                        cfg["meta_template"],
                        cfg["meta_template_lang"],
                    )
                except meta_service.MetaError as exc:
                    await _log_failure(pb, owner, api_key, phone, "whatsapp", exc.message)
                    raise DeliveryFailed(
                        channel="whatsapp", detail=exc.message[:300], retryable=exc.retryable
                    ) from exc
        else:  # telegram
            links = await pb.list(wa_collection("tg_links"), filter=f"phone='{phone}'", per_page=1)
            items = links.get("items") or []
            if not items:
                link_token = make_link_token(owner["id"], phone)
                raise NotLinked(
                    link_url=f"https://t.me/{cfg['tg_bot_username'] or 'waotp_bot'}?start={link_token}"
                )
            if not mock and not cfg["tg_bot_token"]:
                raise NotConfigured(detail="Telegram bot is not configured yet (settings collection)")
            chat_id = items[0]["chat_id"]
            if mock:
                provider_message_id = f"mock-{uuid.uuid4().hex[:12]}"
            else:
                try:
                    provider_message_id = await telegram_service.send_message(
                        request.app.state.http,
                        cfg["tg_bot_token"],
                        chat_id,
                        f"{code} is your verification code. It expires in "
                        f"{cfg['code_ttl_seconds'] // 60} minutes.",
                    )
                except telegram_service.TelegramError as exc:
                    await _log_failure(pb, owner, api_key, phone, "telegram", exc.message)
                    raise DeliveryFailed(
                        channel="telegram", detail=exc.message[:300], retryable=exc.retryable
                    ) from exc

        # Delivered: append audit row + store the hashed code (single-use).
        # Known limitation: if these writes fail the code WAS delivered — a
        # plain client retry may double-send (reconcile manually via
        # wa_message_id); a retry carrying the same Idempotency-Key is safe.
        try:
            row = await pb.create(
                wa_collection("messages"),
                {
                    "owner": owner["id"],
                    "api_key": api_key["id"],
                    "phone": phone,
                    "channel": body.channel,
                    "wa_message_id": provider_message_id,
                    "status": "sent",
                    "cost_type": "free",
                    "error": "",
                },
            )
            await create_otp(
                pb, owner["id"], api_key["id"], phone, code, cfg["code_ttl_seconds"], now
            )
        except PocketBaseError as exc:
            logger.critical(
                "ledger write failed after delivery — reconcile wa_message_id=%s "
                "channel=%s owner=%s phone=%s",
                provider_message_id,
                body.channel,
                owner["id"],
                phone,
                exc_info=exc,
            )
            raise DeliveryFailed(
                channel=body.channel,
                detail="delivered but not recorded; manual reconciliation required",
            ) from exc

    response_body = {
        "ok": True,
        "mode": "platform",
        "channel": body.channel,
        "request_id": row["id"],
        "wa_message_id": provider_message_id,
        "expires_in": cfg["code_ttl_seconds"],
        # Telegram sends do not consume quota: report the current WhatsApp count.
        "free_used": used + 1 if body.channel == "whatsapp" else used,
        "free_limit": cfg["free_monthly_limit"],
        "reset_utc": reset_utc_iso(now),
    }
    if idem is not None:
        # Replay window = the code's lifetime; past expiry a retry must send
        # a fresh code, not replay a dead one. Only successes are cached —
        # failed sends stay retryable.
        idempotency_store.put((api_key["id"], idem), response_body, cfg["code_ttl_seconds"])
    return response_body


@router.post("/verify", response_model=VerifyOut, responses=VERIFY_RESPONSES)
async def verify_otp_route(body: VerifyIn, request: Request, ctx=Depends(require_api_key)):
    phone = normalize_phone(body.to)
    if phone is None:
        raise InvalidRequest(detail="to must be a valid phone number")
    cfg = ctx["config"]
    # Per-(owner, phone) lock: two concurrent verifies of the same code must
    # not both consume the single-use row (double spend).
    async with verify_lock(ctx["owner"]["id"], phone):
        result = await verify_otp(
            request.app.state.pb,
            ctx["owner"]["id"],
            phone,
            body.code,
            cfg["max_attempts"],
            _utcnow(),
        )
    if result["result"] == "verified":
        return {"ok": True, "verified": True}
    error_map = {
        "wrong": "wrong_code",
        "too_many_attempts": "too_many_attempts",
        "not_found": "code_expired",
    }
    resp = {
        "ok": False,
        "verified": False,
        "error": error_map.get(result["result"], result["result"]),
    }
    if "attempts_left" in result:
        resp["attempts_left"] = result["attempts_left"]
    if result["result"] == "not_found":
        resp["detail"] = "request a new code"
    return JSONResponse(status_code=400, content=resp)


@router.get("/usage", response_model=UsageOut, responses=USAGE_RESPONSES)
async def usage(request: Request, ctx=Depends(require_api_key)):
    now = _utcnow()
    used = await monthly_used(request.app.state.pb, ctx["owner"]["id"], now)
    return {
        "plan": ctx["owner"].get("plan") or "free",
        "used": used,
        "limit": ctx["config"]["free_monthly_limit"],
        "reset_utc": reset_utc_iso(now),
    }


def get_mock_delivery(request: Request) -> bool:
    from ..core.config import get_settings

    return get_settings().waotp_mock_delivery


async def _log_failure(pb, owner, api_key, phone, channel, error):
    # Failed sends never consume quota — but they are always auditable.
    # Best-effort: if the audit row itself cannot be written, log it and let
    # the original DeliveryFailed propagate — a control-plane hiccup must not
    # mask the delivery failure the caller needs to see.
    try:
        await pb.create(
            wa_collection("messages"),
            {
                "owner": owner["id"],
                "api_key": api_key["id"],
                "phone": phone,
                "channel": channel,
                "wa_message_id": "",
                "status": "failed",
                "cost_type": "free",
                "error": (error or "")[:500],
            },
        )
    except Exception:
        logger.critical(
            "audit row for failed send could not be written — channel=%s "
            "owner=%s phone=%s error=%s",
            channel, owner["id"], phone, (error or "")[:300],
            exc_info=True,
        )
