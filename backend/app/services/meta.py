"""WhatsApp Cloud API delivery: authentication template with the code in the
body parameter AND in the Copy-Code URL button parameter (Meta requires it twice)."""

import httpx

GRAPH_BASE = "https://graph.facebook.com/v21.0"
_TIMEOUT = 15.0


class MetaError(Exception):
    def __init__(self, message: str, wa_message_id: str = "", retryable: bool = False):
        self.message = message
        self.wa_message_id = wa_message_id
        # True only for transient failures (timeout/unreachable); HTTP
        # rejections (bad token, unapproved template) are not retryable.
        self.retryable = retryable
        super().__init__(message)


async def send_otp_template(
    client: httpx.AsyncClient,
    phone_number_id: str,
    token: str,
    to_phone: str,
    code: str,
    template_name: str,
    template_lang: str,
) -> str:
    """Returns the wa_message_id; raises MetaError on rejection."""
    payload = {
        "messaging_product": "whatsapp",
        "to": to_phone,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": template_lang},
            "components": [
                {"type": "body", "parameters": [{"type": "text", "text": code}]},
                {
                    "type": "button",
                    "sub_type": "url",
                    "index": "0",
                    "parameters": [{"type": "text", "text": code}],
                },
            ],
        },
    }
    try:
        r = await client.post(
            f"{GRAPH_BASE}/{phone_number_id}/messages",
            headers={"Authorization": f"Bearer {token}"},
            json=payload,
            timeout=_TIMEOUT,
        )
    except httpx.RequestError as exc:
        # Transport-level failure (timeout, DNS, connection reset) -> retryable.
        raise MetaError(f"meta unreachable: {exc.__class__.__name__}", retryable=True) from exc

    if r.status_code >= 400:
        raise MetaError(r.text[:500])
    data = r.json()
    messages = data.get("messages") or [{}]
    return messages[0].get("id", "")
