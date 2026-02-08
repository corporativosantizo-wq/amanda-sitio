// ============================================================================
// GET /api/admin/plantillas — Listar plantillas con filtros
// POST /api/admin/plantillas — Crear nueva plantilla
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  listarPlantillas,
  crearPlantilla,
  PlantillaError,
} from '@/lib/services/plantillas.service';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const activa = sp.get('activa');
    const result = await listarPlantillas({
      activa: activa !== null ? activa === 'true' : undefined,
      tipo: sp.get('tipo') || undefined,
      busqueda: sp.get('q') || undefined,
      page: parseInt(sp.get('page') || '1'),
      limit: parseInt(sp.get('limit') || '50'),
    });
    return NextResponse.json(result);
  } catch (err: any) {
    const msg = err instanceof PlantillaError ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.nombre?.trim()) {
      return NextResponse.json({ error: 'Nombre es requerido' }, { status: 400 });
    }
    if (!body.estructura?.trim()) {
      return NextResponse.json({ error: 'Estructura es requerida' }, { status: 400 });
    }

    const plantilla = await crearPlantilla({
      nombre: body.nombre,
      tipo: body.tipo || 'general',
      descripcion: body.descripcion,
      campos: body.campos || [],
      estructura: body.estructura,
      archivo_original: body.archivo_original,
    });

    return NextResponse.json(plantilla, { status: 201 });
  } catch (err: any) {
    const msg = err instanceof PlantillaError ? err.message : 'Error al crear plantilla';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
