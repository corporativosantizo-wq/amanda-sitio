// ============================================================================
// POST /api/admin/documentos/transcribir
// Transcribe un PDF a DOCX usando Claude IA (página por página)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { transcribirDocumento } from '@/lib/services/transcripcion.service';
import { DocumentoError } from '@/lib/services/documentos.service';

export const maxDuration = 300; // 5 minutes for long documents

export async function POST(req: NextRequest) {
  try {
    const { documento_id, opciones } = await req.json();

    if (!documento_id) {
      return NextResponse.json({ error: 'documento_id es requerido.' }, { status: 400 });
    }

    const resultado = await transcribirDocumento(
      documento_id,
      opciones?.formato ?? 'exacta',
    );

    return NextResponse.json(resultado);
  } catch (error: any) {
    console.error('[Transcribir API] Error:', error);
    const msg = error instanceof DocumentoError
      ? error.message
      : (error.message ?? 'Error interno');
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
