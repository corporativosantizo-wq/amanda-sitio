// ============================================================================
// PATCH /api/admin/usuarios/[id]
// Actualizar rol, modulos_permitidos, activo (solo admin)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const { id } = await params;

  try {
    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (body.rol !== undefined) updates.rol = body.rol;
    if (body.modulos_permitidos !== undefined) updates.modulos_permitidos = body.modulos_permitidos;
    if (body.activo !== undefined) updates.activo = body.activo;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No hay campos para actualizar' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('usuarios_admin')
      .update(updates)
      .eq('id', id)
      .select('id, email, nombre, rol, modulos_permitidos, activo')
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Error al actualizar usuario' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Usuarios PATCH] Error:', error);
    return NextResponse.json(
      { error: error.message ?? 'Error al actualizar' },
      { status: 500 }
    );
  }
}
