// ============================================================================
// app/api/admin/proveedores/[id]/gestiones/route.ts
// GET: listar gestiones del proveedor (con cliente + seguimientos)
// POST: crear gestión para el proveedor
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  listarGestionesPorProveedor,
  crearGestion,
  GestionError,
} from '@/lib/services/gestiones-proveedor.service';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const gestiones = await listarGestionesPorProveedor(id);
    return NextResponse.json({ data: gestiones });
  } catch (err) {
    const msg = err instanceof GestionError ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const gestion = await crearGestion({ ...body, proveedor_id: id });
    return NextResponse.json(gestion, { status: 201 });
  } catch (err) {
    const msg = err instanceof GestionError ? err.message : 'Error al crear gestión';
    const status = err instanceof GestionError && msg.includes('obligatori') ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
