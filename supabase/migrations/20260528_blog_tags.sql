-- ============================================================================
-- Etiquetas para el blog: tablas tags y post_tags
-- Aplicada vía MCP (create_tags_and_post_tags). Este archivo documenta el cambio.
-- ============================================================================

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz default now()
);

create table if not exists public.post_tags (
  post_id uuid not null references public.posts(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (post_id, tag_id)
);

create index if not exists post_tags_post_id_idx on public.post_tags(post_id);
create index if not exists post_tags_tag_id_idx on public.post_tags(tag_id);

alter table public.tags enable row level security;
alter table public.post_tags enable row level security;

-- Lectura pública (el blog y el listado admin usan el cliente anon)
create policy "Tags are viewable by everyone"
  on public.tags for select using (true);
create policy "Post tags are viewable by everyone"
  on public.post_tags for select using (true);

-- Escritura solo service_role (admin vía API)
create policy "Service role can insert tags"
  on public.tags for insert to service_role with check (true);
create policy "Service role can update tags"
  on public.tags for update to service_role using (true) with check (true);
create policy "Service role can delete tags"
  on public.tags for delete to service_role using (true);

create policy "Service role can insert post_tags"
  on public.post_tags for insert to service_role with check (true);
create policy "Service role can delete post_tags"
  on public.post_tags for delete to service_role using (true);
