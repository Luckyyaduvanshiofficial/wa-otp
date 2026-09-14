/**
 * One-session handoff of a freshly created plaintext API key to the tester
 * page, via sessionStorage. Plaintext keys are shown exactly once in the UI
 * and are never persisted anywhere else.
 */
const KEY = 'waotp:last-plaintext-key';

export interface HandoffKey {
  api_key: string;
  last4: string;
  label: string;
}

export function stashPlaintextKey(key: HandoffKey) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(key));
  } catch {
    // sessionStorage unavailable (private mode etc.) — prefill is optional
  }
}

export function takePlaintextKey(): HandoffKey | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as HandoffKey;
  } catch {
    return null;
  }
}
