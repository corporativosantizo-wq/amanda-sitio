// ============================================================================
// POST /api/admin/documentos/generar
// Genera un documento Word (.docx) basado en una plantilla legal
// Soporta plantillas integradas (tipo) y personalizadas (plantilla_id)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Packer } from 'docx';
import { generarDocumento, PLANTILLAS_DISPONIBLES } from '@/lib/templates';
import type { TipoDocumentoGenerable } from '@/lib/templates';
import { sanitizarNombre } from '@/lib/services/documentos.service';
import { obtenerPlantilla, generarDesdeCustomPlantilla } from '@/lib/services/plantillas.service';
import { buildDocument, convertirTextoAParagraphs } from '@/lib/templates/docx-utils';

function getStorage() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function uploadAndSign(storage: any, buffer: Buffer, storagePath: string) {
  const { error: uploadError } = await storage.storage
    .from('documentos')
    .upload(storagePath, buffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Error al guardar documento: ${uploadError.message}`);
  }

  const { data: signedData, error: signError } = await storage.storage
    .from('documentos')
    .createSignedUrl(storagePath, 600);

  if (signError || !signedData) {
    throw new Error(`Error al generar enlace: ${signError?.message}`);
  }

  return signedData.signedUrl;
}

export async function POST(req: NextRequest) {
  try {
    const { tipo, plantilla_id, datos } = await req.json();

    if (!datos || typeof datos !== 'object') {
      return NextResponse.json(
        { error: 'Se requiere un objeto "datos" con los campos del documento.' },
        { status: 400 }
      );
    }

    const storage = getStorage();
    const dateStr = new Date().toISOString().split('T')[0];

    // ── Ruta: plantilla personalizada ─────────────────────────────────
    if (plantilla_id) {
      console.log(`[Generar] Solicitud custom: plantilla_id=${plantilla_id}`);

      const plantilla = await obtenerPlantilla(plantilla_id);
      if (!plantilla.activa) {
        return NextResponse.json({ error: 'La plantilla está inactiva' }, { status: 400 });
      }

      const textoFinal = generarDesdeCustomPlantilla(plantilla, datos);
      const paragraphs = convertirTextoAParagraphs(textoFinal);
      const doc = buildDocument(paragraphs);
      const buffer = Buffer.from(await Packer.toBuffer(doc));

      console.log(`[Generar] Buffer custom generado: ${(buffer.length / 1024).toFixed(0)} KB`);

      const storagePath = `generados/${dateStr}_custom_${sanitizarNombre(plantilla.nombre)}_${Date.now()}.docx`;
      const url = await uploadAndSign(storage, buffer, storagePath);

      console.log(`[Generar] Documento custom listo: ${plantilla.nombre}`);
      return NextResponse.json({
        success: true,
        nombre: `${plantilla.nombre}.docx`,
        storage_path: storagePath,
        url,
      });
    }

    // ── Ruta: plantilla integrada ─────────────────────────────────────
    console.log(`[Generar] Solicitud: tipo=${tipo}`);

    if (!tipo || !PLANTILLAS_DISPONIBLES[tipo as TipoDocumentoGenerable]) {
      return NextResponse.json(
        { error: `Tipo inválido: "${tipo}". Disponibles: ${Object.keys(PLANTILLAS_DISPONIBLES).join(', ')}` },
        { status: 400 }
      );
    }

    console.log(`[Generar] Generando documento...`);
    const buffer = await generarDocumento(tipo as TipoDocumentoGenerable, datos);
    console.log(`[Generar] Buffer generado: ${(buffer.length / 1024).toFixed(0)} KB`);

    const storagePath = `generados/${dateStr}_${sanitizarNombre(tipo)}_${Date.now()}.docx`;
    const url = await uploadAndSign(storage, buffer, storagePath);

    const nombre = PLANTILLAS_DISPONIBLES[tipo as TipoDocumentoGenerable];
    console.log(`[Generar] Documento listo: ${nombre}`);

    return NextResponse.json({
      success: true,
      nombre: `${nombre}.docx`,
      storage_path: storagePath,
      url,
    });
  } catch (error: any) {
    console.error('[Generar] Error:', error);
    return NextResponse.json(
      { error: `Error al generar documento: ${error.message ?? 'desconocido'}` },
      { status: 500 }
    );
  }
}
