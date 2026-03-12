// ============================================================================
// lib/api-error.ts
// Centralized API error handler — never exposes internal messages to clients
// ============================================================================

import { NextResponse } from 'next/server';

/**
 * Custom API error with separate public and internal messages.
 * Use this to throw errors where you want a specific user-facing message.
 *
 * @example
 * throw new ApiError(404, 'Cliente no encontrado');
 * throw new ApiError(400, 'NIT inválido', `NIT parse failed: ${rawNit}`);
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public userMessage: string,
    public internalMessage?: string
  ) {
    super(userMessage);
    this.name = 'ApiError';
  }
}

/**
 * Handles any error and returns a safe NextResponse.
 * - ApiError → uses its public userMessage
 * - Any other error → logs real message, returns generic "Error interno"
 *
 * @param error - The caught error
 * @param context - Optional label for log grouping (e.g. route name)
 */
export function handleApiError(error: unknown, context?: string): NextResponse {
  const tag = context ? `[${context}]` : '[API]';

  if (error instanceof ApiError) {
    console.error(`${tag} ApiError ${error.statusCode}:`, error.internalMessage || error.userMessage);
    return NextResponse.json(
      { error: error.userMessage },
      { status: error.statusCode }
    );
  }

  const message = error instanceof Error ? error.message : String(error);
  console.error(`${tag} Unhandled error:`, message);

  return NextResponse.json(
    { error: 'Error interno del servidor' },
    { status: 500 }
  );
}
