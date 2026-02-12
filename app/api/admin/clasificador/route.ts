// ============================================================================
// GET /api/admin/clasificador
// Listar documentos para clasificador + stats en una sola respuesta
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  listarDocumentos,
  obtenerStatsClasificador,
  DocumentoError,
} from '@/lib/services/documentos.service';

export async function GET(req: NextRequest) {
  try {
    const s = req.nextUrl.searchParams;
    const tab = s.get('tab') ?? 'todos';

    // Map tab to listarDocumentos params
    const params: Parameters<typeof listarDocumentos>[0] = {
      busqueda: s.get('q') ?? undefined,
      tipo: s.get('tipo') ?? undefined,
      page: parseInt(s.get('page') ?? '1'),
      limit: parseInt(s.get('limit') ?? '25'),
    };

    if (tab === 'sin_cliente') {
      params.sin_cliente = true;
    } else if (tab === 'pendientes') {
      params.estado = 'pendiente';
    } else if (tab === 'clasificados') {
      params.estado = 'clasificado';
    }
    // 'todos' — no extra filters

    const [result, stats] = await Promise.all([
      listarDocumentos(params),
      obtenerStatsClasificador(),
    ]);

    return NextResponse.json({
      data: result.data,
      total: result.total,
      totalPages: result.totalPages,
      stats,
    });
  } catch (err: any) {
    const msg = err instanceof DocumentoError ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
