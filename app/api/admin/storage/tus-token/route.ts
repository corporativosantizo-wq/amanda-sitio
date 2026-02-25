// ============================================================================
// POST /api/admin/storage/tus-token
// Devuelve el endpoint TUS y un signed upload token para subidas resumable.
// Protegido por requireAdmin — solo usuarios activos en usuarios_admin.
// El service_role_key NUNCA sale del servidor — se usa solo para generar
// el signed upload token, que es de un solo uso y scope limitado.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';
import { createClient } from '@supabase/supabase-js';

function storageClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { bucket, objectName } = await req.json();

    if (!bucket || !objectName) {
      return NextResponse.json(
        { error: 'bucket y objectName son requeridos' },
        { status: 400 },
      );
    }

    // Generar signed upload token (scope limitado a este path)
    const storage = storageClient();
    const { data, error } = await storage.storage
      .from(bucket)
      .createSignedUploadUrl(objectName);

    if (error || !data) {
      console.error('[Storage] Error generando signed upload token:', error?.message);
      return NextResponse.json(
        { error: 'Error al generar token de subida' },
        { status: 500 },
      );
    }

    // Hostname directo de storage (bypasses API gateway / Kong)
    // https://supabase.com/docs/guides/storage/uploads/resumable-uploads
    const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0];
    const tusEndpoint = `https://${projectRef}.supabase.co/storage/v1/upload/resumable`;

    return NextResponse.json({
      tusEndpoint,
      token: data.token,
    });
  } catch (err: any) {
    console.error('[Storage] Error:', err.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
