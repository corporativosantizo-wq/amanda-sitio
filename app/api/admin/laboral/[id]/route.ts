// ============================================================================
// app/api/admin/laboral/[id]/route.ts
// GET: Detalle trámite · PATCH: Actualizar · DELETE: Eliminar
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  obtenerTramiteLaboral, actualizarTramiteLaboral,
  eliminarTramiteLaboral, LaboralError,
} from '@/lib/services/laboral.service';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const result = await obtenerTramiteLaboral(id);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof LaboralError ? err.message : 'Error interno';
    const status = msg.includes('no encontrado') ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const tramite = await actualizarTramiteLaboral(id, body);
    return NextResponse.json({ tramite });
  } catch (err) {
    const msg = err instanceof LaboralError ? err.message : 'Error al actualizar';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    await eliminarTramiteLaboral(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof LaboralError ? err.message : 'Error al eliminar';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
