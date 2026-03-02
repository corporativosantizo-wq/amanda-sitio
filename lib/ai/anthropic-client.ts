// ============================================================================
// lib/ai/anthropic-client.ts
// Centralized Anthropic client — single source of truth
// ============================================================================

/**
 * Centralized Anthropic client.
 * Zero-data-retention is now configured at the workspace level in the
 * Anthropic console — the beta header is no longer accepted by the API.
 */

import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (client) return client;
  client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  });
  return client;
}
