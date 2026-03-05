// ============================================================================
// lib/auth/cron-auth.ts
// Autenticación segura para endpoints cron / machine-to-machine
// ============================================================================

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

/**
 * Verifica autenticación de cron jobs usando comparación timing-safe.
 *
 * Soporta dos patrones de header:
 * - Authorization: Bearer {CRON_SECRET}
 * - x-cron-secret: {CRON_SECRET}
 *
 * @returns null si la autenticación es exitosa, NextResponse 401/500 si falla
 */
export function requireCronAuth(req: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    console.error('[Cron Auth] CRON_SECRET no configurado');
    return NextResponse.json(
      { error: 'Configuración de servidor incompleta' },
      { status: 500 },
    );
  }

  // Aceptar Bearer token o x-cron-secret header
  const authHeader = req.headers.get('authorization');
  const cronHeader = req.headers.get('x-cron-secret')?.trim();

  let providedSecret: string | null = null;

  if (authHeader?.startsWith('Bearer ')) {
    providedSecret = authHeader.slice(7).trim();
  } else if (cronHeader) {
    providedSecret = cronHeader;
  }

  if (!providedSecret) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  // Comparación timing-safe para prevenir ataques de timing
  if (!safeCompare(providedSecret, cronSecret)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  return null; // Auth exitosa
}

function safeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) {
      // Comparar contra sí mismo para mantener tiempo constante
      timingSafeEqual(bufB, bufB);
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}
