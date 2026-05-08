// ============================================================================
// /api/admin/config/mensajes-telegram/[id]
// PATCH  → actualizar
// DELETE → eliminar
// GET    → obtener uno
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';
import {
  obtenerMensaje,
  actualizarMensaje,
  eliminarMensaje,
  MensajeTelegramError,
} from '@/lib/services/mensajes-telegram.service';
import { handleApiError } from '@/lib/api-error';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await ctx.params;
    const data = await obtenerMensaje(id);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof MensajeTelegramError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    return handleApiError(err, 'config/mensajes-telegram/[id]/GET');
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const data = await actualizarMensaje(id, body);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof MensajeTelegramError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return handleApiError(err, 'config/mensajes-telegram/[id]/PATCH');
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await ctx.params;
    await eliminarMensaje(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof MensajeTelegramError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return handleApiError(err, 'config/mensajes-telegram/[id]/DELETE');
  }
}
