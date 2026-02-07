// ============================================================================
// app/api/admin/clientes/[id]/route.ts
// GET: Detalle · PATCH: Actualizar · DELETE: Desactivar
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  obtenerCliente, actualizarCliente, desactivarCliente, ClienteError,
} from '@/lib/services/clientes.service';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const cliente = await obtenerCliente(id);
    return NextResponse.json(cliente);
  } catch (err) {
    const msg = err instanceof ClienteError ? err.message : 'Error interno';
    const status = msg.includes('no encontrado') ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const cliente = await actualizarCliente(id, body);
    return NextResponse.json(cliente);
  } catch (err) {
    const msg = err instanceof ClienteError ? err.message : 'Error al actualizar';
    const status = msg.includes('Ya existe') ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    await desactivarCliente(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof ClienteError ? err.message : 'Error al desactivar';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
