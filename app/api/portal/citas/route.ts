// ============================================================================
// GET, POST /api/portal/citas
// Citas del cliente del portal
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getPortalSession, SECURITY_HEADERS } from '@/lib/portal/auth';
import { checkRateLimit } from '@/lib/portal/rate-limit';
import {
  listarCitas,
  crearCita,
  CitaError,
} from '@/lib/services/citas.service';

export async function GET(req: NextRequest) {
  const clienteId = req.nextUrl.searchParams.get('cliente_id');
  const session = await getPortalSession(req.headers.get('authorization'), clienteId);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers: SECURITY_HEADERS });
  }

  const { allowed } = checkRateLimit(`citas-list:${session.userId}`, 20, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429, headers: SECURITY_HEADERS });
  }

  try {
    const result = await listarCitas({
      cliente_id: session.clienteId,
      page: req.nextUrl.searchParams.get('page') ? Number(req.nextUrl.searchParams.get('page')) : undefined,
    });
    return NextResponse.json(result, { headers: SECURITY_HEADERS });
  } catch (err) {
    const msg = err instanceof CitaError ? err.message : 'Error al listar citas';
    return NextResponse.json({ error: msg }, { status: 500, headers: SECURITY_HEADERS });
  }
}

export async function POST(req: NextRequest) {
  const session = await getPortalSession(req.headers.get('authorization'));
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers: SECURITY_HEADERS });
  }

  const { allowed } = checkRateLimit(`citas-create:${session.userId}`, 5, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429, headers: SECURITY_HEADERS });
  }

  try {
    const body = await req.json();

    if (!body.tipo || !body.titulo || !body.fecha || !body.hora_inicio || !body.hora_fin || !body.duracion_minutos) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    // Forzar el cliente_id del session
    const cita = await crearCita({
      ...body,
      cliente_id: session.clienteId,
    });

    return NextResponse.json(cita, { status: 201, headers: SECURITY_HEADERS });
  } catch (err) {
    const msg = err instanceof CitaError ? err.message : 'Error al crear cita';
    const status = msg.includes('no está disponible') || msg.includes('Límite') ? 409 : 500;
    return NextResponse.json({ error: msg }, { status, headers: SECURITY_HEADERS });
  }
}
