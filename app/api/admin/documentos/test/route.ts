// ============================================================================
// GET /api/admin/documentos/test
// Endpoint de diagnóstico: genera un .docx simple y lo sube a Storage
// para aislar si el problema es la generación o la subida
// ============================================================================

import { NextResponse } from 'next/server';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const steps: string[] = [];

  try {
    // Paso 1: Verificar env vars
    steps.push('Paso 1: Verificando variables de entorno...');
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return NextResponse.json({
        success: false,
        error: 'NEXT_PUBLIC_SUPABASE_URL no está definida',
        steps,
      }, { status: 500 });
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({
        success: false,
        error: 'SUPABASE_SERVICE_ROLE_KEY no está definida',
        steps,
      }, { status: 500 });
    }
    steps.push('Variables de entorno OK');

    // Paso 2: Generar documento .docx de prueba
    steps.push('Paso 2: Generando documento de prueba...');
    const doc = new Document({
      creator: 'IURISLEX Test',
      sections: [{
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: 'DOCUMENTO DE PRUEBA',
                bold: true,
                font: 'Times New Roman',
                size: 28,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Generado el ${new Date().toISOString()} para verificar que la generación de documentos Word funciona correctamente en Vercel serverless.`,
                font: 'Times New Roman',
                size: 24,
              }),
            ],
          }),
        ],
      }],
    });

    const buffer = Buffer.from(await Packer.toBuffer(doc));
    steps.push(`Documento generado OK: ${(buffer.length / 1024).toFixed(1)} KB`);

    // Paso 3: Verificar bucket
    steps.push('Paso 3: Verificando bucket "documentos"...');
    const storage = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: buckets, error: bucketsErr } = await storage.storage.listBuckets();
    if (bucketsErr) {
      return NextResponse.json({
        success: false,
        error: `Error al listar buckets: ${bucketsErr.message}`,
        steps,
      }, { status: 500 });
    }

    const bucketNames = (buckets ?? []).map((b: any) => b.name);
    const exists = bucketNames.includes('documentos');
    steps.push(`Buckets encontrados: [${bucketNames.join(', ')}]. "documentos" ${exists ? 'EXISTE' : 'NO EXISTE'}`);

    if (!exists) {
      return NextResponse.json({
        success: false,
        error: 'Bucket "documentos" no existe. Créelo manualmente en Supabase Dashboard > Storage.',
        steps,
      }, { status: 500 });
    }

    // Paso 4: Subir documento
    steps.push('Paso 4: Subiendo a Storage...');
    const storagePath = `test/test_${Date.now()}.docx`;
    const { error: uploadError } = await storage.storage
      .from('documentos')
      .upload(storagePath, buffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({
        success: false,
        error: `Error al subir: ${uploadError.message}`,
        steps,
      }, { status: 500 });
    }
    steps.push(`Subido OK: ${storagePath}`);

    // Paso 5: Generar URL firmada
    steps.push('Paso 5: Generando URL firmada...');
    const { data: signedData, error: signError } = await storage.storage
      .from('documentos')
      .createSignedUrl(storagePath, 300);

    if (signError || !signedData) {
      return NextResponse.json({
        success: false,
        error: `Error al generar URL: ${signError?.message}`,
        steps,
      }, { status: 500 });
    }
    steps.push('URL firmada generada OK');

    // Paso 6: Limpiar archivo de prueba
    await storage.storage.from('documentos').remove([storagePath]);
    steps.push('Archivo de prueba eliminado');

    return NextResponse.json({
      success: true,
      message: 'Todos los pasos completados exitosamente. La generación de documentos funciona correctamente.',
      url: signedData.signedUrl,
      steps,
    });
  } catch (error: any) {
    console.error('[Test] Error:', error.message, error.stack);
    return NextResponse.json({
      success: false,
      error: `Error inesperado: ${error.message}`,
      stack: error.stack,
      steps,
    }, { status: 500 });
  }
}
