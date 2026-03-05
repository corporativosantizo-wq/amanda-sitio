// ============================================================================
// GET /api/admin/documentos/preview-code?cliente_id=...&tipo=...
// Preview del código y nombre de archivo que se generará
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { previewCodigoDocumento, DocumentoError } from '@/lib/services/documentos.service';

export async function GET(req: NextRequest) {
  try {
    const s = req.nextUrl.searchParams;
    const clienteId = s.get('cliente_id');
    const tipo = s.get('tipo') ?? 'otro';

    if (!clienteId) {
      return NextResponse.json({ error: 'Se requiere cliente_id.' }, { status: 400 });
    }

    const preview = await previewCodigoDocumento(clienteId, tipo);
    return NextResponse.json(preview);
  } catch (err: any) {
    const msg = err instanceof DocumentoError ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
