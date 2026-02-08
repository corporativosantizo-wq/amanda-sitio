// ============================================================================
// GET/PATCH/DELETE /api/admin/plantillas/[id]
// Operaciones sobre una plantilla individual
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  obtenerPlantilla,
  actualizarPlantilla,
  eliminarPlantilla,
  PlantillaError,
} from '@/lib/services/plantillas.service';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const plantilla = await obtenerPlantilla(id);
    return NextResponse.json(plantilla);
  } catch (err: any) {
    const msg = err instanceof PlantillaError ? err.message : 'Error interno';
    const status = msg.includes('no encontrada') ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updates: Record<string, any> = {};
    if (body.nombre !== undefined) updates.nombre = body.nombre;
    if (body.tipo !== undefined) updates.tipo = body.tipo;
    if (body.descripcion !== undefined) updates.descripcion = body.descripcion;
    if (body.campos !== undefined) updates.campos = body.campos;
    if (body.estructura !== undefined) updates.estructura = body.estructura;
    if (body.activa !== undefined) updates.activa = body.activa;

    const plantilla = await actualizarPlantilla(id, updates);
    return NextResponse.json(plantilla);
  } catch (err: any) {
    const msg = err instanceof PlantillaError ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await eliminarPlantilla(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const msg = err instanceof PlantillaError ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
