// ============================================================================
// /api/admin/audiencias/registro
// Módulo NUEVO: registro formal de audiencias en la tabla legal.audiencias.
//
// Deliberadamente SEPARADO de GET /api/admin/audiencias (que lee el Outlook de
// Amanda para el dashboard y es lo "viejo", intacto hasta el cutover de Fase 8).
// Aquí: "registro" = la tabla. Allá: "audiencias" = lectura de Outlook.
//
// GET:  lista audiencias del registro (con filtros).
// POST: crea una audiencia.
// Auth: la da el middleware Clerk del matcher /api/admin(.*); no se re-autentica
// dentro del handler. Acceso a datos vía createAdminClient() (service_role).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { crearAudiencia, listarAudiencias, AudienciaError } from '@/lib/services/audiencias.service';
import { handleApiError } from '@/lib/api-error';

export async function GET(req: NextRequest) {
  try {
    const s = req.nextUrl.searchParams;
    const result = await listarAudiencias({
      busqueda: s.get('q') ?? undefined,
      estado: s.get('estado') ?? undefined,
      modalidad: s.get('modalidad') ?? undefined,
      cliente_id: s.get('cliente_id') ?? undefined,
      expediente_id: s.get('expediente_id') ?? undefined,
      desde: s.get('desde') ?? undefined,
      hasta: s.get('hasta') ?? undefined,
      page: parseInt(s.get('page') ?? '1'),
      limit: parseInt(s.get('limit') ?? '25'),
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AudienciaError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return handleApiError(err, 'audiencias/registro/GET');
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.fecha_hora_inicio) {
      return NextResponse.json({ error: 'La fecha y hora de inicio es obligatoria' }, { status: 400 });
    }
    if (!body.modalidad) {
      return NextResponse.json({ error: 'La modalidad es obligatoria' }, { status: 400 });
    }

    // programar_recordatorios: casilla del form (marcada por defecto).
    const audiencia = await crearAudiencia(body, body.programar_recordatorios !== false);
    return NextResponse.json({ audiencia }, { status: 201 });
  } catch (err) {
    if (err instanceof AudienciaError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return handleApiError(err, 'audiencias/registro/POST');
  }
}
