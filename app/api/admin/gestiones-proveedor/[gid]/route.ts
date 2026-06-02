// ============================================================================
// app/api/admin/gestiones-proveedor/[gid]/route.ts
// PATCH: actualizar gestión · DELETE: eliminar gestión (cascade seguimientos)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  actualizarGestion,
  eliminarGestion,
  GestionError,
} from '@/lib/services/gestiones-proveedor.service';

type Ctx = { params: Promise<{ gid: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { gid } = await ctx.params;
    const body = await req.json();
    const gestion = await actualizarGestion(gid, body);
    return NextResponse.json(gestion);
  } catch (err) {
    const msg = err instanceof GestionError ? err.message : 'Error al actualizar gestión';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { gid } = await ctx.params;
    await eliminarGestion(gid);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof GestionError ? err.message : 'Error al eliminar gestión';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
