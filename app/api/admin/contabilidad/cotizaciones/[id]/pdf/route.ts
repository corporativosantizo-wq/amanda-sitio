// ============================================================================
// GET /api/admin/contabilidad/cotizaciones/[id]/pdf
// Genera signed URL para descargar el PDF de la cotización
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { obtenerCotizacion, CotizacionError } from '@/lib/services/cotizaciones.service';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const cotizacion = await obtenerCotizacion(id);

    if (!cotizacion.pdf_url) {
      return NextResponse.json(
        { error: 'Esta cotización no tiene PDF generado' },
        { status: 404 }
      );
    }

    const storage = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    ).storage.from('documentos');

    const { data, error } = await storage.createSignedUrl(cotizacion.pdf_url, 600);

    if (error || !data) {
      console.error('[Cotización PDF] Error generando signed URL:', error);
      return NextResponse.json(
        { error: 'Error al generar URL de descarga' },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: data.signedUrl });
  } catch (err) {
    if (err instanceof CotizacionError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error('[Cotización PDF] Error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
