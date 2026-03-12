// app/api/admin/comunicaciones/adjuntos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { randomUUID } from 'crypto';
import { handleApiError } from '@/lib/api-error';

const db = () => createAdminClient();
const BUCKET = 'adjuntos-correo';
const MAX_SIZE = 25 * 1024 * 1024; // 25 MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const results: Array<{ name: string; path: string; size: number; contentType: string }> = [];

    for (const file of files) {
      if (file.size > MAX_SIZE) {
        return NextResponse.json(
          { error: `${file.name} excede el límite de 25 MB` },
          { status: 400 }
        );
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: `Tipo no permitido: ${file.name} (${file.type})` },
          { status: 400 }
        );
      }

      const id = randomUUID();
      const path = `correos/${id}/${file.name}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error } = await db().storage.from(BUCKET).upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      });

      if (error) {
        console.error(`[comunicaciones/adjuntos] Upload error for ${file.name}:`, error.message);
        return NextResponse.json(
          { error: `Error subiendo ${file.name}` },
          { status: 500 }
        );
      }

      results.push({
        name: file.name,
        path,
        size: file.size,
        contentType: file.type,
      });
    }

    return NextResponse.json({ adjuntos: results });
  } catch (err) {
    return handleApiError(err, 'comunicaciones/adjuntos/POST');
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { path } = await req.json();
    if (!path) {
      return NextResponse.json({ error: 'path requerido' }, { status: 400 });
    }

    const { error } = await db().storage.from(BUCKET).remove([path]);
    if (error) {
      console.error('[comunicaciones/adjuntos] Delete error:', error.message);
      return NextResponse.json({ error: 'Error al eliminar adjunto' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, 'comunicaciones/adjuntos/DELETE');
  }
}
