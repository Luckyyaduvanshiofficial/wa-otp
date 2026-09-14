import hashlib
import hmac
import json
import secrets
import base64

from cryptography.fernet import Fernet, InvalidToken

from .config import get_settings

API_KEY_PREFIX = "waotp_"


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def generate_api_key() -> str:
    """Plaintext key; only its sha256 is ever stored."""
    return API_KEY_PREFIX + secrets.token_hex(20)


def generate_otp_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def normalize_phone(raw: str) -> str | None:
    """Canonical form: digits only, country code included. 10 digits => assume
    India (+91); 11 digits with a leading trunk 0 => drop it, then +91."""
    if not raw:
        return None
    digits = "".join(ch for ch in raw if ch.isdigit())
    if len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    if len(digits) == 10:
        digits = "91" + digits
    if not 10 <= len(digits) <= 15:
        return None
    return digits


def encrypt_secret(plaintext: str) -> str:
    f = Fernet(get_settings().waotp_fernet_key.encode())
    return f.encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_secret(ciphertext: str) -> str | None:
    try:
        f = Fernet(get_settings().waotp_fernet_key.encode())
        return f.decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except (InvalidToken, ValueError):
        return None


def _hmac_key() -> bytes:
    key = get_settings().waotp_fernet_key
    if not key:
        # dev fallback keeps the link flow testable without env setup
        key = "waotp-dev-link-token-key"
    return key.encode("utf-8")


def make_link_token(owner_id: str, phone: str) -> str:
    """Signed token embedded in the t.me deep link (?start=<token>).
    Lets the bot greet contextually; the real phone comes from the contact share."""
    payload = base64.urlsafe_b64encode(
        json.dumps({"o": owner_id, "p": phone}).encode()
    ).decode().rstrip("=")
    sig = hmac.new(_hmac_key(), payload.encode(), hashlib.sha256).hexdigest()[:16]
    return f"{payload}.{sig}"


def parse_link_token(token: str) -> dict | None:
    try:
        payload, sig = token.rsplit(".", 1)
        expected = hmac.new(_hmac_key(), payload.encode(), hashlib.sha256).hexdigest()[:16]
        if not hmac.compare_digest(sig, expected):
            return None
        padded = payload + "=" * (-len(payload) % 4)
        return json.loads(base64.urlsafe_b64decode(padded))
    except Exception:
        return None
