// ============================================================================
// GET /api/admin/me
// Retorna el usuario admin actual (match por email de Clerk → usuarios_admin)
// ============================================================================

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('usuarios_admin')
    .select('id, email, nombre, rol, modulos_permitidos, activo')
    .eq('email', session.email)
    .single();

  if (error) {
    console.error('[/api/admin/me] Supabase error:', error.message, error.code, error.details);
    return NextResponse.json(
      { error: 'Usuario no registrado en el sistema', detail: error.message },
      { status: 403 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: 'Usuario no registrado en el sistema' },
      { status: 403 }
    );
  }

  if (!data.activo) {
    return NextResponse.json(
      { error: 'Usuario desactivado' },
      { status: 403 }
    );
  }

  return NextResponse.json(data);
}
