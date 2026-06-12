// ============================================================================
// GET /api/admin/calendario/solicitudes
// Lista las solicitudes de entrega/firma pendientes de asignar fecha
// (estado='pendiente'). Protegido por el middleware admin (Clerk).
// ============================================================================

import { NextResponse } from 'next/server';
import { listarSolicitudesPendientes, CitaError } from '@/lib/services/citas.service';

export async function GET() {
  try {
    const solicitudes = await listarSolicitudesPendientes();
    return NextResponse.json({ data: solicitudes });
  } catch (err) {
    const msg = err instanceof CitaError ? err.message : 'Error al listar solicitudes';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
