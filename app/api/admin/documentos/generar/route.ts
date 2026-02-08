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
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function uploadAndSign(storage: any, buffer: Buffer, storagePath: string) {
  console.log(`[Generar] Subiendo a Storage: ${storagePath} (${(buffer.length / 1024).toFixed(0)} KB)`);
  const { error: uploadError } = await storage.storage
    .from('documentos')
    .upload(storagePath, buffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      upsert: false,
    });

  if (uploadError) {
    console.error(`[Generar] Error al subir:`, uploadError);
    throw new Error(`Error al guardar en Storage: ${uploadError.message}`);
  }
  console.log(`[Generar] Subido OK`);

  console.log(`[Generar] Generando URL firmada...`);
  const { data: signedData, error: signError } = await storage.storage
    .from('documentos')
    .createSignedUrl(storagePath, 600);

  if (signError || !signedData) {
    console.error(`[Generar] Error signed URL:`, signError);
    throw new Error(`Error al generar enlace de descarga: ${signError?.message}`);
  }
  console.log(`[Generar] URL firmada OK`);

  return signedData.signedUrl;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tipo, plantilla_id, datos } = body;

    console.log(`[Generar] Solicitud recibida:`, {
      tipo: tipo ?? '(no)',
      plantilla_id: plantilla_id ?? '(no)',
      datos_keys: Object.keys(datos || {}),
    });

    if (!datos || typeof datos !== 'object') {
      return NextResponse.json(
        { error: 'Se requiere un objeto "datos" con los campos del documento.' },
        { status: 400 }
      );
    }

    let storage: any;
    try {
      storage = getStorage();
    } catch (envErr: any) {
      console.error(`[Generar] ${envErr.message}`);
      return NextResponse.json({ error: envErr.message }, { status: 500 });
    }

    const dateStr = new Date().toISOString().split('T')[0];

    // ── Ruta: plantilla personalizada ─────────────────────────────────
    if (plantilla_id) {
      console.log(`[Generar] === RUTA CUSTOM ===`);

      // Paso 1: Obtener plantilla de BD
      console.log(`[Generar] Paso 1: Obteniendo plantilla ${plantilla_id}...`);
      let plantilla: any;
      try {
        plantilla = await obtenerPlantilla(plantilla_id);
      } catch (err: any) {
        console.error(`[Generar] Error obteniendo plantilla:`, err.message);
        return NextResponse.json(
          { error: `Plantilla no encontrada: ${err.message}` },
          { status: 404 }
        );
      }

      if (!plantilla.activa) {
        return NextResponse.json({ error: 'La plantilla está inactiva' }, { status: 400 });
      }
      console.log(`[Generar] Plantilla: "${plantilla.nombre}", ${(plantilla.campos as any[]).length} campos`);

      // Paso 2: Reemplazar campos y generar docx
      console.log(`[Generar] Paso 2: Generando .docx custom...`);
      let buffer: Buffer;
      try {
        const textoFinal = generarDesdeCustomPlantilla(plantilla, datos);
        const paragraphs = convertirTextoAParagraphs(textoFinal);
        const doc = buildDocument(paragraphs);
        buffer = Buffer.from(await Packer.toBuffer(doc));
        console.log(`[Generar] Buffer custom: ${(buffer.length / 1024).toFixed(0)} KB`);
      } catch (err: any) {
        console.error(`[Generar] Error generando docx custom:`, err.message, err.stack);
        return NextResponse.json(
          { error: `Error al generar documento: ${err.message}` },
          { status: 500 }
        );
      }

      // Paso 3: Subir y firmar URL
      console.log(`[Generar] Paso 3: Upload + signed URL...`);
      const storagePath = `generados/${dateStr}_custom_${sanitizarNombre(plantilla.nombre)}_${Date.now()}.docx`;
      const url = await uploadAndSign(storage, buffer, storagePath);

      console.log(`[Generar] Documento custom listo: "${plantilla.nombre}"`);
      return NextResponse.json({
        success: true,
        nombre: `${plantilla.nombre}.docx`,
        storage_path: storagePath,
        url,
      });
    }

    // ── Ruta: plantilla integrada ─────────────────────────────────────
    console.log(`[Generar] === RUTA INTEGRADA === tipo=${tipo}`);

    if (!tipo || !PLANTILLAS_DISPONIBLES[tipo as TipoDocumentoGenerable]) {
      const disponibles = Object.keys(PLANTILLAS_DISPONIBLES).join(', ');
      console.error(`[Generar] Tipo inválido: "${tipo}". Disponibles: ${disponibles}`);
      return NextResponse.json(
        { error: `Tipo inválido: "${tipo}". Disponibles: ${disponibles}` },
        { status: 400 }
      );
    }

    // Paso 1: Generar buffer .docx
    console.log(`[Generar] Paso 1: Generando .docx (${tipo})...`);
    let buffer: Buffer;
    try {
      buffer = await generarDocumento(tipo as TipoDocumentoGenerable, datos);
      console.log(`[Generar] Buffer generado: ${(buffer.length / 1024).toFixed(0)} KB`);
    } catch (err: any) {
      console.error(`[Generar] Error generando docx (${tipo}):`, err.message, err.stack);
      return NextResponse.json(
        { error: `Error al generar documento (${tipo}): ${err.message}` },
        { status: 500 }
      );
    }

    // Paso 2: Subir y firmar URL
    console.log(`[Generar] Paso 2: Upload + signed URL...`);
    const storagePath = `generados/${dateStr}_${sanitizarNombre(tipo)}_${Date.now()}.docx`;
    const url = await uploadAndSign(storage, buffer, storagePath);

    const nombre = PLANTILLAS_DISPONIBLES[tipo as TipoDocumentoGenerable];
    console.log(`[Generar] Documento listo: "${nombre}"`);

    return NextResponse.json({
      success: true,
      nombre: `${nombre}.docx`,
      storage_path: storagePath,
      url,
    });
  } catch (error: any) {
    console.error('[Generar] Error no capturado:', error.message);
    console.error('[Generar] Stack:', error.stack);
    return NextResponse.json(
      { error: `Error al generar documento: ${error.message ?? 'desconocido'}` },
      { status: 500 }
    );
  }
}
