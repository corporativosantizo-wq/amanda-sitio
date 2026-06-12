// ============================================================================
// PATCH /api/admin/llamadas/[id]
//   { accion: 'completar' | 'cancelar' }  o
//   { accion: 'reprogramar', fecha, hora, duracion_minutos?, asunto?, notas? }
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  completarLlamada,
  cancelarLlamada,
  actualizarLlamada,
  LlamadaError,
} from '@/lib/services/llamadas.service';

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (body.accion === 'completar') {
      return NextResponse.json(await completarLlamada(id));
    }
    if (body.accion === 'cancelar') {
      return NextResponse.json(await cancelarLlamada(id));
    }
    if (body.accion === 'reprogramar') {
      const llamada = await actualizarLlamada(id, {
        fecha: body.fecha,
        hora: body.hora,
        duracion_minutos: body.duracion_minutos ? Number(body.duracion_minutos) : undefined,
        asunto: body.asunto,
        notas: body.notas,
      });
      return NextResponse.json(llamada);
    }

    return NextResponse.json({ error: 'Acción inválida.' }, { status: 400 });
  } catch (err) {
    const msg = err instanceof LlamadaError ? err.message : 'Error al actualizar llamada';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
