// ============================================================================
// app/api/admin/expedientes/[id]/route.ts
// GET: Detalle expediente · PATCH: Actualizar expediente
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  obtenerExpediente, actualizarExpediente, ExpedienteError,
} from '@/lib/services/expedientes.service';
import { handleApiError } from '@/lib/api-error';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const result = await obtenerExpediente(id);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ExpedienteError) {
      const status = err.message.includes('no encontrado') ? 404 : 500;
      return NextResponse.json({ error: err.message }, { status });
    }
    return handleApiError(err, 'expedientes/[id]/GET');
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const expediente = await actualizarExpediente(id, body);
    return NextResponse.json({ expediente });
  } catch (err) {
    if (err instanceof ExpedienteError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return handleApiError(err, 'expedientes/[id]/PATCH');
  }
}
