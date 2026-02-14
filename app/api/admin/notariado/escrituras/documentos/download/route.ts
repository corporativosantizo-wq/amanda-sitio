// ============================================================================
// app/api/admin/notariado/escrituras/documentos/download/route.ts
// Genera signed URL para descargar un documento del bucket notariado
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@supabase/supabase-js';

function storageClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(request: NextRequest) {
  try {
    const docId = request.nextUrl.searchParams.get('id');
    if (!docId) {
      return NextResponse.json({ error: 'id requerido' }, { status: 400 });
    }

    const db = createAdminClient();
    const { data: doc, error } = await db
      .from('escritura_documentos')
      .select('storage_path, nombre_archivo')
      .eq('id', docId)
      .single();

    if (error || !doc) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    }

    const storage = storageClient();
    const { data: signedUrl, error: urlError } = await storage.storage
      .from('notariado')
      .createSignedUrl(doc.storage_path, 3600); // 1 hour

    if (urlError || !signedUrl) {
      return NextResponse.json({ error: 'Error al generar URL de descarga' }, { status: 500 });
    }

    return NextResponse.json({ url: signedUrl.signedUrl, nombre: doc.nombre_archivo });
  } catch (err: any) {
    console.error('Error generating download URL:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
