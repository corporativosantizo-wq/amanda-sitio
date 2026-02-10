// ============================================================================
// app/api/admin/clientes/[id]/route.ts
// GET: Detalle completo · PATCH: Actualizar · DELETE: Desactivar
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  obtenerCliente, actualizarCliente, desactivarCliente, ClienteError,
} from '@/lib/services/clientes.service';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const cliente = await obtenerCliente(id);

    const db = createAdminClient();

    // Fetch related data in parallel
    const [citasRes, docsRes, pagosRes, cotizacionesRes] = await Promise.all([
      db.from('citas')
        .select('id, tipo, titulo, fecha, hora_inicio, hora_fin, estado, costo')
        .eq('cliente_id', id)
        .order('fecha', { ascending: false })
        .limit(20),
      db.from('documentos')
        .select('id, nombre_archivo, titulo, tipo, estado, created_at')
        .eq('cliente_id', id)
        .order('created_at', { ascending: false })
        .limit(50),
      db.from('pagos')
        .select('id, monto, estado, fecha, concepto, metodo')
        .eq('cliente_id', id)
        .order('fecha', { ascending: false })
        .limit(20),
      db.from('cotizaciones')
        .select('id, numero, fecha_emision, estado, total, pdf_url')
        .eq('cliente_id', id)
        .order('fecha_emision', { ascending: false })
        .limit(20),
    ]);

    return NextResponse.json({
      ...cliente,
      citas: citasRes.data ?? [],
      documentos: docsRes.data ?? [],
      pagos: pagosRes.data ?? [],
      cotizaciones: cotizacionesRes.data ?? [],
    });
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
