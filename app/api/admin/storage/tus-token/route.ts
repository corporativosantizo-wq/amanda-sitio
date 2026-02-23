// ============================================================================
// POST /api/admin/storage/tus-token
// Genera signed upload URL para subidas grandes a Supabase Storage.
// NUNCA expone el service_role_key al cliente.
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

    const storage = storageClient();
    const { data, error } = await storage.storage
      .from(bucket)
      .createSignedUploadUrl(objectName);

    if (error || !data) {
      console.error('[Storage] Error generando signed upload URL:', error?.message);
      return NextResponse.json(
        { error: 'Error al generar URL de subida' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      path: data.path,
    });
  } catch (err: any) {
    console.error('[Storage] Error:', err.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
