// ============================================================================
// POST /api/admin/documentos/generar
// Genera un documento Word (.docx) basado en una plantilla legal
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generarDocumento, PLANTILLAS_DISPONIBLES } from '@/lib/templates';
import type { TipoDocumentoGenerable } from '@/lib/templates';
import { sanitizarNombre } from '@/lib/services/documentos.service';

export async function POST(req: NextRequest) {
  try {
    const { tipo, datos } = await req.json();

    console.log(`[Generar] Solicitud: tipo=${tipo}`);

    if (!tipo || !PLANTILLAS_DISPONIBLES[tipo as TipoDocumentoGenerable]) {
      return NextResponse.json(
        { error: `Tipo inválido: "${tipo}". Disponibles: ${Object.keys(PLANTILLAS_DISPONIBLES).join(', ')}` },
        { status: 400 }
      );
    }

    if (!datos || typeof datos !== 'object') {
      return NextResponse.json(
        { error: 'Se requiere un objeto "datos" con los campos del documento.' },
        { status: 400 }
      );
    }

    // Generar .docx
    console.log(`[Generar] Generando documento...`);
    const buffer = await generarDocumento(tipo as TipoDocumentoGenerable, datos);
    console.log(`[Generar] Buffer generado: ${(buffer.length / 1024).toFixed(0)} KB`);

    // Subir a Storage
    const storage = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const dateStr = new Date().toISOString().split('T')[0];
    const storagePath = `generados/${dateStr}_${sanitizarNombre(tipo)}_${Date.now()}.docx`;

    console.log(`[Generar] Subiendo a Storage: ${storagePath}`);
    const { error: uploadError } = await storage.storage
      .from('documentos')
      .upload(storagePath, buffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: false,
      });

    if (uploadError) {
      console.error(`[Generar] Error al subir:`, uploadError);
      return NextResponse.json(
        { error: `Error al guardar documento: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Signed URL (10 min)
    const { data: signedData, error: signError } = await storage.storage
      .from('documentos')
      .createSignedUrl(storagePath, 600);

    if (signError || !signedData) {
      console.error(`[Generar] Error signed URL:`, signError);
      return NextResponse.json(
        { error: `Error al generar enlace: ${signError?.message}` },
        { status: 500 }
      );
    }

    const nombre = PLANTILLAS_DISPONIBLES[tipo as TipoDocumentoGenerable];
    console.log(`[Generar] Documento listo: ${nombre}`);

    return NextResponse.json({
      success: true,
      nombre: `${nombre}.docx`,
      storage_path: storagePath,
      url: signedData.signedUrl,
    });
  } catch (error: any) {
    console.error('[Generar] Error:', error);
    return NextResponse.json(
      { error: `Error al generar documento: ${error.message ?? 'desconocido'}` },
      { status: 500 }
    );
  }
}
