// ============================================================================
// lib/posts/tags.ts
// Sincroniza las etiquetas de un post: upsert en `tags` y reemplazo de los
// vínculos en `post_tags`. Recibe un cliente Supabase con service_role.
// ============================================================================

import { slugify } from '@/lib/utils/slug';

const MAX_TAGS = 20;

export async function setPostTags(
  db: any,
  postId: string,
  tagNames: unknown
): Promise<void> {
  const list = Array.isArray(tagNames) ? tagNames : [];
  const seen = new Set<string>();
  const tags: { name: string; slug: string }[] = [];

  for (const raw of list) {
    const name = String(raw ?? '').trim();
    if (!name) continue;
    const slug = slugify(name);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    tags.push({ name, slug });
    if (tags.length >= MAX_TAGS) break;
  }

  // Reemplaza los vínculos actuales del post.
  const { error: delErr } = await db.from('post_tags').delete().eq('post_id', postId);
  if (delErr) throw new Error(delErr.message);

  if (tags.length === 0) return;

  const { data: upserted, error: upsertErr } = await db
    .from('tags')
    .upsert(tags, { onConflict: 'slug' })
    .select('id, slug');
  if (upsertErr) throw new Error(upsertErr.message);

  const links = (upserted ?? []).map((t: { id: string }) => ({
    post_id: postId,
    tag_id: t.id,
  }));
  if (links.length === 0) return;

  const { error: linkErr } = await db.from('post_tags').insert(links);
  if (linkErr) throw new Error(linkErr.message);
}
