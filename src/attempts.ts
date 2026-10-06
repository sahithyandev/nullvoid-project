// In-memory login limiter, per account name and per IP. Resets on restart.
const WINDOW_MS = 15 * 60_000;
const LOCK_MS = 15 * 60_000;
const LIMITS = { user: 5, ip: 20 };

type Entry = { count: number; first: number; until: number };
const entries = new Map<string, Entry>();

const limitOf = (key: string) => LIMITS[key.startsWith("ip:") ? "ip" : "user"];

/** Keys for one login attempt. Keyed by the typed name, so unknown names lock too. */
export const attemptKeys = (username: string, ip: string) => [`user:${username.toLowerCase()}`, `ip:${ip}`];

/** Milliseconds left on the longest lock among the keys, 0 if none. */
export function lockedFor(keys: string[]): number {
  const now = Date.now();
  return Math.max(0, ...keys.map((k) => (entries.get(k)?.until ?? 0) - now));
}

/** Counts a failure on every key and locks a key that reaches its limit. */
export function fail(keys: string[]) {
  const now = Date.now();
  for (const k of keys) {
    let e = entries.get(k);
    if (!e || now - e.first > WINDOW_MS || (e.until && e.until <= now)) e = { count: 0, first: now, until: 0 };
    e.count++;
    if (e.count >= limitOf(k)) e.until = now + LOCK_MS;
    entries.set(k, e);
  }
}

/** Forgets a key, after a successful login. */
export const clear = (key: string) => entries.delete(key);

export function lockMessage(ms: number): string {
  const min = Math.ceil(ms / 60_000);
  return `Too many attempts. Try again in ${min} ${min === 1 ? "minute" : "minutes"}.`;
}
