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
  cotizacionesSinCobro,
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

    const estado = s.get('estado') ?? undefined;
    const result = await listarCobros({
      estado,
      cliente_id: s.get('cliente_id') ?? undefined,
      desde: s.get('desde') ?? undefined,
      hasta: s.get('hasta') ?? undefined,
      busqueda: s.get('q') ?? undefined,
      page: parseInt(s.get('page') ?? '1'),
      limit: parseInt(s.get('limit') ?? '50'),
    });

    // Merge accepted cotizaciones without cobros into pendiente/todos views
    if (!estado || estado === 'pendiente') {
      const cotsSinCobro = await cotizacionesSinCobro();
      const pendientes = cotsSinCobro.filter((c: any) => c.saldo_pendiente > 0);
      if (pendientes.length > 0) {
        result.data = [...result.data, ...pendientes];
        result.total += pendientes.length;
      }
    }

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

    // Auto-send solicitud de pago. forceResend: true porque el cobro acaba de
    // crearse en esta misma request, no puede haber duplicado de ventana 24h.
    // Pasarlo explícitamente elimina el path de falla silenciosa si el service
    // devolviera 'duplicate_recent' por algún motivo inesperado.
    let emailResult = '';
    try {
      const r = await enviarSolicitudPago(cobro.id, { forceResend: true });
      emailResult = r.status === 'sent' ? r.mensaje : '';
    } catch (err: any) {
      emailResult = `(No se envió email: ${err.message})`;
    }

    return NextResponse.json({ cobro, emailResult }, { status: 201 });
  } catch (err) {
    const msg = err instanceof CobroError ? err.message : 'Error al crear cobro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
