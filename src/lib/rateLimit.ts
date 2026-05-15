const store = new Map<string, number[]>();

/**
 * Simple in-memory rate limiter.
 * Returns true if the request is allowed, false if the limit has been exceeded.
 * Note: resets across Vercel cold-starts; suitable for abuse deterrence, not strict enforcement.
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const prev = (store.get(key) ?? []).filter((t) => now - t < windowMs);
  if (prev.length >= maxRequests) {
    store.set(key, prev);
    return false;
  }
  store.set(key, [...prev, now]);
  return true;
}
