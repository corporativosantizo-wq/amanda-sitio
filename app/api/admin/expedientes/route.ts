// ============================================================================
// app/api/admin/expedientes/route.ts
// GET: Listar expedientes · POST: Crear expediente
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  listarExpedientes, crearExpediente, ExpedienteError,
} from '@/lib/services/expedientes.service';

export async function GET(req: NextRequest) {
  try {
    const s = req.nextUrl.searchParams;
    const result = await listarExpedientes({
      busqueda: s.get('q') ?? undefined,
      origen: s.get('origen') ?? undefined,
      tipo_proceso: s.get('tipo_proceso') ?? undefined,
      fase_actual: s.get('fase_actual') ?? undefined,
      estado: s.get('estado') ?? undefined,
      cliente_id: s.get('cliente_id') ?? undefined,
      departamento: s.get('departamento') ?? undefined,
      page: parseInt(s.get('page') ?? '1'),
      limit: parseInt(s.get('limit') ?? '25'),
    });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof ExpedienteError ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.cliente_id) {
      return NextResponse.json({ error: 'cliente_id es obligatorio' }, { status: 400 });
    }
    if (!body.origen) {
      return NextResponse.json({ error: 'origen es obligatorio' }, { status: 400 });
    }
    if (!body.numero_expediente && !body.numero_mp && !body.numero_administrativo) {
      return NextResponse.json({ error: 'Al menos un número de expediente es obligatorio' }, { status: 400 });
    }

    const expediente = await crearExpediente(body);
    return NextResponse.json({ expediente }, { status: 201 });
  } catch (err) {
    const msg = err instanceof ExpedienteError ? err.message : 'Error al crear expediente';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
