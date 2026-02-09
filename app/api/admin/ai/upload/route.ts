// ============================================================================
// POST /api/admin/ai/upload
// Sube un archivo al chat de Molly (max 3 MB), guarda en molly-temp/ y extrae
// texto de PDFs con pdf-parse v2.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sanitizarNombre } from '@/lib/services/documentos.service';

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3 MB (Graph API inline attachment limit)

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx', '.doc', '.jpg', '.jpeg', '.png']);

const CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot).toLowerCase() : '';
}

function sanitizarTexto(texto: string): string {
  return texto
    .replace(/\0/g, '')
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[\uD800-\uDFFF]/g, '')
    .replace(/[\uFFFE\uFFFF]/g, '');
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se recibió ningún archivo.' }, { status: 400 });
    }

    // Validate extension
    const ext = getExtension(file.name);
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: `Tipo de archivo no permitido (${ext}). Permitidos: PDF, DOCX, DOC, JPG, PNG.` },
        { status: 400 },
      );
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `El archivo excede el límite de 3 MB (${(file.size / 1024 / 1024).toFixed(1)} MB).` },
        { status: 400 },
      );
    }

    // Upload to Storage: molly-temp/{timestamp}_{sanitized_name}
    const storage = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const storagePath = `molly-temp/${Date.now()}_${sanitizarNombre(file.name)}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await storage.storage
      .from('documentos')
      .upload(storagePath, buffer, {
        contentType: CONTENT_TYPES[ext] ?? 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      console.error('[AI Upload] Storage error:', uploadError);
      return NextResponse.json({ error: `Error al subir archivo: ${uploadError.message}` }, { status: 500 });
    }

    // Extract text from PDF
    let textoExtraido: string | null = null;

    if (ext === '.pdf') {
      try {
        const { PDFParse } = await import('pdf-parse');
        const pdf = new PDFParse({ data: buffer });
        try {
          const result = await Promise.race([
            pdf.getText(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('timeout')), 30000),
            ),
          ]);
          const raw = (result.text || '').trim();
          const clean = sanitizarTexto(raw);
          if (clean.length > 10) {
            textoExtraido = clean.slice(0, 10000);
          }
        } finally {
          await pdf.destroy();
        }
      } catch (err: any) {
        console.error('[AI Upload] PDF text extraction error:', err.message);
        // Non-fatal — file was uploaded, just no text extracted
      }
    }

    return NextResponse.json({
      storagePath,
      fileName: file.name,
      fileSize: file.size,
      textoExtraido,
    });
  } catch (error: any) {
    console.error('[AI Upload] Error:', error);
    return NextResponse.json(
      { error: `Error al procesar archivo: ${error.message ?? 'desconocido'}` },
      { status: 500 },
    );
  }
}
