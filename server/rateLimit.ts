export type RateLimiter = {
  check(key: string): { allowed: true } | { allowed: false; retryAfterMs: number };
};

// Fixed-window, in-memory limiter. Good enough for a single small instance;
// a multi-instance deployment should move this to Redis or the platform edge.
export function createRateLimiter({
  windowMs,
  maxRequests,
  now = Date.now,
}: {
  windowMs: number;
  maxRequests: number;
  now?: () => number;
}): RateLimiter {
  const windows = new Map<string, { start: number; count: number }>();

  return {
    check(key) {
      const time = now();

      if (windows.size > 5000) {
        for (const [storedKey, window] of windows) {
          if (time - window.start >= windowMs) windows.delete(storedKey);
        }
      }

      const current = windows.get(key);
      if (!current || time - current.start >= windowMs) {
        windows.set(key, { start: time, count: 1 });
        return { allowed: true };
      }

      if (current.count >= maxRequests) {
        return {
          allowed: false,
          retryAfterMs: windowMs - (time - current.start),
        };
      }

      current.count += 1;
      return { allowed: true };
    },
  };
}
