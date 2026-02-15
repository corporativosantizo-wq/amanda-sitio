// ============================================================================
// app/api/admin/expedientes/[id]/route.ts
// GET: Detalle expediente · PATCH: Actualizar expediente
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  obtenerExpediente, actualizarExpediente, ExpedienteError,
} from '@/lib/services/expedientes.service';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const result = await obtenerExpediente(id);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof ExpedienteError ? err.message : 'Error interno';
    const status = msg.includes('no encontrado') ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const expediente = await actualizarExpediente(id, body);
    return NextResponse.json({ expediente });
  } catch (err) {
    const msg = err instanceof ExpedienteError ? err.message : 'Error al actualizar';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
