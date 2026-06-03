// ============================================================================
// /api/admin/notas-entrega
// GET  → listar notas de entrega
// POST → crear nota de entrega manual
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';
import {
  listarNotasEntrega,
  crearNotaEntrega,
  NotaEntregaError,
} from '@/lib/services/notas-entrega.service';
import { handleApiError } from '@/lib/api-error';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const sp = req.nextUrl.searchParams;
    const result = await listarNotasEntrega({
      cliente_id: sp.get('cliente_id') ?? undefined,
      cita_id: sp.get('cita_id') ?? undefined,
      estado: sp.get('estado') ?? undefined,
      busqueda: sp.get('q') ?? undefined,
      page: sp.get('page') ? Number(sp.get('page')) : undefined,
      limit: sp.get('limit') ? Number(sp.get('limit')) : undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof NotaEntregaError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return handleApiError(err, 'notas-entrega/GET');
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const body = await req.json();
    const nota = await crearNotaEntrega({
      cliente_id: body.cliente_id,
      cita_id: body.cita_id ?? null,
      fecha: body.fecha ?? null,
      documentos_entregados: body.documentos_entregados ?? null,
      documentos_recibidos: body.documentos_recibidos ?? null,
      notas: body.notas ?? null,
      estado: body.estado ?? undefined,
    });
    return NextResponse.json(nota, { status: 201 });
  } catch (err) {
    if (err instanceof NotaEntregaError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return handleApiError(err, 'notas-entrega/POST');
  }
}
