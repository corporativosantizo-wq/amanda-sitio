// ============================================================================
// app/api/admin/expedientes/[id]/plazos/route.ts
// GET: Listar plazos · POST: Crear plazo · PATCH: Actualizar estado
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  listarPlazos, crearPlazo, actualizarPlazo, ExpedienteError,
} from '@/lib/services/expedientes.service';
import { handleApiError } from '@/lib/api-error';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const plazos = await listarPlazos(id);
    return NextResponse.json({ plazos });
  } catch (err) {
    if (err instanceof ExpedienteError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return handleApiError(err, 'expedientes/plazos/GET');
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const plazo = await crearPlazo({ ...body, expediente_id: id });
    return NextResponse.json({ plazo }, { status: 201 });
  } catch (err) {
    if (err instanceof ExpedienteError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return handleApiError(err, 'expedientes/plazos/POST');
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.plazo_id || !body.estado) {
      return NextResponse.json({ error: 'plazo_id y estado son obligatorios' }, { status: 400 });
    }
    const plazo = await actualizarPlazo(body.plazo_id, body.estado);
    return NextResponse.json({ plazo });
  } catch (err) {
    if (err instanceof ExpedienteError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return handleApiError(err, 'expedientes/plazos/PATCH');
  }
}
