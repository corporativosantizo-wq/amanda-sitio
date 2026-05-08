// ============================================================================
// app/api/admin/contabilidad/tramites/[id]/route.ts
// GET    → detalle del trámite con avances + items
// PATCH  → actualizar nombre/estado/orden
// DELETE → eliminar trámite (avances cascade; items quedan con tramite_id NULL)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  obtenerTramite,
  actualizarTramite,
  eliminarTramite,
  TramiteError,
} from '@/lib/services/tramites.service';
import { handleApiError } from '@/lib/api-error';
import type { ActualizarTramiteInput, EstadoTramite } from '@/lib/types';

type RouteParams = { params: Promise<{ id: string }> };
const ESTADOS: EstadoTramite[] = ['pendiente','en_proceso','completado','suspendido'];

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { requireAdmin } = await import('@/lib/auth/api-auth');
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    const t = await obtenerTramite(id);
    return NextResponse.json(t);
  } catch (error) {
    if (error instanceof TramiteError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return handleApiError(error, 'tramites/[id] GET');
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { requireAdmin } = await import('@/lib/auth/api-auth');
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const input: ActualizarTramiteInput = {};
    if (typeof body.nombre === 'string') input.nombre = body.nombre;
    if (typeof body.estado === 'string' && (ESTADOS as string[]).includes(body.estado)) {
      input.estado = body.estado as EstadoTramite;
    }
    if (typeof body.orden === 'number') input.orden = body.orden;
    const t = await actualizarTramite(id, input);
    return NextResponse.json(t);
  } catch (error) {
    if (error instanceof TramiteError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleApiError(error, 'tramites/[id] PATCH');
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { requireAdmin } = await import('@/lib/auth/api-auth');
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    await eliminarTramite(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof TramiteError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleApiError(error, 'tramites/[id] DELETE');
  }
}
