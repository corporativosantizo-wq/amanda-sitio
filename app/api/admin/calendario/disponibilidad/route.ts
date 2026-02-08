// ============================================================================
// GET /api/admin/calendario/disponibilidad
// Slots disponibles para una fecha y tipo
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { obtenerDisponibilidad, CitaError } from '@/lib/services/citas.service';
import type { TipoCita } from '@/lib/types';

export async function GET(req: NextRequest) {
  try {
    const fecha = req.nextUrl.searchParams.get('fecha');
    const tipo = req.nextUrl.searchParams.get('tipo') as TipoCita | null;

    if (!fecha || !tipo) {
      return NextResponse.json(
        { error: 'Se requieren parámetros: fecha (YYYY-MM-DD) y tipo (consulta_nueva|seguimiento)' },
        { status: 400 }
      );
    }

    const slots = await obtenerDisponibilidad(fecha, tipo);
    return NextResponse.json({ slots });
  } catch (err) {
    const msg = err instanceof CitaError ? err.message : 'Error al obtener disponibilidad';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
