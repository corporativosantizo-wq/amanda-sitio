// ============================================================================
// GET /api/portal/citas/disponibilidad
// Slots disponibles para clientes del portal
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getPortalSession, SECURITY_HEADERS } from '@/lib/portal/auth';
import { checkRateLimit } from '@/lib/portal/rate-limit';
import { obtenerDisponibilidad, CitaError } from '@/lib/services/citas.service';
import type { TipoCita } from '@/lib/types';

export async function GET(req: NextRequest) {
  const session = await getPortalSession(req.headers.get('authorization'));
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers: SECURITY_HEADERS });
  }

  const { allowed } = checkRateLimit(`disp:${session.userId}`, 30, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429, headers: SECURITY_HEADERS });
  }

  try {
    const fecha = req.nextUrl.searchParams.get('fecha');
    const tipo = req.nextUrl.searchParams.get('tipo') as TipoCita | null;

    if (!fecha || !tipo) {
      return NextResponse.json(
        { error: 'Se requieren: fecha, tipo' },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    const slots = await obtenerDisponibilidad(fecha, tipo);
    return NextResponse.json({ slots }, { headers: SECURITY_HEADERS });
  } catch (err) {
    const msg = err instanceof CitaError ? err.message : 'Error al obtener disponibilidad';
    return NextResponse.json({ error: msg }, { status: 500, headers: SECURITY_HEADERS });
  }
}
