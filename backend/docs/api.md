# WA OTP — Integrator API Reference

**Audience:** mini-app developers adding phone OTP to their app.
**API version:** 0.1.0 · Last updated: 2026-09-14

WA OTP is a two-call OTP gateway: send a code over WhatsApp or Telegram, then verify it.
WhatsApp gets you 500 delivered OTPs/month free; Telegram is unlimited and costs ₹0 forever.
Most developers finish in one sitting — grab a key, fire two requests, done.

> The operator / deployment / bot-setup doc lives in [`backend/README.md`](../README.md).
> This page covers only the integrator-facing REST API.

**Conventions used here**

- Base URL: `https://api.yourdomain.in` — replace with the live host you were given.
- Every request and response is JSON; send `Content-Type: application/json`.
- Your API key looks like `waotp_xxxxxxxxxxxxxxxx` and travels in the `X-Api-Key` header.
- Values like `919876543210` and the key strings are placeholders — use your own.
- The live server also serves machine-readable OpenAPI docs at `/docs` (Swagger UI —
  use the **Authorize** button to try the API with your key) and `/openapi.json`.

### Endpoint map

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/v1/otp/send` | `X-Api-Key` | Deliver an OTP to a phone (supports an optional `Idempotency-Key` header, §3) |
| POST | `/v1/otp/verify` | `X-Api-Key` | Check the code the user typed |
| GET | `/v1/otp/usage` | `X-Api-Key` | Your monthly quota usage |
| GET | `/v1/keys` | Dashboard bearer token | List your keys (masked) |
| POST | `/v1/keys` | Dashboard bearer token | Issue a new key (`201 Created`) |
| POST | `/v1/keys/regenerate` | Dashboard bearer token | Rotate: kill all active keys, issue one new |
| DELETE | `/v1/keys/{id}` | Dashboard bearer token | Retire one key (soft delete: `active=false`) |
| POST | `/v1/keys/deactivate` | Dashboard bearer token | **Deprecated** alias of `DELETE /v1/keys/{id}` — use the DELETE form |
| GET | `/v1/usage` | Dashboard bearer token | Dashboard view of the same numbers as `/v1/otp/usage` |
| GET | `/v1/health` | none | Uptime probe (also shows mock mode) |

There is also `POST /telegram/webhook`, but that one is called **by Telegram**, not by you — ignore it.

---

## 1. Quickstart — first send + verify in under 5 minutes

### Step 1: get an API key

Easiest path: sign in to the dashboard, open **API Keys**, click **Create key**, copy the value.
It is shown **exactly once** — paste it somewhere safe now (see §2 for why).

Prefer the API? Issue a key with your dashboard bearer token:

```bash
curl -X POST https://api.yourdomain.in/v1/keys \
  -H "Authorization: Bearer YOUR_DASHBOARD_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"label": "my-mini-app"}'
```

Response (`201 Created`) — store `api_key` immediately, you will never see it again:

```json
{
  "api_key": "waotp_xxxxxxxxxxxxxxxx",
  "last4": "xxxx",
  "label": "my-mini-app",
  "id": "k8f3k2m9xq01zb4"
}
```

### Step 2: send an OTP

```bash
curl -X POST https://api.yourdomain.in/v1/otp/send \
  -H "X-Api-Key: waotp_xxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"to": "919876543210", "channel": "whatsapp"}'
```

The user gets a normal WhatsApp message with the code and a Copy button. Response:

```json
{
  "ok": true,
  "mode": "platform",
  "channel": "whatsapp",
  "request_id": "m8f3k2m9xq01zb4",
  "wa_message_id": "wamid.XXXXXXXXXX",
  "expires_in": 300,
  "free_used": 42,
  "free_limit": 500,
  "reset_utc": "2026-10-01T00:00:00Z"
}
```

Every field is explained in §3.

### Step 3: verify

```bash
curl -X POST https://api.yourdomain.in/v1/otp/verify \
  -H "X-Api-Key: waotp_xxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"to": "919876543210", "code": "123456"}'
