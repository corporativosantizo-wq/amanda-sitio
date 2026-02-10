// ============================================================================
// app/api/admin/proveedores/[id]/route.ts
// GET: Detalle · PATCH: Actualizar · DELETE: Desactivar
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  obtenerProveedor, actualizarProveedor, desactivarProveedor, ProveedorError,
} from '@/lib/services/proveedores.service';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const proveedor = await obtenerProveedor(id);
    return NextResponse.json(proveedor);
  } catch (err) {
    const msg = err instanceof ProveedorError ? err.message : 'Error interno';
    const status = msg.includes('no encontrado') ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const proveedor = await actualizarProveedor(id, body);
    return NextResponse.json(proveedor);
  } catch (err) {
    const msg = err instanceof ProveedorError ? err.message : 'Error al actualizar';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    await desactivarProveedor(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof ProveedorError ? err.message : 'Error al desactivar';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
