// ============================================================================
// app/api/admin/expedientes/[id]/actuaciones/route.ts
// GET: Listar actuaciones · POST: Crear actuación
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  listarActuaciones, crearActuacion, ExpedienteError,
} from '@/lib/services/expedientes.service';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const actuaciones = await listarActuaciones(id);
    return NextResponse.json({ actuaciones });
  } catch (err) {
    const msg = err instanceof ExpedienteError ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const actuacion = await crearActuacion({ ...body, expediente_id: id });
    return NextResponse.json({ actuacion }, { status: 201 });
  } catch (err) {
    const msg = err instanceof ExpedienteError ? err.message : 'Error al crear actuación';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