```

Success:

```json
{ "ok": true, "verified": true }
```

That is the whole integration. Same flow in Python, end to end:

```python
import requests

BASE, KEY = "https://api.yourdomain.in", "waotp_xxxxxxxxxxxxxxxx"
H = {"X-Api-Key": KEY}
phone = "919876543210"

send = requests.post(f"{BASE}/v1/otp/send", headers=H, timeout=30,
                     json={"to": phone, "channel": "whatsapp"}).json()
print("sent; expires in", send["expires_in"], "s; free_used:", send["free_used"])

code = input("enter the code you received: ")
check = requests.post(f"{BASE}/v1/otp/verify", headers=H, timeout=30,
                      json={"to": phone, "code": code}).json()
if check.get("verified"):
    print("verified - continue signup")
else:
    print("failed:", check.get("error"), "| attempts_left:", check.get("attempts_left", 0))
```

Next: move both calls server-side (§9 explains why), and read §4 if you plan to use Telegram.

---

## 2. Authentication

All `/v1/otp/*` routes authenticate with your API key:

```
X-Api-Key: waotp_xxxxxxxxxxxxxxxx
```

- Keys start with `waotp_`. The gateway stores only a sha256 hash — the plaintext exists at
  creation time and nowhere else.
- **Shown once.** The creation response is the only time you ever see the full key. Lost it?
  Regenerate (below) — there is no recovery, by design.
- Keys resolve through a 60-second server-side cache, but regenerate and deactivate evict the
  old key immediately. Old keys stop working right away, not after the cache window.
- **Maximum 5 active keys** per developer. A 6th creation attempt returns
  `409 key_limit_reached` — deactivate an old key first.

### Key management endpoints

These are dashboard routes: they take `Authorization: Bearer <dashboard token>` — the token
your dashboard session holds after you log in — not the `X-Api-Key`.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/v1/keys` | — | `{"keys": [{"id", "last4", "label", "active", "created"}, ...]}` — masked, newest first |
| POST | `/v1/keys` | `{"label": "..."}` optional, default `"default"`, max 50 chars | `201` + `{"api_key", "last4", "label", "id"}` — plaintext shown once |
| POST | `/v1/keys/regenerate` | `{"label": "..."}` optional | Same shape as issue. **Deactivates ALL your active keys** (invalid immediately) and issues one fresh key |
| DELETE | `/v1/keys/{id}` | — | `{"ok": true}`. Unknown or foreign ids get `404 key_not_found` |
| POST | `/v1/keys/deactivate` | `{"id": "<key id>"}` | **Deprecated alias** for `DELETE /v1/keys/{id}` — identical behavior, kept for existing clients |
| GET | `/v1/usage` | — | `{"plan", "used", "limit", "reset_utc"}` — same numbers as `/v1/otp/usage` |

Regenerate semantics, in plain words: "make everything I currently have invalid and give me
one new key". Use it when a key leaks. Use `DELETE /v1/keys/{id}` when you just want to retire
one key — for example one per app or per environment.

---

## 3. POST /v1/otp/send

Delivers an OTP to one phone.

### Request

| Field | Type | Required | Notes |
|---|---|---|---|
| `to` | string | yes | 5–20 characters. Lenient about formatting: `+`, spaces and dashes are ignored. 10 digits are treated as India (+91); a leading trunk `0` is dropped. The normalized form is plain digits with country code, e.g. `919876543210`. Anything that does not normalize to a valid number gets `400 invalid_request` |
| `channel` | string | no | `"whatsapp"` (default) or `"telegram"` |
| `code` | string | no | Custom code: 4–10 characters, letters and digits only (`[A-Za-z0-9]`). Omit it and the gateway generates a random 6-digit numeric code. Custom codes are matched **exactly, case-sensitively** at verify time — `"AB12"` will not verify as `"ab12"` |

Telegram-channel example:

```bash
curl -X POST https://api.yourdomain.in/v1/otp/send \
  -H "X-Api-Key: waotp_xxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"to": "919876543210", "channel": "telegram"}'
```

### Idempotency (optional, recommended)

Sends are not idempotent by default: if your HTTP client times out *after* the
gateway delivered the message and you retry, the user gets a second code (only
the newest one verifies, §5). To make retries safe, send an `Idempotency-Key`
header — any unique string per logical send:

```bash
curl -X POST https://api.yourdomain.in/v1/otp/send \
  -H "X-Api-Key: waotp_xxxxxxxxxxxxxxxx" \
  -H "Idempotency-Key: signup-user-42-attempt-1" \
  -H "Content-Type: application/json" \
  -d '{"to": "919876543210", "channel": "whatsapp"}'
```

Rules:

- A retry with the **same** key inside the code's lifetime (`expires_in`, 5 min
  by default) returns the **original response** — no second message — with an
  `Idempotency-Replayed: true` header so you can tell it was a replay.
- The replay window equals the code TTL: after the code expires, a retry sends
  a **fresh** code (replaying a dead code's response would be a lie).
- Replays are keyed per API key + header value; two different values are two
  different sends. Only **successful** sends are cached — a failed send stays
  retryable, and a `409 user_not_linked` that later succeeds after linking is
  not shadowed by the earlier failure.
- Invalid header values (empty, over 255 chars, whitespace inside) return
  `400 invalid_request` rather than being ignored — if you think you have
  idempotency protection, you do.
- The cache is per-process with the code's lifetime; a gateway restart forgets
  it, and a retry then simply sends a new code. Fine for OTP semantics — this
  is dedupe, not exactly-once delivery.

Good key choices: `{purpose}-{user-id}-{attempt}` or a UUID you generate once
per send button press. The header is optional; omit it and behavior is exactly
as before.

### 200 response, field by field

```json
{
  "ok": true,
  "mode": "platform",
  "channel": "whatsapp",
  "request_id": "m8f3k2m9xq01zb4",
  "wa_message_id": "wamid.XXXXXXXXXX",
  "expires_in": 300,
  "free_used": 42,
  "free_limit": 500,
  "reset_utc": "2026-10-01T00:00:00Z"
}
```

| Field | Meaning |
|---|---|
| `ok` | `true` on success |
| `mode` | Always `"platform"` — the gateway generated and delivered the code. Exists so a future bring-your-own flow can be told apart; treat it as opaque |
| `channel` | Echoes the channel that was used |
| `request_id` | Ledger id of this send. **Keep it** — quote it in support requests; it is the fastest way to locate your message in the audit log |
| `wa_message_id` | Provider-side message id (`wamid.…` for WhatsApp, a numeric id for Telegram, `mock-…` in mock mode). Used for delivery reconciliation if anything looks off |
| `expires_in` | Seconds until the code expires — `300` (5 minutes) by default. Build your UI timer from this instead of hardcoding |
| `free_used` | WhatsApp sends used this UTC month. After a WhatsApp send it already includes that send; after a Telegram send it reports the current WhatsApp count (Telegram never increments it) |
| `free_limit` | Your monthly WhatsApp quota (500 by default) |
| `reset_utc` | When the quota window resets, ISO 8601 UTC — the first instant of the next UTC month |

Practical note: the gateway itself waits up to ~15 s on the provider, so give your HTTP client
a timeout of at least 30 s.

### Quota semantics (read once, save a support ticket)

- **The 500/month free quota is WhatsApp-only.** It counts *delivered* WhatsApp sends in the
  current UTC calendar month. Telegram OTP is **unlimited and ₹0** — never blocked by the
  monthly gate, never counted.
- **Per-phone limit: 5 sends/hour, across both channels.** This protects a victim number from
  someone hammering "resend" on a stolen screen.
- **Failed sends are never counted** — neither against the monthly quota nor the per-phone
  window — but they are always logged, so delivery problems stay auditable.
- A `409 user_not_linked` (§4) consumes nothing: no code is stored, no quota or throttle use.
- When the monthly cap is hit you get `429 quota_exceeded` with a `Retry-After` header saying
  exactly how long until reset (§7). Moving those sends to Telegram is the zero-cost workaround.

---

## 4. Telegram linking — the first OTP to a new phone

Telegram bots can only message people who started a chat with them first. So the very first
Telegram OTP to a phone bounces once, on purpose, with:

```json
{
  "ok": false,
  "error": "user_not_linked",
  "link_url": "https://t.me/<bot_username>?start=<signed-token>"
}
```

**Your job:** when you receive this, show a **"Connect Telegram"** button that opens
`link_url` — a normal `t.me` deep link that opens the gateway's bot with `/start` pre-filled.
Then the flow runs itself:

1. User taps the button → the bot opens in Telegram.
2. The bot greets them and shows a one-time keyboard with a single **"Share my number"**
   button (a Telegram `request_contact` button).
3. User taps it. The bot accepts the contact **only if it belongs to the sender themselves**
   (`contact.user_id == from.id`) — nobody can link a friend's number or a random person's.
4. The bot confirms the number is linked.
5. **Your mini app retries `POST /v1/otp/send`.** The OTP now arrives on Telegram. Call the
   same endpoint again — the 409 consumed nothing, so a plain retry is all it takes.

Linking is one-time per phone and platform-wide: once a user has connected to the bot, every
mini app on the gateway can deliver Telegram OTPs to them. There is no separate "check link
status" endpoint — the 409 *is* the check, and retrying is cheap.

The bot and its webhook run entirely on the gateway side; you register and host nothing.
(Operator-side setup — bot token, webhook registration — is in [`backend/README.md`](../README.md).)

---

## 5. POST /v1/otp/verify

Checks the code the user typed.

```json
{ "to": "919876543210", "code": "123456" }
```

- `to`: same normalization as `/send`.
- `code`: 1–10 characters. Codes are exact strings; custom codes are case-sensitive (§3).

### 200 — verified

```json
{ "ok": true, "verified": true }
```

### 400 — not verified

```json
{ "ok": false, "verified": false, "error": "wrong_code", "attempts_left": 2 }
```

| `error` | Meaning | Extra fields |
|---|---|---|
| `wrong_code` | Code did not match; the attempt counter went up. Default budget is 3 attempts per code | `attempts_left` — attempts remaining before the code is destroyed |
| `too_many_attempts` | The last allowed attempt was just burned. The code is deleted; request a new one | `attempts_left: 0` |
| `code_expired` | No active code for this phone — never issued, older than `expires_in` (5 min), already used, or already destroyed by attempts. Also returned when you re-verify a code that already succeeded | `detail: "request a new code"` |

Three behaviors worth knowing before you build:

- **Single-use.** A code dies the moment it verifies. Re-verifying the same code — even
  immediately, even correctly — returns `400 code_expired`.
- **Only the latest code counts.** Verify always checks the most recent active code for that
  phone. If you send twice, the first code stops verifying even if unexpired and unattempted.
  Don't send twice for one screen; if you must, tell the user to use the newest message.
- **Attempts are per code, not per phone.** At 3 wrong entries the current code dies; the user
  requests a fresh code and gets a fresh budget of 3.

---

## 6. GET /v1/otp/usage

```bash
curl https://api.yourdomain.in/v1/otp/usage \
  -H "X-Api-Key: waotp_xxxxxxxxxxxxxxxx"
```

```json
{
  "plan": "free",
  "used": 42,
  "limit": 500,
  "reset_utc": "2026-10-01T00:00:00Z"
}
```

| Field | Meaning |
|---|---|
| `plan` | Your plan — `"free"` today |
| `used` | WhatsApp sends delivered this UTC month. Telegram sends are not included (they are unlimited) |
| `limit` | Monthly WhatsApp quota |
| `reset_utc` | First instant of the next UTC month |

The dashboard shows the same numbers via `GET /v1/usage` (bearer-token auth).

---

## 7. Error reference

Every error body shares one skeleton, plus optional extras:

```json
{ "ok": false, "error": "<code>" }
```

| HTTP | `error` | When it happens | Extra fields | What to do |
|---|---|---|---|---|
| 400 | `invalid_request` | Malformed JSON, missing/short `to`, bad `code` pattern, unparseable phone number, invalid `Idempotency-Key` | `detail` (two shapes, below) | Fix the request. Retrying as-is changes nothing |
| 401 | `invalid_api_key` | `X-Api-Key` missing or unknown | `missing_header: true` when the header is absent entirely | Check the key. If it is lost, regenerate (§2) |
| 401 | `invalid_user_token` | Dashboard routes: missing or invalid bearer token | — | Re-login on the dashboard; the token comes from your dashboard session |
| 403 | `key_disabled` | Key was deactivated, or the owning account is suspended | — | Issue or re-enable a key; if suspended, contact the operator |
| 404 | `key_not_found` | `/v1/keys/deactivate` with an unknown id or another developer's id | — | Copy the id from `GET /v1/keys` |
| 409 | `user_not_linked` | Telegram send to a phone that has not connected to the bot yet | `link_url` | Show the "Connect Telegram" button (§4), then retry the send |
| 409 | `key_limit_reached` | Issuing a key while 5 active keys already exist | — | Deactivate an unused key first |
| 429 | `quota_exceeded` | Monthly WhatsApp quota (500 by default) exhausted | `free_used`, `free_limit`, `reset_utc` | Wait for `reset_utc` or move traffic to Telegram. `Retry-After` header = seconds until reset (minimum 60) |
| 429 | `phone_throttled` | More than 5 sends to the same phone in the trailing hour (both channels) | `retry_after_seconds: 3600` | Wait. `Retry-After: 3600`. Don't queue aggressive retries — that keeps the phone pinned at the limit |
| 429 | `rate_limited` | More than 10 requests/min on one key (all authenticated endpoints combined) | `retry_after_seconds: 60` | Back off. `Retry-After: 60`. Requests rejected with 429 do not count toward the window |
| 502 | `delivery_failed` | Provider (WhatsApp/Telegram) rejected or failed the delivery | `channel`, `detail`, `retryable` | Follow the `retryable` flag, below |
| 503 | `not_configured` | Operator has not finished provider setup for the chosen channel | `detail` | Not fixable from your side — contact the operator, or send on the other channel |
| 503 | `upstream_unavailable` | The gateway's control-plane store is down (also what `/v1/health` returns then) | — | Retry with exponential backoff; brief outages self-heal |
| 500 | `internal_error` | Unexpected gateway bug | — | Retry once with backoff; if it repeats, contact support with the timestamp and `request_id` |

### The `detail` field on 400 invalid_request

Two shapes, depending on what failed.

Field validation (missing or short fields, bad `code` pattern) — an array, at most 5 entries,
whitelisted fields only (your raw input is never echoed back):

```json
{
  "ok": false,
  "error": "invalid_request",
  "detail": [
    { "loc": ["body", "to"], "msg": "Field required", "type": "missing" }
  ]
}
```

Manual rejects (the phone number did not normalize) — a plain string:

```json
{
  "ok": false,
  "error": "invalid_request",
  "detail": "to must be a valid phone number (E.164, e.g. 919876543210)"
}
```

### The 502 `retryable` flag — your retry decision, made for you

`502 delivery_failed` always includes `"retryable": true` or `false`:

- **`retryable: true`** — a transient provider hiccup (timeout, network unreachable). Safe to
  retry, ideally with backoff.
- **`retryable: false`** — the provider said no and will say no again: typically the number is
  not on WhatsApp, is not yet in the Meta test-number allow-list, or the chat is blocked on
  Telegram. **Do not retry.** Failed sends don't consume quota, but retry storms add nothing —
  show the user a "check the number, or try WhatsApp instead" message.

One rare case: if the gateway delivers the message but then fails to record it in its ledger,
you get `502 delivery_failed` with `retryable: false` and a detail mentioning manual
reconciliation. If you retry anyway, the user gets a second code — and only the newest code
will verify (§5). When in doubt, contact support with the timestamp, phone and channel.

### Retry-After on 429s — recap

| Code | `Retry-After` header value |
|---|---|
| `rate_limited` | `60` |
| `phone_throttled` | `3600` (fixed value; the throttle looks back over a trailing hour) |
| `quota_exceeded` | Seconds until the UTC month resets, minimum `60` |

Always sleep for the header's value, not a guess of your own.

---

## 8. Limits & rate limiting

| Limit | Value | Scope | Notes |
|---|---|---|---|
| Monthly delivered OTPs | 500/month | Per developer, **WhatsApp only** | UTC calendar month; resets at `reset_utc` |
| Telegram sends | Unlimited, ₹0 | Per developer | Never counted, never blocked by the monthly gate |
| Per-phone sends | 5/hour | Per developer + phone, **both channels** | Trailing 1-hour window; protects the victim number |
| Verify attempts | 3 per code | Per code | The counter dies with the code; a new code means a fresh 3 |
| Code TTL | 300 s (5 min) | Per code | The `expires_in` value in the send response is authoritative |
| Per-key request rate | 10 requests/min | Per key, all authenticated endpoints combined | Sliding 60-second window; rejected 429 requests do not count |
| Active API keys | 5 | Per developer | Creating #6 returns `409 key_limit_reached` |
| Idempotency replay window | = code TTL (300 s) | Per key + `Idempotency-Key` value | Successful sends only; see §3 |

Practical notes:

- The rate limiter is a sliding window per key, not fixed slots — 10 rapid-fire calls at :59
  and 10 more at :01 will trip it. Space requests slightly if you send in bursts.
- Every authenticated call counts — send, verify and usage alike.
- These are platform defaults; the operator can tune them at any time. Treat `free_limit`,
  `expires_in` and `Retry-After` values in actual responses as the source of truth.

---

## 9. Security notes for integrators

- **Call the API from YOUR backend, never the browser.** Any key shipped in HTML/JS is public
  the moment the page loads. The gateway enforces this: CORS is locked to the dashboard origin,
  so browser apps cannot read responses anyway. Mini app frontend → your backend → WA OTP is
  the only supported shape.
- **Treat the key like a password.** It is shown once and stored server-side only as a sha256
  hash. Keep it in an environment variable or secret manager — never in git, never in client
  bundles, never in logs. Rotate with `/v1/keys/regenerate` if it leaks; rotation is instant.
- **Codes are secrets too.** Don't log the code you send or receive, and don't pass a custom
  `code` derivable from user data (birth date, phone digits). If you don't need a custom code,
  don't send one — the platform's random 6-digit code is the safer default.
- **Verify server-side and act on the result.** Only trust `{"ok": true, "verified": true}`
  from the API — never a client-side "user says they got the code" signal.
- **Expiry is a feature.** 5-minute TTL + 3 attempts + single-use is the entire anti-brute-force
  model. Don't work around it (for example by re-sending on every wrong attempt) — the
  per-phone throttle will stop you, and it should.
- **Respect `Retry-After`.** Backing off on 429/502 keeps you off the abuse radar.
- **Keep the `request_id`** of sends you care about. Support gets fast when you can say
  "my user reports no message arrived, request_id m8f3k2m9xq01zb4".

---

## 10. Sandbox / mock mode

The gateway can run with `WAOTP_MOCK_DELIVERY=1` (an operator setting): **delivery is faked,
but the API contract is identical** — same request fields, same responses, same errors, same
quota and throttle logic, and codes are really stored so `/verify` works end to end. That makes
it ideal for CI: your integration tests exercise the full send → verify flow without touching
WhatsApp or Telegram.

What you can observe in mock mode:

- `wa_message_id` values look like `mock-1a2b3c4d5e6f` instead of `wamid.…`.
- No real message arrives on the user's phone. For automated tests, send a **custom code** and
  verify with the same value — `{"to": "...", "code": "ci-test-1"}` … then verify `"ci-test-1"`.
- `GET /v1/health` tells you which mode the gateway is in:

```json
{ "ok": true, "pb": true, "mock_delivery": false }
```

If the control-plane store is unreachable, `/v1/health` returns
`503 {"ok": false, "error": "upstream_unavailable"}` instead — the same code you would see on
other endpoints during such an outage.
