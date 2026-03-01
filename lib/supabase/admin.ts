// ============================================================================
// lib/supabase/admin.ts
// Cliente con service_role para operaciones backend (API routes, triggers)
// NUNCA exponer en el browser — solo server-side
// ============================================================================

/**
 * ⚠️ SECURITY: This client uses service_role key which BYPASSES RLS.
 * NEVER import this file in client components or files with "use client".
 * Only use in API routes and server-side code.
 */

import { createClient } from '@supabase/supabase-js';

if (typeof window !== 'undefined') {
  throw new Error(
    'SECURITY: lib/supabase/admin.ts was imported in a browser context. ' +
    'This file uses the service_role key and must ONLY run server-side.'
  );
}

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
