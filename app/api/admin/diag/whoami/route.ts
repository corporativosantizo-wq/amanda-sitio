// ============================================================================
// GET /api/admin/diag/whoami
// Diagnóstico temporal Bug 1 (cobros 403): confirma rol PostgreSQL,
// auth.role() del JWT, GRANTs sobre legal.cobros y la sequence, y corre un
// INSERT de prueba con ROLLBACK automático.
// TODO(BUG-1-CLEANUP): borrar este endpoint después de aplicar el fix de cobros
// (también drop FUNCTION public.whoami()).
// ============================================================================

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const { requireAdmin } = await import('@/lib/auth/api-auth');
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const db = createAdminClient();
  // createAdminClient() apunta a schema 'legal' por default; whoami() vive en public.
  // @ts-ignore — .schema() existe en runtime aunque el tipo se queje
  const { data, error } = await db.schema('public').rpc('whoami');

  if (error) {
    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        error: error.message ?? String(error),
        code: (error as any).code ?? null,
        details: (error as any).details ?? null,
      },
      { status: 500 },
    );
  }

  // whoami() retorna jsonb → supabase-js lo entrega como objeto.
  // Si por algún motivo viniera envuelto en array, lo desempacamos.
  const payload = Array.isArray(data) ? data[0] : data;

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    ...(payload ?? {}),
  });
}
