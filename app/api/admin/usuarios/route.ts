// ============================================================================
// /api/admin/usuarios
// GET: listar usuarios admin (solo admin)
// POST: crear usuario via Edge Function crear-usuario
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export async function GET() {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('usuarios_admin')
    .select('id, email, nombre, rol, modulos_permitidos, activo, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: 'Error al obtener usuarios' },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const body = await req.json();
    const { email, nombre, password, rol, modulos_permitidos } = body;

    if (!email || !nombre || !password || !rol) {
      return NextResponse.json(
        { error: 'Campos requeridos: email, nombre, password, rol' },
        { status: 400 }
      );
    }

    // Call Edge Function to create user
    const edgeFnUrl = `${SUPABASE_URL}/functions/v1/crear-usuario`;
    const res = await fetch(edgeFnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-secret': 'crear-usuario-2026',
      },
      body: JSON.stringify({ email, nombre, password, rol, modulos_permitidos }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error ?? `Error al crear usuario (${res.status})` },
        { status: res.status }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('[Usuarios POST] Error:', error);
    return NextResponse.json(
      { error: error.message ?? 'Error al crear usuario' },
      { status: 500 }
    );
  }
}
