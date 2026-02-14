// ============================================================================
// app/api/admin/notariado/avisos-generales/route.ts
// GET  → Lista todos los avisos generales (escritura_documentos con categoria='aviso_general')
// POST → Sube un aviso general generado (DOCX blob) y guarda metadata
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@supabase/supabase-js';

const db = () => createAdminClient();

function storageClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// GET — List all aviso_general documents with escritura info
export async function GET() {
  try {
    const { data, error } = await db()
      .from('escritura_documentos')
      .select('*, escrituras(numero, numero_texto, tipo_instrumento_texto, fecha_autorizacion, lugar_autorizacion, departamento)')
      .eq('categoria', 'aviso_general')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err: any) {
    console.error('Error listing avisos generales:', err);
    return NextResponse.json({ error: 'Error al listar avisos' }, { status: 500 });
  }
}

// POST — Upload a generated aviso general DOCX
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('archivo') as File | null;
    const escrituraId = formData.get('escritura_id') as string;
    const subcategoria = formData.get('subcategoria') as string | null;
    const notas = formData.get('notas') as string | null;

    if (!file || !escrituraId) {
      return NextResponse.json({ error: 'archivo y escritura_id son requeridos' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['docx', 'pdf'].includes(ext)) {
      return NextResponse.json({ error: 'Solo se permiten archivos DOCX o PDF' }, { status: 400 });
    }

    const timestamp = Date.now();
    const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `escrituras/${escrituraId}/avisos-generales/${timestamp}_${safeFilename}`;

    const storage = storageClient();
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await storage.storage
      .from('notariado')
      .upload(storagePath, buffer, {
        contentType: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({ error: 'Error al subir archivo' }, { status: 500 });
    }

    const { data: doc, error: dbError } = await db()
      .from('escritura_documentos')
      .insert({
        escritura_id: escrituraId,
        categoria: 'aviso_general',
        subcategoria: subcategoria || null,
        nombre_archivo: file.name,
        storage_path: storagePath,
        tamano_bytes: file.size,
        notas: notas || null,
      })
      .select()
      .single();

    if (dbError) {
      await storage.storage.from('notariado').remove([storagePath]);
      throw dbError;
    }

    return NextResponse.json(doc, { status: 201 });
  } catch (err: any) {
    console.error('Error uploading aviso general:', err);
    return NextResponse.json({ error: 'Error al guardar aviso' }, { status: 500 });
  }
}
