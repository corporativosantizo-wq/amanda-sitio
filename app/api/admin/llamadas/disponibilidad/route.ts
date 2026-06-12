// ============================================================================
// GET /api/admin/llamadas/disponibilidad?fecha=&hora=&duracion=
// Verifica en el calendario de Outlook de Amanda si está libre en ese horario.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { llamadaDisponible, LlamadaError } from '@/lib/services/llamadas.service';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const fecha = sp.get('fecha');
  const hora = sp.get('hora');
  const duracion = Number(sp.get('duracion') ?? '30');

  if (!fecha || !hora) {
    return NextResponse.json({ error: 'Parámetros requeridos: fecha, hora' }, { status: 400 });
  }

  try {
    const res = await llamadaDisponible(fecha, hora, duracion);
    return NextResponse.json(res);
  } catch (err) {
    const msg = err instanceof LlamadaError ? err.message : 'Error al verificar disponibilidad';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
