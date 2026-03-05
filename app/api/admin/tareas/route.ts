// ============================================================================
// GET  /api/admin/tareas — Lista tareas con filtros
// POST /api/admin/tareas — Crear nueva tarea
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { listarTareas, crearTarea, TareaError } from '@/lib/services/tareas.service';

export async function GET(req: NextRequest) {
  try {
    const s = req.nextUrl.searchParams;
    const result = await listarTareas({
      estado: s.get('estado') ?? undefined,
      prioridad: s.get('prioridad') ?? undefined,
      categoria: s.get('categoria') ?? undefined,
      asignado_a: s.get('asignado_a') ?? undefined,
      cliente_id: s.get('cliente_id') ?? undefined,
      fecha_desde: s.get('fecha_desde') ?? undefined,
      fecha_hasta: s.get('fecha_hasta') ?? undefined,
      busqueda: s.get('q') ?? undefined,
      page: parseInt(s.get('page') ?? '1'),
      limit: parseInt(s.get('limit') ?? '50'),
    });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof TareaError ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.titulo?.trim()) {
      return NextResponse.json({ error: 'El t\u00edtulo es obligatorio' }, { status: 400 });
    }
    const tarea = await crearTarea(body);
    return NextResponse.json(tarea, { status: 201 });
  } catch (err) {
    const msg = err instanceof TareaError ? err.message : 'Error al crear tarea';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
