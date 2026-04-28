// ============================================================================
// app/api/admin/clientes/[id]/route.ts
// GET: Detalle completo · PATCH: Actualizar · DELETE: Desactivar
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  obtenerCliente, actualizarCliente, desactivarCliente, ClienteError,
} from '@/lib/services/clientes.service';
import {
  obtenerRepresentantesEmpresa, sincronizarRepresentantes, RepresentanteError,
} from '@/lib/services/representantes.service';
import { obtenerGrupo } from '@/lib/services/grupos.service';
import { expedientesPorCliente } from '@/lib/services/expedientes.service';
import { handleApiError } from '@/lib/api-error';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const cliente = await obtenerCliente(id);

    const db = createAdminClient();

    // Fetch related data in parallel
    const [citasRes, docsRes, pagosRes, cotizacionesRes, expedientes] = await Promise.all([
      db.from('citas')
        .select('id, tipo, titulo, fecha, hora_inicio, hora_fin, estado, costo')
        .eq('cliente_id', id)
        .order('fecha', { ascending: false })
        .limit(20),
      db.from('documentos')
        .select('id, nombre_archivo, titulo, tipo, estado, archivo_url, created_at')
        .eq('cliente_id', id)
        .order('created_at', { ascending: false })
        .limit(50),
      db.from('pagos')
        .select('id, monto, estado, fecha_pago, metodo, cobro:cobros!cobro_id (concepto)')
        .eq('cliente_id', id)
        .order('fecha_pago', { ascending: false })
        .limit(20),
      db.from('cotizaciones')
        .select('id, numero, fecha_emision, estado, total, pdf_url')
        .eq('cliente_id', id)
        .order('fecha_emision', { ascending: false })
        .limit(20),
      expedientesPorCliente(id),
    ]);

    // Fetch representantes (only for empresa)
    let representantes: any[] = [];
    let grupo_empresarial: any = null;

    if ((cliente as any).tipo === 'empresa') {
      representantes = await obtenerRepresentantesEmpresa(id);

      if ((cliente as any).grupo_empresarial_id) {
        try {
          grupo_empresarial = await obtenerGrupo((cliente as any).grupo_empresarial_id);
        } catch {
          // grupo not found, ignore
        }
      }
    }

    // concepto vive en cobros, no en pagos. Aplanamos cobro.concepto al nivel
    // raíz del pago para que la UI lo consuma como `pago.concepto`.
    const pagos = (pagosRes.data ?? []).map((p: any) => ({
      id: p.id,
      monto: p.monto,
      estado: p.estado,
      fecha_pago: p.fecha_pago,
      metodo: p.metodo,
      concepto: p.cobro?.concepto ?? null,
    }));

    return NextResponse.json({
      ...cliente,
      citas: citasRes.data ?? [],
      expedientes,
      documentos: docsRes.data ?? [],
      pagos,
      cotizaciones: cotizacionesRes.data ?? [],
      representantes,
      grupo_empresarial,
    });
  } catch (err) {
    if (err instanceof ClienteError) {
      const status = err.message.includes('no encontrado') ? 404 : 500;
      return NextResponse.json({ error: err.message }, { status });
    }
    return handleApiError(err, 'clientes/[id]/GET');
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { requireAdmin } = await import('@/lib/auth/api-auth');
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await ctx.params;
    const body = await req.json();

    // Extract representantes from body (handled separately)
    const { representantes, ...clienteData } = body;

    const cliente = await actualizarCliente(id, clienteData);

    // Sync representantes if provided
    if (Array.isArray(representantes)) {
      await sincronizarRepresentantes(id, representantes);
    }

    return NextResponse.json(cliente);
  } catch (err) {
    if (err instanceof ClienteError || err instanceof RepresentanteError) {
      const status = err.message.includes('Ya existe') ? 409 : 500;
      return NextResponse.json({ error: err.message }, { status });
    }
    return handleApiError(err, 'clientes/[id]/PATCH');
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { requireAdmin } = await import('@/lib/auth/api-auth');
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await ctx.params;
    await desactivarCliente(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ClienteError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return handleApiError(err, 'clientes/[id]/DELETE');
  }
}
