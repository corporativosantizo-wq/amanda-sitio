// ============================================================================
// GET, PATCH, DELETE /api/admin/calendario/eventos/[id]
// Detalle, actualizar, cancelar cita
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  obtenerCita,
  actualizarCita,
  cancelarCita,
  completarCita,
  CitaError,
} from '@/lib/services/citas.service';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const cita = await obtenerCita(id);
    return NextResponse.json(cita);
  } catch (err) {
    const msg = err instanceof CitaError ? err.message : 'Error al obtener cita';
    return NextResponse.json({ error: msg }, { status: 404 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();

    // Si el body contiene accion, manejar acciones especiales
    if (body.accion === 'completar') {
      const cita = await completarCita(id);
      return NextResponse.json(cita);
    }

    if (body.accion === 'cancelar') {
      const cita = await cancelarCita(id);
      return NextResponse.json(cita);
    }

    const cita = await actualizarCita(id, body);
    return NextResponse.json(cita);
  } catch (err) {
    const msg = err instanceof CitaError ? err.message : 'Error al actualizar cita';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const cita = await cancelarCita(id);
    return NextResponse.json(cita);
  } catch (err) {
    const msg = err instanceof CitaError ? err.message : 'Error al cancelar cita';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
