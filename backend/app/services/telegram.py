"""Telegram Bot API (free, no quota): sendMessage + contact-share prompt."""

import httpx

_API = "https://api.telegram.org"
_TIMEOUT = 15.0


class TelegramError(Exception):
    def __init__(self, message: str, message_id: str = "", retryable: bool = False):
        self.message = message
        self.message_id = message_id
        # True only for transient failures (timeout/unreachable); Bot API
        # rejections (bad token, blocked chat) are not retryable.
        self.retryable = retryable
        super().__init__(message)


async def send_message(
    client: httpx.AsyncClient,
    bot_token: str,
    chat_id: str,
    text: str,
    reply_markup: dict | None = None,
) -> str:
    """Returns the telegram message_id; raises TelegramError on rejection."""
    payload: dict = {"chat_id": chat_id, "text": text}
    if reply_markup is not None:
        payload["reply_markup"] = reply_markup
    try:
        r = await client.post(
            f"{_API}/bot{bot_token}/sendMessage", json=payload, timeout=_TIMEOUT
        )
    except httpx.RequestError as exc:
        # Transport-level failure (timeout, DNS, connection reset) -> retryable.
        raise TelegramError(
            f"telegram unreachable: {exc.__class__.__name__}", retryable=True
        ) from exc

    data = r.json()
    if r.status_code >= 400 or not data.get("ok"):
        raise TelegramError(str(data.get("description") or r.text)[:500])
    return str((data.get("result") or {}).get("message_id", ""))


def share_contact_keyboard() -> dict:
    return {
        "keyboard": [[{"text": "📲 Share my number", "request_contact": True}]],
        "resize_keyboard": True,
        "one_time_keyboard": True,
    }
