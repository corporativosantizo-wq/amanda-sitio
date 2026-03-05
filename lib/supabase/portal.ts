// ============================================================================
// lib/supabase/portal.ts
// Cliente Supabase para el portal de clientes (browser, anon key)
// Usa schema public para auth — NO expone service_role key
// ============================================================================
import { createClient } from '@supabase/supabase-js';

export function createPortalClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
