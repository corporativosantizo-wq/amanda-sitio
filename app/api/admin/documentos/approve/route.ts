// ============================================================================
// POST /api/admin/documentos/approve
// Aprobar o rechazar documentos (soporta lotes)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  aprobarDocumento,
  rechazarDocumento,
  DocumentoError,
} from '@/lib/services/documentos.service';

interface Accion {
  id: string;
  accion: 'aprobar' | 'rechazar';
  edits?: {
    tipo?: string;
    titulo?: string;
    fecha_documento?: string | null;
    cliente_id?: string;
    notas?: string;
  };
  notas?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const acciones: Accion[] = body.acciones;

    if (!Array.isArray(acciones) || acciones.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere al menos una acción.' },
        { status: 400 }
      );
    }

    const resultados: any[] = [];

    for (const accion of acciones) {
      try {
        if (accion.accion === 'aprobar') {
          const doc = await aprobarDocumento(accion.id, accion.edits);
          resultados.push({ id: accion.id, estado: 'aprobado', success: true });
        } else if (accion.accion === 'rechazar') {
          await rechazarDocumento(accion.id, accion.notas);
          resultados.push({ id: accion.id, estado: 'rechazado', success: true });
        } else {
          resultados.push({ id: accion.id, success: false, error: 'Acción no válida.' });
        }
      } catch (err: any) {
        resultados.push({
          id: accion.id,
          success: false,
          error: err.message ?? 'Error al procesar.',
        });
      }
    }

    return NextResponse.json({ resultados });
  } catch (error: any) {
    console.error('[Documentos Approve] Error:', error);
    return NextResponse.json(
      { error: error.message ?? 'Error al procesar acciones.' },
      { status: 500 }
    );
  }
}
