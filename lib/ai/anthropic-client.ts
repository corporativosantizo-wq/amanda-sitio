// ============================================================================
// lib/ai/anthropic-client.ts
// Centralized Anthropic client — single source of truth
// ============================================================================

/**
 * Anthropic client with zero-data-retention enabled.
 * REQUIRED by professional secrecy obligations (Colegio de Abogados de Guatemala).
 * This ensures Anthropic does not retain any prompts or responses.
 */

import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (client) return client;
  client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
    defaultHeaders: {
      'anthropic-beta': 'zero-data-retention',
    },
  });
  return client;
}
