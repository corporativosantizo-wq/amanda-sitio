// ============================================================================
// GET  /api/admin/cobros — Lista cobros con filtros
// POST /api/admin/cobros — Crear nuevo cobro
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  listarCobros,
  crearCobro,
  enviarSolicitudPago,
  resumenCobros,
  CobroError,
} from '@/lib/services/cobros.service';

export async function GET(req: NextRequest) {
  try {
    const s = req.nextUrl.searchParams;

    // Dashboard resumen
    if (s.get('resumen') === 'true') {
      const resumen = await resumenCobros();
      return NextResponse.json(resumen);
    }

    const result = await listarCobros({
      estado: s.get('estado') ?? undefined,
      cliente_id: s.get('cliente_id') ?? undefined,
      desde: s.get('desde') ?? undefined,
      hasta: s.get('hasta') ?? undefined,
      busqueda: s.get('q') ?? undefined,
      page: parseInt(s.get('page') ?? '1'),
      limit: parseInt(s.get('limit') ?? '50'),
    });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof CobroError ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const cobro = await crearCobro(body);

    // Auto-send solicitud de pago
    let emailResult = '';
    try {
      emailResult = await enviarSolicitudPago(cobro.id);
    } catch (err: any) {
      emailResult = `(No se envió email: ${err.message})`;
    }

    return NextResponse.json({ cobro, emailResult }, { status: 201 });
  } catch (err) {
    const msg = err instanceof CobroError ? err.message : 'Error al crear cobro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
