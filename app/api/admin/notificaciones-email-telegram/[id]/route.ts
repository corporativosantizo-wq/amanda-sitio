// ============================================================================
// app/api/admin/notificaciones-email-telegram/[id]/route.ts
// PATCH: actualizar regla · DELETE: eliminar regla
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  actualizarNotificacion,
  eliminarNotificacion,
  NotificacionError,
} from '@/lib/services/notificaciones-email-telegram.service';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const regla = await actualizarNotificacion(id, body);
    return NextResponse.json(regla);
  } catch (err) {
    const msg = err instanceof NotificacionError ? err.message : 'Error al actualizar regla';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    await eliminarNotificacion(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof NotificacionError ? err.message : 'Error al eliminar regla';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
