"""Meta WhatsApp webhook: handshake + status callbacks.

Failure-first: every section below asserts what happens on bad input (wrong
token, bad signature, unparseable body, unknown message id, unexpected status)
before the happy path.
"""

import hashlib
import hmac
import json

import pytest

from tests.conftest import add_developer

VERIFY_TOKEN = "test-verify-token"
APP_SECRET = "test-app-secret"


def _settings(monkeypatch, **env):
    """Set env vars and drop the cached Settings so they take effect.

    Passing "" is meaningful: it forces a value to empty even when the
    developer's own backend/.env sets it, so these tests are hermetic.
    """
    from app.core.config import get_settings

    for key, value in env.items():
        monkeypatch.setenv(key, value)
    get_settings.cache_clear()


def _sign(body: bytes, secret: str = APP_SECRET) -> str:
    return "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def _status_payload(message_id="mock-abc123", status="delivered", error=None):
    status_obj = {
        "id": message_id,
        "status": status,
        "timestamp": "1700000000",
        "recipient_id": "919876543210",
    }
    if error:
        status_obj["errors"] = [{"title": error}]
    return {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "WABA_ID",
                "changes": [
                    {"field": "messages", "value": {"statuses": [status_obj]}}
                ],
            }
        ],
    }


def _post(client, payload, *, secret=APP_SECRET, signature=None):
    body = json.dumps(payload).encode()
    headers = {"Content-Type": "application/json"}
    if secret is not None:
        headers["X-Hub-Signature-256"] = (
            signature if signature is not None else _sign(body, secret)
        )
    return client.post("/webhooks/whatsapp", content=body, headers=headers)


# ---- GET handshake -------------------------------------------------------


def test_handshake_rejects_when_verify_token_not_configured(client, monkeypatch):
    """An unconfigured install must not accept a handshake it cannot check."""
    c, _ = client
    _settings(monkeypatch, META_VERIFY_TOKEN="")

    r = c.get(
        "/webhooks/whatsapp",
        params={
            "hub.mode": "subscribe",
            "hub.verify_token": "",
            "hub.challenge": "12345",
        },
    )
    assert r.status_code == 403
    assert r.json()["error"] == "forbidden"


def test_handshake_rejects_wrong_token(client, monkeypatch):
    c, _ = client
    _settings(monkeypatch, META_VERIFY_TOKEN=VERIFY_TOKEN)

    r = c.get(
        "/webhooks/whatsapp",
        params={
            "hub.mode": "subscribe",
            "hub.verify_token": VERIFY_TOKEN + "x",
            "hub.challenge": "12345",
        },
    )
    assert r.status_code == 403


def test_handshake_rejects_wrong_mode(client, monkeypatch):
    """A matching token with hub.mode != subscribe is still a rejection."""
    c, _ = client
    _settings(monkeypatch, META_VERIFY_TOKEN=VERIFY_TOKEN)

    r = c.get(
        "/webhooks/whatsapp",
        params={
            "hub.mode": "unsubscribe",
            "hub.verify_token": VERIFY_TOKEN,
            "hub.challenge": "12345",
        },
    )
    assert r.status_code == 403


def test_handshake_rejects_missing_params(client, monkeypatch):
    c, _ = client
    _settings(monkeypatch, META_VERIFY_TOKEN=VERIFY_TOKEN)
    r = c.get("/webhooks/whatsapp")
    assert r.status_code == 403


def test_handshake_echoes_challenge(client, monkeypatch):
    """The challenge must come back verbatim, as plain text."""
    c, _ = client
    _settings(monkeypatch, META_VERIFY_TOKEN=VERIFY_TOKEN)

    r = c.get(
        "/webhooks/whatsapp",
        params={
            "hub.mode": "subscribe",
            "hub.verify_token": VERIFY_TOKEN,
            "hub.challenge": "1158201444",
        },
    )
    assert r.status_code == 200
    assert r.text == "1158201444"


# ---- POST signature ------------------------------------------------------


