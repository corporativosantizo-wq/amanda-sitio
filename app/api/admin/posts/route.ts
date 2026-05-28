// ============================================================================
// API: /api/admin/posts
// Crea posts — usa service_role key para bypass RLS (admin auth vía proxy.ts)
// Posts viven en schema public, no legal
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SLUG_REGEX } from '@/lib/utils/slug';

function getAdminPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// POST /api/admin/posts
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, slug, excerpt, content, status } = body;

  if (!title?.trim() || !slug?.trim() || !content?.trim()) {
    return NextResponse.json(
      { error: 'Título, slug y contenido son requeridos.' },
      { status: 400 }
    );
  }

  const cleanSlug = slug.trim().toLowerCase();
  if (!SLUG_REGEX.test(cleanSlug)) {
    return NextResponse.json(
      { error: 'El slug solo puede contener minúsculas, números y guiones (ej. mi-articulo).' },
      { status: 400 }
    );
  }

  const db = getAdminPublicClient();

  console.log('[Posts API] Creating post:', 'title=', title, ', slug=', cleanSlug, ', status=', status);

  const { data, error } = await db
    .from('posts')
    .insert({
      title: title.trim(),
      slug: cleanSlug,
      excerpt: excerpt?.trim() || null,
      content: content.trim(),
      status: status || 'draft',
      published_at: status === 'published' ? new Date().toISOString() : null,
    })
    .select('*')
    .single();

  if (error) {
    console.error('[Posts API] CREATE error:', JSON.stringify(error));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log('[Posts API] Post', data.id, 'created OK');
  return NextResponse.json(data, { status: 201 });
}
