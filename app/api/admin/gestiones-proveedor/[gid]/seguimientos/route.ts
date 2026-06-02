// ============================================================================
// app/api/admin/gestiones-proveedor/[gid]/seguimientos/route.ts
// POST: registrar un seguimiento para la gestión (actualiza ultimo_seguimiento)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { crearSeguimiento, GestionError } from '@/lib/services/gestiones-proveedor.service';

type Ctx = { params: Promise<{ gid: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { gid } = await ctx.params;
    const body = await req.json();
    const seguimiento = await crearSeguimiento(gid, body);
    return NextResponse.json(seguimiento, { status: 201 });
  } catch (err) {
    const msg = err instanceof GestionError ? err.message : 'Error al registrar seguimiento';
    const status = err instanceof GestionError && msg.includes('obligatori') ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
