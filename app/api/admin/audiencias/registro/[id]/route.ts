// ============================================================================
// /api/admin/audiencias/registro/[id]
// GET: detalle de una audiencia del registro (legal.audiencias).
// Separado del lector de Outlook. Auth: middleware Clerk del matcher.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { obtenerAudiencia, actualizarAudiencia, AudienciaError } from '@/lib/services/audiencias.service';
import { handleApiError } from '@/lib/api-error';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const audiencia = await obtenerAudiencia(id);
    return NextResponse.json({ audiencia });
  } catch (err) {
    if (err instanceof AudienciaError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    return handleApiError(err, 'audiencias/registro/[id]/GET');
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();

    if ('fecha_hora_inicio' in body && !body.fecha_hora_inicio) {
      return NextResponse.json({ error: 'La fecha y hora de inicio es obligatoria' }, { status: 400 });
    }
    if ('modalidad' in body && !body.modalidad) {
      return NextResponse.json({ error: 'La modalidad es obligatoria' }, { status: 400 });
    }

    const audiencia = await actualizarAudiencia(id, body);
    return NextResponse.json({ audiencia });
  } catch (err) {
    if (err instanceof AudienciaError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return handleApiError(err, 'audiencias/registro/[id]/PUT');
  }
}
