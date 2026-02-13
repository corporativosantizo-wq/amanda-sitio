// ============================================================================
// GET /api/admin/storage/tus-token
// Retorna token para uploads TUS (resumable) a Supabase Storage
// Protegido por auth de Clerk — solo usuarios autenticados
// ============================================================================

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';

export async function GET() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const token = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token) {
    return NextResponse.json(
      { error: 'Configuración del servidor incompleta' },
      { status: 500 }
    );
  }

  return NextResponse.json({ token });
}