def test_post_rejects_bad_signature(client, monkeypatch):
    c, fake = client
    _settings(monkeypatch, META_VERIFY_TOKEN=VERIFY_TOKEN, META_APP_SECRET=APP_SECRET)

    r = _post(c, _status_payload(), signature="sha256=" + "0" * 64)
    assert r.status_code == 403
    assert fake.records["messages"] == {}


def test_post_rejects_missing_signature_when_secret_is_set(client, monkeypatch):
    c, _ = client
    _settings(monkeypatch, META_VERIFY_TOKEN=VERIFY_TOKEN, META_APP_SECRET=APP_SECRET)

    r = _post(c, _status_payload(), secret=None)
    assert r.status_code == 403


def test_post_rejects_signature_from_the_wrong_secret(client, monkeypatch):
    """A valid-looking HMAC computed with a different key must not pass."""
    c, _ = client
    _settings(monkeypatch, META_VERIFY_TOKEN=VERIFY_TOKEN, META_APP_SECRET=APP_SECRET)

    r = _post(c, _status_payload(), secret="some-other-secret")
    assert r.status_code == 403


def test_post_accepts_valid_signature(client, monkeypatch):
    c, fake = client
    add_developer(fake)
    _settings(monkeypatch, META_VERIFY_TOKEN=VERIFY_TOKEN, META_APP_SECRET=APP_SECRET)
    fake.records["messages"]["m1"] = {
        "id": "m1", "owner": "usr1", "wa_message_id": "mock-abc123",
        "channel": "whatsapp", "status": "sent", "error": "",
    }

    r = _post(c, _status_payload(status="delivered"))
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["applied"] == 1
    assert fake.records["messages"]["m1"]["status"] == "delivered"


def test_post_without_app_secret_is_accepted_and_reported(client, monkeypatch):
    """Documented trade-off: without META_APP_SECRET the signature cannot be
    checked, so callbacks are accepted unsigned — and /health/ready says so."""
    c, fake = client
    add_developer(fake)
    _settings(monkeypatch, META_VERIFY_TOKEN=VERIFY_TOKEN, META_APP_SECRET="")
    fake.records["messages"]["m1"] = {
        "id": "m1", "owner": "usr1", "wa_message_id": "mock-abc123",
        "channel": "whatsapp", "status": "sent", "error": "",
    }

    r = _post(c, _status_payload(), secret=None)
    assert r.status_code == 200
    assert fake.records["messages"]["m1"]["status"] == "delivered"

    ready = c.get("/health/ready")
    assert ready.status_code == 200
    assert ready.json()["webhook"]["signature_check_enabled"] is False


# ---- POST body handling --------------------------------------------------


def test_post_signed_non_json_is_accepted(client, monkeypatch):
    """Signed but unparseable: 200, because Meta retrying could never help."""
    c, _ = client
    _settings(monkeypatch, META_VERIFY_TOKEN=VERIFY_TOKEN, META_APP_SECRET=APP_SECRET)

    body = b"not json at all"
    r = c.post(
        "/webhooks/whatsapp",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-Hub-Signature-256": _sign(body),
        },
    )
    assert r.status_code == 200
    assert r.json()["ok"] is True


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"entry": []},
        {"entry": [{"changes": []}]},
        {"entry": [{"changes": [{"value": {}}]}]},
        {"entry": [{"changes": [{"value": {"statuses": []}}]}]},
        {"entry": "not-a-list"},
        {"entry": [None, 1, "x"]},
        {"entry": [{"changes": [{"value": {"statuses": [None, 5]}}]}]},
    ],
)
def test_post_malformed_payload_never_500s(client, monkeypatch, payload):
    """A payload shape we do not recognise must not raise: Meta would retry
    forever, and the retry would fail identically."""
    c, _ = client
    _settings(monkeypatch, META_VERIFY_TOKEN=VERIFY_TOKEN, META_APP_SECRET=APP_SECRET)

    r = _post(c, payload)
    assert r.status_code == 200
    assert r.json()["ok"] is True
    assert r.json()["applied"] == 0


