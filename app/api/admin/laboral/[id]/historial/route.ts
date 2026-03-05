// ============================================================================
// app/api/admin/laboral/[id]/historial/route.ts
// POST: Agregar entrada al historial de un trámite laboral
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { crearHistorialLaboral, LaboralError } from '@/lib/services/laboral.service';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();

    if (!body.accion) {
      return NextResponse.json({ error: 'accion es obligatoria' }, { status: 400 });
    }
    if (!body.descripcion) {
      return NextResponse.json({ error: 'descripcion es obligatoria' }, { status: 400 });
    }

    const historial = await crearHistorialLaboral({
      tramite_id: id,
      fecha: body.fecha || new Date().toISOString().slice(0, 10),
      accion: body.accion,
      descripcion: body.descripcion,
      documento_url: body.documento_url || null,
    });

    return NextResponse.json({ historial }, { status: 201 });
  } catch (err) {
    const msg = err instanceof LaboralError ? err.message : 'Error al crear historial';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
