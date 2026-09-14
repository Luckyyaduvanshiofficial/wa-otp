import PocketBase from 'pocketbase';

/**
 * PocketBase singleton for WA OTP.
 *
 * The auth collection is `${prefix}users` — for this deployment `waotp_users`.
 * NEVER the stock `users` collection: that belongs to another app on the same
 * shared PocketBase instance, and writing developer accounts into it would
 * merge the two projects. The prefix is the isolation mechanism, so it is
 * env-driven and must match `WAOTP_PB_COLLECTIONS_PREFIX` in `backend/.env`.
 *
 * The SDK persists the auth token in localStorage by default (LocalAuthStore),
 * which is acceptable for v1.
 */
export const PB_URL = process.env.NEXT_PUBLIC_PB_URL ?? 'https://pb.codaipro.com';

/**
 * Collection namespace shared with the backend. An unset *or empty* value
 * falls back to `waotp_` rather than to no prefix — an unprefixed build would
 * silently address the stock `users`/`api_keys` collections of whatever other
 * project lives on the same PocketBase instance.
 */
const configuredPrefix = (process.env.NEXT_PUBLIC_PB_COLLECTIONS_PREFIX ?? '').trim();
export const PB_COLLECTIONS_PREFIX = configuredPrefix || 'waotp_';

export const PB_USERS_COLLECTION = `${PB_COLLECTIONS_PREFIX}users`;

export interface WaotpUser {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  /** Quota tier. Set at signup; read by the backend's /v1/usage. */
  plan?: string;
  /** `active` | `suspended`. `suspended` disables every key the user owns. */
  status?: string;
  created: string;
  updated: string;
}

export const pb = new PocketBase(PB_URL);

export function pbUsers() {
  return pb.collection<WaotpUser>(PB_USERS_COLLECTION);
}

/**
 * Absolute origin of this app, used wherever PocketBase has to be told where
 * to send the user back to (password-reset emails). Prefers the configured
 * public URL — which is correct even when the form is served from a preview
 * host — and falls back to the browser origin.
 *
 * Returns '' during SSR when nothing is configured; callers must skip sending
 * a relative redirect and let PocketBase use its own default instead.
 */
export function appOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/+$/, '');
  return typeof window !== 'undefined' ? window.location.origin : '';
}
