// ============================================================================
// app/api/admin/cumplimiento/documentos/route.ts
// Upload + Delete archivos PDF/DOCX para trámites mercantiles y laborales
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

const MODULO_CONFIG = {
  mercantil: { table: 'tramites_mercantiles', bucket: 'mercantil-docs' },
  laboral: { table: 'tramites_laborales', bucket: 'laboral-docs' },
} as const;

type Modulo = keyof typeof MODULO_CONFIG;
type TipoArchivo = 'pdf' | 'docx';

// POST — Upload document
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('archivo') as File | null;
    const modulo = formData.get('modulo') as string;
    const tramiteId = formData.get('tramite_id') as string;
    const tipo = formData.get('tipo') as string;

    if (!file || !modulo || !tramiteId || !tipo) {
      return NextResponse.json(
        { error: 'archivo, modulo, tramite_id y tipo son requeridos' },
        { status: 400 },
      );
    }

    // Límite de 150 MB por archivo
    const MAX_FILE_SIZE = 150 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'El archivo excede el límite de 150 MB.' },
        { status: 400 },
      );
    }

    if (!['mercantil', 'laboral'].includes(modulo)) {
      return NextResponse.json({ error: 'Módulo inválido' }, { status: 400 });
    }
    if (!['pdf', 'docx'].includes(tipo)) {
      return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

    if (tipo === 'pdf' && ext !== 'pdf') {
      return NextResponse.json({ error: 'Solo se permiten archivos .pdf' }, { status: 400 });
    }
    if (tipo === 'docx' && !['docx', 'doc'].includes(ext)) {
      return NextResponse.json({ error: 'Solo se permiten archivos .docx o .doc' }, { status: 400 });
    }

    const config = MODULO_CONFIG[modulo as Modulo];

    // Get cliente_id from tramite
    const { data: tramite, error: fetchErr } = await db()
      .from(config.table)
      .select('cliente_id')
      .eq('id', tramiteId)
      .single();

    if (fetchErr || !tramite) {
      return NextResponse.json({ error: 'Trámite no encontrado' }, { status: 404 });
    }

    const storagePath = `${tramite.cliente_id}/${tramiteId}/documento-${tipo}.${ext}`;

    // Upload to storage (upsert to allow replace)
    const storage = storageClient();
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await storage.storage
      .from(config.bucket)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({ error: 'Error al subir archivo' }, { status: 500 });
    }

    // Update tramite columns
    const updateData: Record<string, string | null> = {
      [`archivo_${tipo}_url`]: storagePath,
      [`archivo_${tipo}_nombre`]: file.name,
    };

    const { error: dbError } = await db()
      .from(config.table)
      .update(updateData)
      .eq('id', tramiteId);

    if (dbError) {
      // Cleanup uploaded file
      await storage.storage.from(config.bucket).remove([storagePath]);
      throw dbError;
    }

    return NextResponse.json(
      { ok: true, storage_path: storagePath, nombre: file.name },
      { status: 201 },
    );
  } catch (err: any) {
    console.error('Error uploading document:', err);
    return NextResponse.json({ error: 'Error al subir documento' }, { status: 500 });
  }
}

// DELETE — Remove document
export async function DELETE(request: NextRequest) {
  try {
    const { modulo, tramite_id, tipo } = await request.json();

    if (!modulo || !tramite_id || !tipo) {
      return NextResponse.json(
        { error: 'modulo, tramite_id y tipo son requeridos' },
        { status: 400 },
      );
    }

    if (!['mercantil', 'laboral'].includes(modulo)) {
      return NextResponse.json({ error: 'Módulo inválido' }, { status: 400 });
    }
    if (!['pdf', 'docx'].includes(tipo)) {
      return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
    }

    const config = MODULO_CONFIG[modulo as Modulo];

    // Get current storage path
    const { data: tramite, error: fetchErr } = await db()
      .from(config.table)
      .select(`archivo_${tipo}_url`)
      .eq('id', tramite_id)
      .single();

    if (fetchErr || !tramite) {
      return NextResponse.json({ error: 'Trámite no encontrado' }, { status: 404 });
    }

    const storagePath = tramite[`archivo_${tipo}_url`] as string | null;

    if (storagePath) {
      // Delete from storage
      const storage = storageClient();
      await storage.storage.from(config.bucket).remove([storagePath]);
    }

    // Clear columns
    const updateData: Record<string, null> = {
      [`archivo_${tipo}_url`]: null,
      [`archivo_${tipo}_nombre`]: null,
    };

    const { error: dbError } = await db()
      .from(config.table)
      .update(updateData)
      .eq('id', tramite_id);

    if (dbError) throw dbError;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Error deleting document:', err);
    return NextResponse.json({ error: 'Error al eliminar documento' }, { status: 500 });
  }
}
