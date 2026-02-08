// ============================================================================
// GET    /api/admin/tareas/[id] — Obtener tarea
// PATCH  /api/admin/tareas/[id] — Actualizar tarea
// DELETE /api/admin/tareas/[id] — Eliminar tarea
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  obtenerTarea,
  actualizarTarea,
  eliminarTarea,
  TareaError,
} from '@/lib/services/tareas.service';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const tarea = await obtenerTarea(id);
    return NextResponse.json(tarea);
  } catch (err) {
    const msg = err instanceof TareaError ? err.message : 'Error interno';
    const status = msg.includes('no encontrada') ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const tarea = await actualizarTarea(id, body);
    return NextResponse.json(tarea);
  } catch (err) {
    const msg = err instanceof TareaError ? err.message : 'Error al actualizar';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await eliminarTarea(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof TareaError ? err.message : 'Error al eliminar';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
