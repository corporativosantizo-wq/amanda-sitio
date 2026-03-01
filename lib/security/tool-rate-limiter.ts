// ============================================================================
// lib/security/tool-rate-limiter.ts
// Rate limiter in-memory para tools del Asistente IA
// Nota: se resetea con cada cold start de serverless. Aceptable para ventanas
// cortas. Para persistencia robusta, migrar a Upstash Redis.
// ============================================================================

interface RateLimitConfig {
  maxCalls: number;
  windowMs: number;
}

const TOOL_LIMITS: Record<string, RateLimitConfig> = {
  'enviar_email':              { maxCalls: 10, windowMs: 3600000 },   // 10/hora
  'enviar_email_con_adjunto':  { maxCalls: 5,  windowMs: 3600000 },   // 5/hora
  'consultar_base_datos':      { maxCalls: 50, windowMs: 3600000 },   // 50/hora
  'crear_cotizacion_completa': { maxCalls: 10, windowMs: 3600000 },   // 10/hora
  'gestionar_cobros':          { maxCalls: 20, windowMs: 3600000 },   // 20/hora
};

// toolName → array of timestamps (epoch ms)
const callLog: Map<string, number[]> = new Map();

export function checkToolRateLimit(toolName: string): {
  allowed: boolean;
  remaining: number;
  resetIn: number;
} {
  const config = TOOL_LIMITS[toolName];
  if (!config) {
    return { allowed: true, remaining: -1, resetIn: 0 };
  }

  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Get timestamps, prune expired
  let timestamps = callLog.get(toolName) ?? [];
  timestamps = timestamps.filter((t: number) => t > windowStart);
  callLog.set(toolName, timestamps);

  const remaining = config.maxCalls - timestamps.length;

  if (remaining <= 0) {
    const oldestInWindow = timestamps[0];
    const resetIn = oldestInWindow + config.windowMs - now;
    console.warn(`[tool-rate-limiter] Rate limit hit: ${toolName}, 0 calls remaining, resets in ${Math.round(resetIn / 60000)}min`);
    return { allowed: false, remaining: 0, resetIn };
  }

  // Record this call
  timestamps.push(now);

  return { allowed: true, remaining: remaining - 1, resetIn: 0 };
}
