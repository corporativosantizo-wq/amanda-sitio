// ============================================================================
// GET /api/admin/documentos
// Listar documentos con filtros, o carpetas de clientes
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { listarDocumentos, clientesConDocumentos, DocumentoError } from '@/lib/services/documentos.service';

export async function GET(req: NextRequest) {
  try {
    const s = req.nextUrl.searchParams;

    // Folder view: list clients that have documents
    if (s.get('carpetas') === 'true') {
      const carpetas = await clientesConDocumentos();
      return NextResponse.json({ carpetas });
    }

    const result = await listarDocumentos({
      estado: s.get('estado') ?? undefined,
      tipo: s.get('tipo') ?? undefined,
      cliente_id: s.get('cliente_id') ?? undefined,
      busqueda: s.get('q') ?? undefined,
      page: parseInt(s.get('page') ?? '1'),
      limit: parseInt(s.get('limit') ?? '20'),
    });
    return NextResponse.json(result);
  } catch (err: any) {
    const msg = err instanceof DocumentoError ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
