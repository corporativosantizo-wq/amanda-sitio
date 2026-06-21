// ============================================================================
// /api/admin/audiencias/registro
// Módulo NUEVO: registro formal de audiencias en la tabla legal.audiencias.
//
// Deliberadamente SEPARADO de GET /api/admin/audiencias (que lee el Outlook de
// Amanda para el dashboard y es lo "viejo", intacto hasta el cutover de Fase 8).
// Aquí: "registro" = la tabla. Allá: "audiencias" = lectura de Outlook.
//
// POST: crea una audiencia.
// Auth: la da el middleware Clerk del matcher /api/admin(.*); no se re-autentica
// dentro del handler. Acceso a datos vía createAdminClient() (service_role).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { crearAudiencia, AudienciaError } from '@/lib/services/audiencias.service';
import { handleApiError } from '@/lib/api-error';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.fecha_hora_inicio) {
      return NextResponse.json({ error: 'La fecha y hora de inicio es obligatoria' }, { status: 400 });
    }
    if (!body.modalidad) {
      return NextResponse.json({ error: 'La modalidad es obligatoria' }, { status: 400 });
    }

    const audiencia = await crearAudiencia(body);
    return NextResponse.json({ audiencia }, { status: 201 });
  } catch (err) {
    if (err instanceof AudienciaError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return handleApiError(err, 'audiencias/registro/POST');
  }
}
