// ============================================================================
// app/api/admin/expedientes/[id]/actuaciones/[actuacionId]/route.ts
// PATCH: actualizar actuación · DELETE: eliminar actuación
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  actualizarActuacion, eliminarActuacion, obtenerActuacion, ExpedienteError,
} from '@/lib/services/expedientes.service';
import { requireAdmin } from '@/lib/auth/api-auth';
import { handleApiError } from '@/lib/api-error';
import { createAdminClient } from '@/lib/supabase/admin';

type Ctx = { params: Promise<{ id: string; actuacionId: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { actuacionId } = await ctx.params;
    const body = await req.json();

    // If documento_url is being replaced or removed, delete the previous file from Storage
    if ('documento_url' in body) {
      const previa = await obtenerActuacion(actuacionId);
      if (previa.documento_url && previa.documento_url !== body.documento_url) {
        const { error: rmErr } = await createAdminClient()
          .storage.from('documentos')
          .remove([previa.documento_url]);
        if (rmErr) console.error('[Actuaciones PATCH] No se pudo eliminar archivo previo:', rmErr.message);
      }
    }

    const actuacion = await actualizarActuacion(actuacionId, body);
    return NextResponse.json({ actuacion });
  } catch (err) {
    if (err instanceof ExpedienteError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return handleApiError(err, 'expedientes/actuaciones/PATCH');
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { actuacionId } = await ctx.params;
    await eliminarActuacion(actuacionId);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ExpedienteError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return handleApiError(err, 'expedientes/actuaciones/DELETE');
  }
}
