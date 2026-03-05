// ============================================================================
// lib/supabase/server.ts
// Cliente de Supabase para server components y API routes
// ============================================================================

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll puede fallar en Server Components (read-only)
            // Es seguro ignorar en ese contexto
          }
        },
      },
    }
  );
}

// Alias para compatibilidad con código existente
export const createClient = createServerSupabase;
