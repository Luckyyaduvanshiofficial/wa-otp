import pytest

from conftest import add_developer

SECRET = "test-webhook-secret"  # matches conftest env


@pytest.fixture(autouse=True)
def fake_tg_send(monkeypatch):
    """Never hit the real Bot API from tests; capture outgoing replies."""
    calls = []

    async def fake_send_message(client, bot_token, chat_id, text, reply_markup=None):
        calls.append({"chat_id": chat_id, "text": text, "markup": reply_markup})
        return "tg-msg-1"

    monkeypatch.setattr("app.services.telegram.send_message", fake_send_message)
    return calls


def post(c, update, secret=SECRET):
    headers = {"X-Telegram-Bot-Api-Secret-Token": secret} if secret else {}
    return c.post("/telegram/webhook", json=update, headers=headers)


def contact_update(user_id=555, phone="+91 98765 43210"):
    return {
        "message": {
            "chat": {"id": 777},
            "from": {"id": user_id, "is_bot": False},
            "contact": {"user_id": user_id, "phone_number": phone},
        }
    }


def test_webhook_requires_secret(client):
    c, fake = client
    add_developer(fake)
    fake.records["settings"]["set1"]["tg_bot_token"] = "TESTBOT:TOKEN"

    assert post(c, contact_update(), secret=None).status_code == 403
    assert post(c, contact_update(), secret="wrong").status_code == 403
    assert post(c, contact_update()).status_code == 200


def test_webhook_contact_share_links_number(client, fake_tg_send):
    c, fake = client
    add_developer(fake)
    calls = fake_tg_send

    r = post(c, contact_update())
    assert r.status_code == 200

    links = list(fake.records["tg_links"].values())
    assert len(links) == 1
    assert links[0]["phone"] == "919876543210"  # normalized
    assert links[0]["chat_id"] == "777"
    assert links[0]["tg_user_id"] == "555"
    assert "✅" in calls[0]["text"]

    # re-sharing updates instead of duplicating (unique phone index)
    post(c, contact_update(user_id=555, phone="+919876543210"))
    assert len(fake.records["tg_links"]) == 1
    assert list(fake.records["tg_links"].values())[0]["chat_id"] == "777"


def test_webhook_rejects_someone_elses_contact(client):
    """PRD risk: only accept a shared contact when contact.user_id == from.id."""
    c, fake = client
    add_developer(fake)

    # contact says 555 but the actual sender is 999 -> refuse
    update = contact_update(user_id=555)
    update["message"]["from"]["id"] = 999
    post(c, update)
    assert not fake.records["tg_links"]


def test_webhook_start_sends_contact_keyboard(client, fake_tg_send):
    c, fake = client
    add_developer(fake)
    fake.records["settings"]["set1"]["tg_bot_token"] = "TESTBOT:TOKEN"
    calls = fake_tg_send

    update = {
        "message": {
            "chat": {"id": 777},
            "from": {"id": 555},
            "text": "/start abc.def",
        }
    }
    assert post(c, update).status_code == 200
    assert len(calls) == 1
    markup = calls[0]["markup"]
    assert markup["keyboard"][0][0]["request_contact"] is True
    # unparseable payload -> generic greeting (no number echoed)
    assert "43210" not in calls[0]["text"]


def test_webhook_start_with_valid_link_token_tail(client, fake_tg_send):
    c, fake = client
    add_developer(fake)
    from app.core.security import make_link_token

    token = make_link_token("usr1", "919876543210")
    update = {
        "message": {
            "chat": {"id": 777},
            "from": {"id": 555},
            "text": f"/start {token}",
        }
    }
    assert post(c, update).status_code == 200
    assert "3210" in fake_tg_send[0]["text"]  # masked tail of 919876543210


def test_webhook_ignores_when_bot_unconfigured(client):
    c, fake = client
    add_developer(fake)
    fake.records["settings"]["set1"]["tg_bot_token"] = ""
    assert post(c, contact_update()).status_code == 200
    assert not fake.records["tg_links"]


def test_webhook_pb_outage_returns_503_for_retry(client, fake_tg_send, monkeypatch):
    """PocketBase failure during the tg_links upsert -> 503 so Telegram retries."""
    c, fake = client
    add_developer(fake)
    from app.services.pocketbase import PocketBaseError
    from conftest import FakePB

    original_create = FakePB.create

    async def create_fails(self, collection, data):
        if collection == "tg_links":
            raise PocketBaseError(500, "pb down")
        return await original_create(self, collection, data)

    monkeypatch.setattr(FakePB, "create", create_fails)
    r = post(c, contact_update())
    assert r.status_code == 503
    assert r.json() == {"ok": False, "error": "upstream_unavailable"}
    assert not fake.records["tg_links"]
    assert not fake_tg_send  # no linked-confirmation sent; the retry re-links
