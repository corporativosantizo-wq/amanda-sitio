// ============================================================================
// GET: Obtener entidad · PATCH: Actualizar entidad
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { obtenerEntidad, actualizarEntidad, EntidadError } from '@/lib/services/entidades-mercantiles.service';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const entidad = await obtenerEntidad(id);
    return NextResponse.json(entidad);
  } catch (err) {
    const msg = err instanceof EntidadError ? err.message : 'Error interno';
    const status = msg.includes('no encontrada') ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const entidad = await actualizarEntidad(id, body);
    return NextResponse.json(entidad);
  } catch (err) {
    const msg = err instanceof EntidadError ? err.message : 'Error al actualizar';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
