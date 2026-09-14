import { pb, pbUsers } from '@/lib/pb';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

/**
 * Client timeout for every API call. The backend itself waits up to ~45 s on
 * the provider, so give it room — but never hang the UI waiting on a stuck
 * request. (The integrator docs advise a 30 s client timeout; we match it.)
 */
const REQUEST_TIMEOUT_MS = 30_000;

export class ApiError extends Error {
  status: number;
  code: string;
  extra: Record<string, unknown>;

  constructor(status: number, code: string, extra: Record<string, unknown> = {}) {
    super(code);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

function authedHeaders(extra: Record<string, string> = {}) {
  return {
    'Content-Type': 'application/json',
    ...(pb.authStore.isValid ? { Authorization: `Bearer ${pb.authStore.token}` } : {}),
    ...extra
  };
}

function toTransportError(e: unknown): ApiError {
  // AbortSignal.timeout() rejects with a DOMException named 'TimeoutError'
  // (spec) or 'AbortError' (older runtimes) — treat both as a timeout.
  if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
    return new ApiError(0, 'request_timeout', {
      message: 'The request timed out. Please try again.'
    });
  }
  return new ApiError(0, 'api_unreachable', {
    message: `Could not reach the API at ${API_URL}. Is the backend running?`
  });
}

/** fetch with a 30 s timeout; maps network/timeout failures to ApiError. */
async function request(path: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(`${API_URL}${path}`, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch (e) {
    throw toTransportError(e);
  }
}

async function parseError(res: Response): Promise<ApiError> {
  let code = 'request_failed';
  let extra: Record<string, unknown> = {};
  try {
    const body = (await res.json()) as Record<string, unknown>;
    if (typeof body.error === 'string') code = body.error;
    const { ok: _ok, error: _error, ...rest } = body;
    extra = rest;
  } catch {
    // non-JSON error body
  }
  return new ApiError(res.status, code, extra);
}

/**
 * JSON fetch against the FastAPI backend with the PocketBase bearer token.
 * On 401 invalid_user_token: refresh the PocketBase auth once and retry;
 * if the refresh fails, clear the auth store and send the user to /login.
 */
async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const send = () => request(path, { ...init, headers: { ...authedHeaders(), ...init.headers } });

  let res = await send();

  if (res.status === 401) {
    const err = await parseError(res);
    if (err.code === 'invalid_user_token') {
      try {
        await pbUsers().authRefresh();
        res = await send();
        if (res.ok) return (await res.json()) as T;
        throw await parseError(res);
      } catch (e) {
        // A transport failure during the retry is not an auth problem —
        // don't log the user out over a network blip.
        if (isApiError(e) && (e.code === 'api_unreachable' || e.code === 'request_timeout')) {
          throw e;
        }
        pb.authStore.clear();
        if (typeof window !== 'undefined') {
          const next = encodeURIComponent(window.location.pathname + window.location.search);
          window.location.assign(`/login?next=${next}`);
        }
        throw new ApiError(401, 'session_expired', {
          message: 'Your session expired. Please sign in again.'
        });
      }
    }
    throw err;
  }

  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

export interface ApiKey {
  id: string;
  last4: string;
  label: string;
  active: boolean;
  created: string;
}

export interface CreatedKey {
  api_key: string;
  last4: string;
  label: string;
  id: string;
}

export function createKey(label: string) {
  return apiFetch<CreatedKey>('/v1/keys', {
    method: 'POST',
    body: JSON.stringify({ label })
  });
}

export function listKeys() {
  return apiFetch<{ keys: ApiKey[] }>('/v1/keys');
}

export function regenerateKeys(label: string) {
  return apiFetch<CreatedKey>('/v1/keys/regenerate', {
    method: 'POST',
    body: JSON.stringify({ label })
  });
}

export function deactivateKey(id: string) {
  return apiFetch<{ ok: true }>(`/v1/keys/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
}

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

export interface Usage {
  plan: string;
  used: number;
  limit: number;
  reset_utc: string;
}

export function getUsage() {
  return apiFetch<Usage>('/v1/usage');
}

// ---------------------------------------------------------------------------
// OTP
// ---------------------------------------------------------------------------

export type OtpChannel = 'whatsapp' | 'telegram';

export interface SendOtpResult {
  ok: boolean;
  mode: string;
  channel: OtpChannel;
  request_id: string;
  wa_message_id?: string;
  expires_in: number;
  free_used?: number;
  free_limit?: number;
  reset_utc?: string;
}

export interface VerifyOtpResult {
  ok: boolean;
  verified?: boolean;
  attempts_left?: number;
}

/** OTP request with the same 30 s timeout + transport error mapping as
 * apiFetch, but auth travels in the X-Api-Key header — NOT the bearer token. */
async function otpFetch<T>(path: string, apiKey: string, body: unknown): Promise<T> {
  const res = await request(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey
    },
    body: JSON.stringify(body)
  });
  const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) {
    throw new ApiError(
      res.status,
      json?.error ?? 'request_failed',
      json ? ({ ...json } as Record<string, unknown>) : {}
    );
  }
  return json as T;
}

export function sendOtp(apiKey: string, body: { to: string; channel: OtpChannel; code?: string }) {
  return otpFetch<SendOtpResult>('/v1/otp/send', apiKey, body);
}

export function verifyOtp(apiKey: string, body: { to: string; code: string }) {
  return otpFetch<VerifyOtpResult>('/v1/otp/verify', apiKey, body);
}

// ---------------------------------------------------------------------------
// Error code → readable message (v1 dictionary; see /docs for the full table)
// ---------------------------------------------------------------------------

export const ERROR_MESSAGES: Record<string, string> = {
  api_unreachable: 'Could not reach the API server. Is the backend running?',
  request_timeout: 'The request timed out. Please try again.',
  invalid_request: 'The request was invalid — check the inputs.',
  invalid_api_key: 'That API key is not valid. Copy it again from the API Keys page.',
  invalid_user_token: 'Your session is invalid. Please sign in again.',
  session_expired: 'Your session expired. Please sign in again.',
  key_not_found: 'That API key was not found (or is not yours).',
  key_limit_reached: 'You already have 5 active keys. Deactivate one first.',
  quota_exceeded: 'Monthly free quota used up. Resets on the 1st; paid top-ups coming soon.',
  phone_throttled: 'Too many OTPs to this phone. Try again later.',
  rate_limited: 'Too many requests. Slow down and retry shortly.',
  delivery_failed: 'Delivery failed. You can safely retry.',
  user_not_linked: 'Telegram delivery needs you to link the @WAOTP bot first.',
  not_configured: 'This channel is not configured on the server yet.',
  key_disabled: 'This API key has been deactivated.',
  wrong_code: 'Wrong code. Check the code and try again.',
  too_many_attempts: 'Too many wrong attempts — request a new code.',
  code_expired: 'That code has expired (or was already used). Request a new one.',
  upstream_unavailable: 'The service is temporarily unavailable. Retry in a moment.',
  internal_error: 'Something went wrong on our side. Please try again.',
  request_failed: 'Something went wrong. Please try again.'
};

export function errorMessage(e: unknown): string {
  if (isApiError(e)) {
    if (e.code === 'delivery_failed') {
      const retryable = e.extra.retryable === true;
      return `${ERROR_MESSAGES.delivery_failed}${retryable ? '' : ' (not retryable)'}`;
    }
    return ERROR_MESSAGES[e.code] ?? e.code;
  }
  if (e instanceof Error && e.message) return e.message;
  return 'Something went wrong. Please try again.';
}
