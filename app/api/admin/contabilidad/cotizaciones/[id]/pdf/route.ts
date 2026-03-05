// ============================================================================
// GET /api/admin/contabilidad/cotizaciones/[id]/pdf
// Genera PDF de cotización al vuelo y lo retorna como descarga
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  obtenerCotizacion,
  obtenerConfiguracion,
  CotizacionError,
} from '@/lib/services/cotizaciones.service';
import { generarPDFCotizacion } from '@/lib/services/pdf-cotizacion';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const cotizacion = await obtenerCotizacion(id);
    const config = await obtenerConfiguracion();

    const pdfBuffer = await generarPDFCotizacion(cotizacion, config);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${cotizacion.numero}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (err) {
    if (err instanceof CotizacionError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error('[Cotización PDF] Error:', err);
    return NextResponse.json({ error: 'Error al generar PDF' }, { status: 500 });
  }
}
