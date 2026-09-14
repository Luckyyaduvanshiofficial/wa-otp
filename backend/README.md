# WA OTP — Backend

FastAPI hot path + PocketBase control plane for the WhatsApp/Telegram OTP
gateway (see `../PRD.md`).

> **Status Notice:**
> - **Backend & Frontend are 100% complete and tested (61 automated tests passing).**
> - **Telegram OTP is 100% active, free, and unmetered** — zero KYC, zero credit cards, ready for immediate use.
> - **Meta WhatsApp API:** Integration is complete (Meta Graph API v25.0). Running a production-wide number requires legal business registration (GST/incorporation), an international credit card (Indian debit cards fail on recurring auto-debit per RBI rules), and an unlinked dedicated SIM ([Meta Help 159334372093366](https://www.facebook.com/business/help/159334372093366?__tn__=%2BR)). Self-hosters and businesses with a verified Meta Business Account can plug credentials in and go live immediately.

Integrator API reference: [docs/api.md](docs/api.md)

```
Mini app backend ──▶ FastAPI :8000  ──▶ Meta Cloud API / Telegram Bot API
                        │  ▲
          reads/writes  ▼  │ superuser REST
                   PocketBase :8090  ◀── operator browser (admin UI = back office)
```

## Quick start (local dev)

```bash
cd backend

# 1. one-time setup
python3 -m venv .venv                      # (already done)
.venv/bin/pip install -r requirements-dev.txt
cp .env.example .env                       # fill in superuser email/password + fernet key
.venv/bin/python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# 2. PocketBase (binary already downloaded; collections auto-migrate on start)
cd pocketbase
./pocketbase superuser upsert you@local devpass123
./pocketbase serve --http=127.0.0.1:8090   # serves admin UI at http://127.0.0.1:8090/_/
cd ..

# 3. API
.venv/bin/uvicorn app.main:app --port 8000  # docs at http://127.0.0.1:8000/docs

# 4. create a dev developer + API key
.venv/bin/python scripts/seed_dev.py dev@waotp.local devpass123
```

With `WAOTP_MOCK_DELIVERY=1` (default in the example env) the full
send → verify → quota → ledger flow runs without any Meta/Telegram credentials;
delivery is faked but every DB row is real.

## API (base path `/v1`)

Auth for OTP routes: `X-Api-Key` header (sha256-hashed in `api_keys`,
cached 60 s; regenerated/deactivated keys are evicted immediately).
Dashboard routes: `Authorization: Bearer <PocketBase user token>`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/v1/otp/send` | api key | `{to, channel: whatsapp\|telegram, code?}` + optional `Idempotency-Key` header (replay-deduped for the code's lifetime) → per-key lock → quota → throttle → deliver → audit row + hashed code. Returns `{ok, mode, channel, request_id, wa_message_id, expires_in, free_used, free_limit, reset_utc}` |
| POST | `/v1/otp/verify` | api key | `{to, code}` — 5-min TTL, 3 attempts, single-use (per-(owner, phone) lock prevents concurrent double-spend) |
| GET | `/v1/otp/usage` | api key | `{plan, used, limit, reset_utc}` — `used` counts WhatsApp-delivered sends only |
| GET/POST | `/v1/keys` | PB user token | list masked keys / issue (201, plaintext shown once; max **5 active keys** per owner) |
| POST | `/v1/keys/regenerate` | PB user token | deactivate old (cache-invalidated), issue new |
| DELETE | `/v1/keys/{id}` | PB user token | retire one key (soft delete: `active=false` + cache invalidation; `404 key_not_found` for foreign/unknown ids) |
| POST | `/v1/keys/deactivate` | PB user token | deprecated alias of `DELETE /v1/keys/{id}`, kept for existing clients |
| GET | `/v1/usage` | PB user token | dashboard usage view |
| POST | `/telegram/webhook` | secret header | `/start` + contact share → `tg_links` (PB failures → `503` so Telegram retries) |
| GET | `/v1/health` | — | `200` when PocketBase is reachable, `503 upstream_unavailable` otherwise |

Interactive OpenAPI docs are served at `/docs` (Swagger UI; the Authorize
button works with both the `X-Api-Key` and dashboard-bearer schemes) and
`/openapi.json` — error responses and their example bodies are declared on
every route, generated from the same catalog as
[docs/api.md](docs/api.md) §7.

Quota semantics (PRD §7): the free monthly quota applies to **WhatsApp only** —
Telegram OTP is unlimited and free. `monthly_used`, `free_used` and
`/v1/otp/usage.used` all count WhatsApp-delivered sends; a Telegram send
reports the current WhatsApp count without incrementing it. The per-phone
hourly throttle applies to **both** channels (victim-number protection), as
does the per-key rate limit. Concurrency: a single uvicorn worker holds a
per-key asyncio lock around each send (quota check → provider delivery →
ledger writes) and a per-(owner, phone) lock around each verify.

Errors (PRD §6): `400` bad input · `401` bad key/token · `403` key disabled ·
`404` `key_not_found` · `409` `user_not_linked` (+ `link_url` deep link) /
`key_limit_reached` · `429` `quota_exceeded` / `phone_throttled` /
`rate_limited` · `502` `delivery_failed` · `503` `not_configured` /
`upstream_unavailable` · `500` `internal_error`. Body shape:
`{"ok": false, "error": "<code>", ...}`. 429 responses carry `Retry-After`
(`60` for per-key rate limit, `3600` for per-phone throttle, seconds-until-
monthly-reset for `quota_exceeded`); `delivery_failed` carries `retryable`
(`true` only for provider timeouts/unreachable — HTTP rejections and ledger
failures are not retryable). Validation errors return whitelisted
`detail: [{loc, msg, type}]` — raw input is never echoed.
**Failed sends never consume quota** (logged in `messages` with `status=failed`).
Known limitation: if the PocketBase ledger write fails *after* a successful
delivery the API returns `502 delivery_failed` (retryable: false) and logs the
`wa_message_id` for manual reconciliation — an automatic retry may double-send
(clients can avoid this with the `Idempotency-Key` header, documented in
[docs/api.md](docs/api.md) §3). Operator note: deactivating a key from the PB
admin UI (as opposed to via `DELETE /v1/keys/{id}`) takes effect only after the
60 s auth-cache TTL — the API routes evict the cache immediately, the admin UI
cannot.

## Telegram link flow

1. Mini app calls `/v1/otp/send` with `channel:"telegram"` for an unlinked
   phone → `409 {error:"user_not_linked", link_url:"https://t.me/<bot>?start=<signed token>"}`.
2. Mini app shows a "Connect Telegram" button opening that URL.
3. Bot replies with a *share contact* keyboard (`/telegram/webhook` handles
   `/start`); the shared contact is accepted **only if `contact.user_id == from.id`**.
4. `tg_links` is upserted; the mini app retries `/send` — OTP arrives on Telegram.

Register the webhook once (after setting the bot token in PB settings):
`.venv/bin/python scripts/set_telegram_webhook.py https://api-waotp.codaipro.com`
Use `openssl rand -hex 32` for the secret — **hex, not base64**: Telegram's
`secret_token` allows only letters, digits, `_` and `-`, and base64 emits
`+`, `/` and `=` which it rejects.

## Going live (swap mock for real delivery)

1. Meta developer app → WhatsApp → test number + temporary token; create the
   `verification_code` authentication template (en_US, `{{1}}` in body +
   Copy-Code button); allow-list your test numbers.
2. Encrypt the token and put it in PB admin → `settings`:
   `.venv/bin/python -c "from app.core.security import encrypt_secret; print(encrypt_secret('YOUR_META_TOKEN'))"`
   → paste into `meta_token_enc`; fill `meta_phone_number_id`.
   The app reads Meta config from `settings` — no redeploy needed.
3. Create the Telegram bot with @BotFather; store `tg_bot_token` +
   `tg_bot_username` (no `@` — it is concatenated into the `t.me/` deep link)
   in `settings`. Generate `TELEGRAM_WEBHOOK_SECRET` with `openssl rand -hex 32`
   and set it **both** in the deployed service's environment and in the local
   `.env` you run the script from: the script registers the secret with
   Telegram, the service checks incoming updates against its own copy, and if
   the two differ every update is rejected with 403 — which looks like a dead
   bot with no error anywhere.
4. Register the webhook:
   `.venv/bin/python scripts/set_telegram_webhook.py https://api-waotp.codaipro.com`
5. Set `WAOTP_MOCK_DELIVERY=0`.

Limits (500/month WhatsApp-only, 5/phone/hour both channels, 300 s TTL,
3 attempts, 10 req/min per key, 5 active keys per owner) live in the single
`settings` row — editable from the PB admin UI with no code changes. Env
values are only fallbacks.

## Shared PocketBase instances

All wa-otp collections can be namespaced with a prefix
(`WAOTP_PB_COLLECTIONS_PREFIX`, default `waotp_`) so one self-hosted
PocketBase can host multiple projects. With a prefix set, wa-otp also gets its
**own auth collection** (`waotp_users`) — developer accounts, tokens and data
are then fully separate from other apps on the instance; the other apps' users
collection is never touched. Provision with:

```bash
.venv/bin/python scripts/provision_pb.py --url https://pb.codaipro.com \
    --email you@x.com --password '***'      # or PB_SUPERUSER_* env vars
```

Idempotent: existing collections are never modified (stale `owner` relations
from an earlier unprefixed-users run are rebuilt only when the collections are
empty), and the settings seed row is only created when empty. Developer signup
is public by default (`waotp_users.createRule = ""` — normal email+password
signup, login, and password reset via the instance's SMTP; set it to `null`
for invite-only operation). For dedicated single-app
deployments keep the JS migration (empty prefix = logical collection names,
stock `users` extended with plan/status).

## Tests

```bash
.venv/bin/pytest -q     # 61 tests, no network needed (PocketBase/Meta/Telegram faked)
```

## Deployment

Two hosts, split by lifecycle (PRD §10):

**PocketBase — the existing VPS.** systemd binary, bound to localhost behind
Caddy, which also terminates TLS for `pb.…`. This instance is shared with
another project, so the prefix matters: provision wa-otp with
`WAOTP_PB_COLLECTIONS_PREFIX=waotp_` (see [Shared PocketBase
instances](#shared-pocketbase-instances)) and never blank it. `pb_data` must be
backed up (Litestream) — the wallet ledger is real money. Pin PocketBase
v0.40.x: the JSVM migration uses the v0.40 collection/field API and explicit
autodate fields (required for indexes on `created`/`updated` in migrations).

**This API — Render.** `../render.yaml` is a Blueprint: Render Dashboard →
New → Blueprint → pick the repo; it serves `api-waotp.codaipro.com`. It sets `rootDir: backend` (the monorepo fix —
the repo root has no `requirements.txt`), builds with
`pip install -r requirements.txt`, and starts

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1
```

Render prompts for every `sync: false` secret in that file on first deploy.
Four things about it are deliberate:

- **`--workers 1` is a correctness constraint, not a default.** Per-key asyncio
  locks around sends, the per-(owner, phone) verify locks, the process-local
  idempotency store in `app/dependencies.py`, and the cached PocketBase
  superuser token all assume one process. Do not scale this service
  horizontally without redesigning that state.
- **No `healthCheckPath`,** so Render uses its port-bind check. `/v1/health`
  queries PocketBase and returns 503 when it is unreachable, and the first PB
  call pays superuser bcrypt latency (`app/main.py` notes >15 s on slow VPSes) —
  as a Render health check that would time out and fail deploys on cold boots,
  and would tie deploy success to the VPS being up. Point UptimeRobot at
  `/v1/health` instead; that is where upstream-aware alerting belongs.
- **`WAOTP_MOCK_DELIVERY=0`.** Any other value fakes provider delivery while
  still writing every DB row, which is a silent outage in production.
- **`DASHBOARD_ORIGIN` is a required secret,** not optional. It is a
  single-origin CORS allowlist; a missing or mismatched value (trailing slash,
  wrong host) presents as a dead backend. Set it after the Vercel deploy
  produces the real origin — see `../frontend/docs/deployment.md`.

Real Meta/Telegram credentials are *not* Render env vars. They are
Fernet-encrypted in the PocketBase `settings` row and read from there, so
rotating them needs no redeploy — only `WAOTP_FERNET_KEY` must stay stable
across environments or previously stored ciphertext becomes unreadable.

First-deploy checklist beyond the Blueprint: run `scripts/provision_pb.py`
against the shared instance once, set the Telegram webhook with the same
`secret_token` you gave `TELEGRAM_WEBHOOK_SECRET`, and confirm
`/v1/health` returns `{"ok": true}` on the public URL.

## Layout

```
app/
  core/       config (env), security (sha256/Fernet/link tokens), error types
  services/   pocketbase REST client · settings cache · quota/throttle ·
              otp store · meta Cloud API · telegram Bot API
  routers/    otp (send/verify/usage) · keys+dashboard usage ·
              telegram webhook · health
  dependencies.py   X-Api-Key auth (+60 s cache) · PB-user-token auth · rate limiter ·
                    send-idempotency store · per-key/per-verify asyncio locks
pocketbase/   binary + pb_migrations (8 collections, admin-only) + pb_data (runtime)
scripts/      seed_dev.py · provision_pb.py · set_telegram_webhook.py
tests/        pytest suite (FakePB in-memory control plane, mock delivery)
```