def test_post_unknown_message_id_is_ignored(client, monkeypatch):
    c, fake = client
    _settings(monkeypatch, META_VERIFY_TOKEN=VERIFY_TOKEN, META_APP_SECRET=APP_SECRET)

    r = _post(c, _status_payload(message_id="wamid.something-we-never-sent"))
    assert r.status_code == 200
    assert r.json()["applied"] == 0


def test_post_unmodelled_status_is_skipped(client, monkeypatch):
    """Meta sends statuses we do not model (e.g. "deleted"); writing one would
    violate the select field, so it must be skipped, not attempted."""
    c, fake = client
    add_developer(fake)
    _settings(monkeypatch, META_VERIFY_TOKEN=VERIFY_TOKEN, META_APP_SECRET=APP_SECRET)
    fake.records["messages"]["m1"] = {
        "id": "m1", "owner": "usr1", "wa_message_id": "mock-abc123",
        "channel": "whatsapp", "status": "sent", "error": "",
    }

    r = _post(c, _status_payload(status="deleted"))
    assert r.status_code == 200
    assert r.json()["applied"] == 0
    assert fake.records["messages"]["m1"]["status"] == "sent"


def test_post_failed_status_records_provider_error(client, monkeypatch):
    c, fake = client
    add_developer(fake)
    _settings(monkeypatch, META_VERIFY_TOKEN=VERIFY_TOKEN, META_APP_SECRET=APP_SECRET)
    fake.records["messages"]["m1"] = {
        "id": "m1", "owner": "usr1", "wa_message_id": "mock-abc123",
        "channel": "whatsapp", "status": "sent", "error": "",
    }

    r = _post(c, _status_payload(status="failed", error="Recipient not on WhatsApp"))
    assert r.status_code == 200
    row = fake.records["messages"]["m1"]
    assert row["status"] == "failed"
    assert "Recipient not on WhatsApp" in row["error"]


def test_late_duplicate_callback_does_not_reopen_a_terminal_state(client, monkeypatch):
    """Meta can deliver callbacks out of order; a stale "sent" must not roll a
    delivered message back."""
    c, fake = client
    add_developer(fake)
    _settings(monkeypatch, META_VERIFY_TOKEN=VERIFY_TOKEN, META_APP_SECRET=APP_SECRET)
    fake.records["messages"]["m1"] = {
        "id": "m1", "owner": "usr1", "wa_message_id": "mock-abc123",
        "channel": "whatsapp", "status": "read", "error": "",
    }

    r = _post(c, _status_payload(status="sent"))
    assert r.status_code == 200
    assert fake.records["messages"]["m1"]["status"] == "read"


def test_post_survives_pocketbase_failure(client, monkeypatch):
    """A control-plane error must not become a 5xx, or Meta retries the same
    doomed callback in a loop."""
    c, fake = client
    add_developer(fake)
    _settings(monkeypatch, META_VERIFY_TOKEN=VERIFY_TOKEN, META_APP_SECRET=APP_SECRET)

    async def boom(*args, **kwargs):
        from app.services.pocketbase import PocketBaseError
        raise PocketBaseError(500, "pb on fire")

    monkeypatch.setattr(fake, "list", boom)

    r = _post(c, _status_payload())
    assert r.status_code == 200
    assert r.json()["ok"] is True
    assert r.json()["applied"] == 0


def test_post_inbound_message_event_is_not_a_status(client, monkeypatch):
    """A user replying to the OTP is an inbound message, not a status change;
    it must not touch any messages row."""
    c, fake = client
    add_developer(fake)
    _settings(monkeypatch, META_VERIFY_TOKEN=VERIFY_TOKEN, META_APP_SECRET=APP_SECRET)
    fake.records["messages"]["m1"] = {
        "id": "m1", "owner": "usr1", "wa_message_id": "mock-abc123",
        "channel": "whatsapp", "status": "sent", "error": "",
    }

    payload = {
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "messages": [
                                {"id": "wamid.inbound", "from": "919876543210",
                                 "text": {"body": "hello"}}
                            ]
                        }
                    }
                ]
            }
        ]
    }
    r = _post(c, payload)
    assert r.status_code == 200
    assert r.json()["applied"] == 0
    assert fake.records["messages"]["m1"]["status"] == "sent"
