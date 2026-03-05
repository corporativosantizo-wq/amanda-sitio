// ============================================================================
// GET/DELETE /api/admin/jurisprudencia/[id]
// Operaciones sobre un tomo individual
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  obtenerTomo,
  eliminarTomo,
  generarSignedUrl,
  JurisprudenciaError,
} from '@/lib/services/jurisprudencia.service';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const tomo = await obtenerTomo(id);

    // Generar URL firmada para ver/descargar el PDF
    let signedUrl: string | null = null;
    try {
      signedUrl = await generarSignedUrl(tomo.archivo_url, 600);
    } catch {
      // Si falla la URL firmada, no bloquear
    }

    return NextResponse.json({ ...tomo, signed_url: signedUrl });
  } catch (err: any) {
    const msg = err instanceof JurisprudenciaError ? err.message : 'Error interno';
    const status = msg.includes('no encontrado') ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await eliminarTomo(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const msg = err instanceof JurisprudenciaError ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
