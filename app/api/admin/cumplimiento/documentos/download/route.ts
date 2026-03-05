// ============================================================================
// app/api/admin/cumplimiento/documentos/download/route.ts
// Genera signed URL para descargar documentos de trámites mercantiles/laborales
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

const MODULO_CONFIG = {
  mercantil: { table: 'tramites_mercantiles', bucket: 'mercantil-docs' },
  laboral: { table: 'tramites_laborales', bucket: 'laboral-docs' },
} as const;

type Modulo = keyof typeof MODULO_CONFIG;

export async function GET(request: NextRequest) {
  try {
    const modulo = request.nextUrl.searchParams.get('modulo');
    const tramiteId = request.nextUrl.searchParams.get('tramite_id');
    const tipo = request.nextUrl.searchParams.get('tipo');

    if (!modulo || !tramiteId || !tipo) {
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
    const db = createAdminClient();

    const { data: tramite, error } = await db
      .from(config.table)
      .select(`archivo_${tipo}_url, archivo_${tipo}_nombre`)
      .eq('id', tramiteId)
      .single();

    if (error || !tramite) {
      return NextResponse.json({ error: 'Trámite no encontrado' }, { status: 404 });
    }

    const storagePath = tramite[`archivo_${tipo}_url`] as string | null;
    const nombre = tramite[`archivo_${tipo}_nombre`] as string | null;

    if (!storagePath) {
      return NextResponse.json({ error: 'No hay archivo de este tipo' }, { status: 404 });
    }

    const storage = storageClient();
    const { data: signedUrl, error: urlError } = await storage.storage
      .from(config.bucket)
      .createSignedUrl(storagePath, 3600);

    if (urlError || !signedUrl) {
      return NextResponse.json({ error: 'Error al generar URL de descarga' }, { status: 500 });
    }

    return NextResponse.json({ url: signedUrl.signedUrl, nombre });
  } catch (err: any) {
    console.error('Error generating download URL:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
