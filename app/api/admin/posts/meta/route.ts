// ============================================================================
// GET /api/admin/posts/meta
// Devuelve las categorías de blog y todas las etiquetas para los formularios
// de crear/editar post. Protegido por middleware (Clerk + rol admin).
// ============================================================================

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET() {
  const db = getAdminPublicClient();

  const [cats, tags] = await Promise.all([
    db.from('categories').select('id, name, slug').eq('type', 'blog').order('name'),
    db.from('tags').select('id, name, slug').order('name'),
  ]);

  if (cats.error) {
    return NextResponse.json({ error: cats.error.message }, { status: 500 });
  }

  return NextResponse.json({
    categories: cats.data ?? [],
    tags: tags.data ?? [],
  });
}
