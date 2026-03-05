// ============================================================================
// lib/security/tool-guards.ts
// Pre-execution validations for AI tools (rate limits + input validation)
// ============================================================================

import { checkToolRateLimit } from './tool-rate-limiter';

const ALLOWED_FROM_ADDRESSES = new Set([
  'amanda@papeleo.legal',
  'asistente@papeleo.legal',
  'contador@papeleo.legal',
]);

/**
 * Runs all pre-execution checks for a tool. Returns null if ok,
 * or a string error message to return to the LLM instead of executing.
 */
export function guardToolExecution(toolName: string, input: any): string | null {
  // 1. Rate limit check
  const rateCheck = checkToolRateLimit(toolName);
  if (!rateCheck.allowed) {
    const minutes = Math.ceil(rateCheck.resetIn / 60000);
    return `Rate limit exceeded for ${toolName}. Try again in ~${minutes} minutes. This limit exists to prevent accidental mass operations.`;
  }

  // 2. Tool-specific validations
  switch (toolName) {
    case 'enviar_email':
      return validateEnviarEmail(input);
    case 'enviar_email_con_adjunto':
      return validateEnviarEmailConAdjunto(input);
    default:
      return null;
  }
}

// ── Email validations ────────────────────────────────────────────────────────

function validateEnviarEmail(input: any): string | null {
  if (!input) return 'Input is required for enviar_email.';

  // Subject validation (via datos.asunto for personalizado type)
  if (input.tipo_email === 'personalizado') {
    const asunto = input.datos?.asunto;
    if (!asunto || typeof asunto !== 'string' || !asunto.trim()) {
      return 'El campo datos.asunto es obligatorio para emails personalizados.';
    }
  }

  // Recipient count (email_directo can have comma-separated addresses)
  if (input.email_directo) {
    const recipients = input.email_directo.split(',').map((e: string) => e.trim()).filter(Boolean);
    if (recipients.length > 10) {
      return `Demasiados destinatarios (${recipients.length}). Máximo permitido: 10.`;
    }
  }

  return null;
}

function validateEnviarEmailConAdjunto(input: any): string | null {
  if (!input) return 'Input is required for enviar_email_con_adjunto.';

  // Subject must not be empty
  if (!input.asunto || typeof input.asunto !== 'string' || !input.asunto.trim()) {
    return 'El campo asunto es obligatorio para enviar email con adjunto.';
  }

  // Recipient count
  if (input.email_directo) {
    const recipients = input.email_directo.split(',').map((e: string) => e.trim()).filter(Boolean);
    if (recipients.length > 10) {
      return `Demasiados destinatarios (${recipients.length}). Máximo permitido: 10.`;
    }
  }

  // Must have a file
  if (!input.archivo_url || typeof input.archivo_url !== 'string' || !input.archivo_url.trim()) {
    return 'El campo archivo_url es obligatorio para enviar email con adjunto.';
  }

  return null;
}
