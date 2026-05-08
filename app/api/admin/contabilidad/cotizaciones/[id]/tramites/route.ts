// ============================================================================
// app/api/admin/contabilidad/cotizaciones/[id]/tramites/route.ts
// GET  → lista trámites de la cotización (con avances + items)
// POST → crea un nuevo trámite (opcionalmente con item_ids para asignarlos)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { listarTramitesDeCotizacion, crearTramite, TramiteError } from '@/lib/services/tramites.service';
import { handleApiError } from '@/lib/api-error';
import type { EstadoTramite } from '@/lib/types';

type RouteParams = { params: Promise<{ id: string }> };

const ESTADOS: EstadoTramite[] = ['pendiente','en_proceso','completado','suspendido'];

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { requireAdmin } = await import('@/lib/auth/api-auth');
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    const tramites = await listarTramitesDeCotizacion(id);
    return NextResponse.json({ data: tramites });
  } catch (error) {
    if (error instanceof TramiteError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleApiError(error, 'cotizaciones/[id]/tramites GET');
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { requireAdmin } = await import('@/lib/auth/api-auth');
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
    if (!nombre) {
      return NextResponse.json({ error: 'El nombre del trámite es obligatorio' }, { status: 400 });
    }
    const estado: EstadoTramite | undefined =
      typeof body.estado === 'string' && (ESTADOS as string[]).includes(body.estado)
        ? body.estado as EstadoTramite
        : undefined;
    const itemIds: string[] | undefined =
      Array.isArray(body.item_ids) && body.item_ids.every((x: unknown) => typeof x === 'string')
        ? (body.item_ids as string[])
        : undefined;

    const t = await crearTramite({
      cotizacion_id: id,
      nombre,
      estado,
      item_ids: itemIds,
    });
    return NextResponse.json(t, { status: 201 });
  } catch (error) {
    if (error instanceof TramiteError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleApiError(error, 'cotizaciones/[id]/tramites POST');
  }
}
