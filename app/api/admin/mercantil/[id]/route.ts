// ============================================================================
// app/api/admin/mercantil/[id]/route.ts
// GET: Detalle trámite · PATCH: Actualizar · DELETE: Eliminar
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  obtenerTramiteMercantil, actualizarTramiteMercantil,
  eliminarTramiteMercantil, MercantilError,
} from '@/lib/services/mercantil.service';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const result = await obtenerTramiteMercantil(id);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof MercantilError ? err.message : 'Error interno';
    const status = msg.includes('no encontrado') ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const tramite = await actualizarTramiteMercantil(id, body);
    return NextResponse.json({ tramite });
  } catch (err) {
    const msg = err instanceof MercantilError ? err.message : 'Error al actualizar';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    await eliminarTramiteMercantil(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof MercantilError ? err.message : 'Error al eliminar';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
