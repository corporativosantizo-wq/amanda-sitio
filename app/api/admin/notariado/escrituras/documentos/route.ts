// ============================================================================
// app/api/admin/notariado/escrituras/documentos/route.ts
// CRUD para escritura_documentos + upload/download al bucket notariado
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@supabase/supabase-js';

const db = () => createAdminClient();

// Storage client (default schema, not legal)
function storageClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// GET — List documents for an escritura
export async function GET(request: NextRequest) {
  try {
    const escrituraId = request.nextUrl.searchParams.get('escritura_id');
    const categoria = request.nextUrl.searchParams.get('categoria');

    if (!escrituraId) {
      return NextResponse.json({ error: 'escritura_id requerido' }, { status: 400 });
    }

    let query = db()
      .from('escritura_documentos')
      .select('*')
      .eq('escritura_id', escrituraId)
      .order('created_at', { ascending: false });

    if (categoria) {
      query = query.eq('categoria', categoria);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data ?? []);
  } catch (err: any) {
    console.error('Error listing documents:', err);
    return NextResponse.json({ error: 'Error al listar documentos' }, { status: 500 });
  }
}

// POST — Upload a document
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('archivo') as File | null;
    const escrituraId = formData.get('escritura_id') as string;
    const categoria = formData.get('categoria') as string;
    const subcategoria = formData.get('subcategoria') as string | null;
    const notas = formData.get('notas') as string | null;

    if (!file || !escrituraId || !categoria) {
      return NextResponse.json(
        { error: 'archivo, escritura_id y categoria son requeridos' },
        { status: 400 }
      );
    }

    // Validate file type
    const validCategories = ['borrador_docx', 'testimonio', 'aviso_trimestral', 'aviso_general', 'escritura_pdf', 'escritura_docx'];
    if (!validCategories.includes(categoria)) {
      return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (categoria === 'borrador_docx') {
      if (!['docx', 'doc'].includes(ext)) {
        return NextResponse.json({ error: 'Solo se permiten archivos .docx y .doc' }, { status: 400 });
      }
    } else if (categoria === 'aviso_general') {
      if (!['pdf', 'docx'].includes(ext)) {
        return NextResponse.json({ error: 'Solo se permiten archivos PDF o DOCX' }, { status: 400 });
      }
    } else if (categoria === 'escritura_pdf') {
      if (ext !== 'pdf') {
        return NextResponse.json({ error: 'Solo se permiten archivos PDF' }, { status: 400 });
      }
    } else if (categoria === 'escritura_docx') {
      if (!['docx', 'doc'].includes(ext)) {
        return NextResponse.json({ error: 'Solo se permiten archivos .docx y .doc' }, { status: 400 });
      }
    } else {
      if (ext !== 'pdf') {
        return NextResponse.json({ error: 'Solo se permiten archivos PDF' }, { status: 400 });
      }
    }

    // Build storage path — escritura_pdf and escritura_docx use fixed filenames
    const carpetaMap: Record<string, string> = {
      borrador_docx: 'borradores',
      testimonio: 'testimonios',
      aviso_trimestral: 'avisos-trimestrales',
      aviso_general: 'avisos-generales',
      escritura_pdf: '',
      escritura_docx: '',
    };

    let storagePath: string;
    if (categoria === 'escritura_pdf') {
      storagePath = `escrituras/${escrituraId}/escritura-firmada.pdf`;
    } else if (categoria === 'escritura_docx') {
      storagePath = `escrituras/${escrituraId}/escritura-editable.docx`;
    } else {
      const timestamp = Date.now();
      const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      storagePath = `escrituras/${escrituraId}/${carpetaMap[categoria]}/${timestamp}_${safeFilename}`;
    }

    // For escritura_pdf/escritura_docx, upsert (replace) the file
    const isFixedFile = categoria === 'escritura_pdf' || categoria === 'escritura_docx';

    // Upload to storage
    const storage = storageClient();
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await storage.storage
      .from('notariado')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: isFixedFile,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({ error: 'Error al subir archivo' }, { status: 500 });
    }

    // For fixed-path categories, delete existing DB record before inserting new one
    if (isFixedFile) {
      await db()
        .from('escritura_documentos')
        .delete()
        .eq('escritura_id', escrituraId)
        .eq('categoria', categoria);
    }

    // Save metadata to DB
    const { data: doc, error: dbError } = await db()
      .from('escritura_documentos')
      .insert({
        escritura_id: escrituraId,
        categoria,
        subcategoria: subcategoria || null,
        nombre_archivo: file.name,
        storage_path: storagePath,
        tamano_bytes: file.size,
        notas: notas || null,
      })
      .select()
      .single();

    if (dbError) {
      // Try to cleanup uploaded file
      await storage.storage.from('notariado').remove([storagePath]);
      throw dbError;
    }

    return NextResponse.json(doc, { status: 201 });
  } catch (err: any) {
    console.error('Error uploading document:', err);
    return NextResponse.json({ error: 'Error al subir documento' }, { status: 500 });
  }
}

// DELETE — Remove a document
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'id requerido' }, { status: 400 });
    }

    // Get document info
    const { data: doc, error: fetchError } = await db()
      .from('escritura_documentos')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !doc) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    }

    // Delete from storage
    const storage = storageClient();
    await storage.storage.from('notariado').remove([doc.storage_path]);

    // Delete from DB
    const { error: deleteError } = await db()
      .from('escritura_documentos')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Error deleting document:', err);
    return NextResponse.json({ error: 'Error al eliminar documento' }, { status: 500 });
  }
}
