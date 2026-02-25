// ============================================================================
// POST /api/admin/storage/tus-token
// Devuelve el endpoint TUS y token de autorización para subidas resumable.
// Protegido por requireAdmin — solo usuarios activos en usuarios_admin.
// El service_role_key se pasa al cliente únicamente a través de este
// endpoint autenticado, nunca hardcoded en código cliente.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';

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

    // Hostname directo de storage (bypasses API gateway / Kong)
    // https://supabase.com/docs/guides/storage/uploads/resumable-uploads
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
    const tusEndpoint = `https://${projectRef}.supabase.co/storage/v1/upload/resumable`;

    return NextResponse.json({
      tusEndpoint,
      token: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    });
  } catch (err: any) {
    console.error('[Storage] Error:', err.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
