// ============================================================================
// lib/rate-limit.ts
// Sliding-window rate limiter — in-memory for now, swap to Upstash Redis later
// ============================================================================

interface RateLimitEntry {
  timestamps: number[];
}

interface RateLimiterConfig {
  /** Max requests allowed within the window */
  max: number;
  /** Window size in milliseconds */
  windowMs: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

function getStore(prefix: string): Map<string, RateLimitEntry> {
  let store = stores.get(prefix);
  if (!store) {
    store = new Map();
    stores.set(prefix, store);
  }
  return store;
}

/**
 * Check and consume a rate limit token.
 * Returns { success, remaining } — if success is false, the request should be rejected.
 */
function checkLimit(
  prefix: string,
  identifier: string,
  config: RateLimiterConfig
): { success: boolean; remaining: number } {
  const store = getStore(prefix);
  const now = Date.now();
  const windowStart = now - config.windowMs;

  let entry = store.get(identifier);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(identifier, entry);
  }

  // Remove expired timestamps
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  if (entry.timestamps.length >= config.max) {
    return { success: false, remaining: 0 };
  }

  entry.timestamps.push(now);
  return { success: true, remaining: config.max - entry.timestamps.length };
}

// ── Pre-configured limiters ─────────────────────────────────────────────────

/** AI routes: 30 requests per minute per user */
export function checkAiRateLimit(userId: string): { success: boolean; remaining: number } {
  return checkLimit('ai', userId, { max: 30, windowMs: 60_000 });
}

/** Email sending: 10 emails per minute per user */
export function checkEmailRateLimit(userId: string): { success: boolean; remaining: number } {
  return checkLimit('email', userId, { max: 10, windowMs: 60_000 });
}

/** Comunicaciones masivas: 5 per minute per user */
export function checkMasivoRateLimit(userId: string): { success: boolean; remaining: number } {
  return checkLimit('masivo', userId, { max: 5, windowMs: 60_000 });
}
