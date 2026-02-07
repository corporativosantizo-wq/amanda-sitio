// ============================================================================
// lib/supabase/admin.ts
// Cliente con service_role para operaciones backend (API routes, triggers)
// NUNCA exponer en el browser — solo server-side
// ============================================================================
import { createClient } from '@supabase/supabase-js';

let adminClient: any = null;

export function createAdminClient(): any {
  if (adminClient) return adminClient;
  adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      db: { schema: 'legal' },
    }
  );
  return adminClient;
}
