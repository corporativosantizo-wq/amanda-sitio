// ============================================================================
// API: /api/admin/posts/[id]
// CRUD de posts — usa service_role key para bypass RLS (admin auth vía Clerk)
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

// GET /api/admin/posts/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getAdminPublicClient();

  const { data, error } = await db
    .from('posts')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('[Posts API] GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json(data);
}

// PUT /api/admin/posts/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  console.log('[Posts API] Updating post', id + ':', 'title=', title, ', slug=', cleanSlug, ', status=', status);

  const { data, error } = await db
    .from('posts')
    .update({
      title: title.trim(),
      slug: cleanSlug,
      excerpt: excerpt?.trim() || null,
      content: content.trim(),
      status,
      published_at: status === 'published' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    console.error('[Posts API] UPDATE error for post', id + ':', JSON.stringify(error));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log('[Posts API] Post', id, 'updated OK');
  return NextResponse.json(data);
}

// PATCH /api/admin/posts/[id] — cambio parcial de estado (publicar/despublicar)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { status } = body;

  if (status !== 'published' && status !== 'draft') {
    return NextResponse.json(
      { error: "status debe ser 'published' o 'draft'." },
      { status: 400 }
    );
  }

  const db = getAdminPublicClient();

  const { data, error } = await db
    .from('posts')
    .update({
      status,
      published_at: status === 'published' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    console.error('[Posts API] PATCH error for post', id + ':', JSON.stringify(error));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE /api/admin/posts/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getAdminPublicClient();

  const { error } = await db.from('posts').delete().eq('id', id);

  if (error) {
    console.error('[Posts API] DELETE error for post', id + ':', JSON.stringify(error));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
