// ============================================================================
// /api/admin/notas-entrega/[id]
// GET    → obtener una
// PATCH  → actualizar (regenera PDF)
// DELETE → eliminar
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';
import {
  obtenerNotaEntrega,
  actualizarNotaEntrega,
  eliminarNotaEntrega,
  NotaEntregaError,
} from '@/lib/services/notas-entrega.service';
import { handleApiError } from '@/lib/api-error';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;
  try {
    const { id } = await ctx.params;
    const nota = await obtenerNotaEntrega(id);
    return NextResponse.json(nota);
  } catch (err) {
    if (err instanceof NotaEntregaError) return NextResponse.json({ error: err.message }, { status: 404 });
    return handleApiError(err, 'notas-entrega/[id]/GET');
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const nota = await actualizarNotaEntrega(id, {
      fecha: body.fecha,
      documentos_entregados: body.documentos_entregados,
      documentos_recibidos: body.documentos_recibidos,
      notas: body.notas,
      estado: body.estado,
    });
    return NextResponse.json(nota);
  } catch (err) {
    if (err instanceof NotaEntregaError) return NextResponse.json({ error: err.message }, { status: 400 });
    return handleApiError(err, 'notas-entrega/[id]/PATCH');
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;
  try {
    const { id } = await ctx.params;
    await eliminarNotaEntrega(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof NotaEntregaError) return NextResponse.json({ error: err.message }, { status: 400 });
    return handleApiError(err, 'notas-entrega/[id]/DELETE');
  }
}
