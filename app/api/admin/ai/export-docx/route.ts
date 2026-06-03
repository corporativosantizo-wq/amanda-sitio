// ============================================================================
// POST /api/admin/ai/export-docx
// Convierte el texto redactado por el Redactor Legal en un documento Word (.docx)
// y lo devuelve como descarga.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';
import { Packer } from 'docx';
import { buildDocument, convertirTextoAParagraphs } from '@/lib/templates/docx-utils';

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { content, filename } = await req.json();
    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'Falta el contenido a exportar.' }, { status: 400 });
    }

    // Preprocesar markdown: encabezados (#..######) → líneas en MAYÚSCULAS para que
    // convertirTextoAParagraphs las trate como títulos; viñetas markdown → •.
    const pre = content
      .replace(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/gm, (_m, t: string) => t.toUpperCase())
      .replace(/^\s*[-*+]\s+/gm, '• ')
      .replace(/`{1,3}/g, '');

    const paragraphs = convertirTextoAParagraphs(pre);
    const doc = buildDocument(paragraphs);
    const buffer = Buffer.from(await Packer.toBuffer(doc));

    const base = (typeof filename === 'string' && filename.trim() ? filename : 'documento-legal')
      .replace(/[^a-zA-Z0-9-_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60) || 'documento-legal';

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${base}.docx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('[AI export-docx] Error:', err?.message ?? err);
    return NextResponse.json({ error: err?.message ?? 'Error al exportar el documento.' }, { status: 500 });
  }
}
