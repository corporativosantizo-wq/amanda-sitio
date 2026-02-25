// ============================================================================
// POST /api/admin/storage/tus-token
// Devuelve el endpoint TUS y token de autorización para subidas resumable.
// Protegido por requireAdmin — solo administradores autenticados.
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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    // Usar hostname directo de storage para mejor rendimiento con archivos grandes
    // https://supabase.com/docs/guides/storage/uploads/resumable-uploads
    const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
    const tusEndpoint = `https://${projectRef}.supabase.co/storage/v1/upload/resumable`;

    return NextResponse.json({
      tusEndpoint,
      token: serviceRoleKey,
    });
  } catch (err: any) {
    console.error('[Storage] Error:', err.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
