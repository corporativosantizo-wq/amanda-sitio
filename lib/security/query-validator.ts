// ============================================================================
// lib/security/query-validator.ts
// Defense-in-depth validation for consultar_base_datos tool queries
// ============================================================================
import { createAdminClient } from '@/lib/supabase/admin';

// ── Whitelist of allowed query types ────────────────────────────────────────
const ALLOWED_QUERIES = [
  'clientes_count',
  'facturas_pendientes',
  'cotizaciones_mes',
  'clientes_recientes',
  'gastos_mes',
  'pagos_mes',
  'buscar_contacto',
  'buscar_cliente',
] as const;

// ── Dangerous SQL patterns (case-insensitive) ──────────────────────────────
const DANGEROUS_PATTERNS: RegExp[] = [
  /\b(DROP|DELETE|INSERT|UPDATE|ALTER|CREATE|TRUNCATE)\b/i,
  /\b(GRANT|REVOKE)\b/i,
  /\bEXEC(UTE)?\b/i,
  /--/,
  /;/,
  /\bUNION\s+SELECT\b/i,
  /\bINTO\s+OUTFILE\b/i,
  /\bLOAD_FILE\b/i,
  /\bpg_/i,
  /\binformation_schema\b/i,
];

// ── Characters forbidden in search parameters ──────────────────────────────
const FORBIDDEN_PARAM_CHARS = /['";\\{}]/;

// ── Validator ───────────────────────────────────────────────────────────────
export function validateAndSanitizeQuery(query: string): {
  isValid: boolean;
  sanitizedQuery: string;
  reason?: string;
} {
  const trimmed = query.trim();

  // Capa 1 — Whitelist: query must start with an allowed type
  const queryType = trimmed.split(':')[0];
  if (!ALLOWED_QUERIES.includes(queryType as any)) {
    return {
      isValid: false,
      sanitizedQuery: '',
      reason: `Query type "${queryType}" no está en la whitelist`,
    };
  }

  // Capa 2 — Blocklist: reject dangerous SQL patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        isValid: false,
        sanitizedQuery: '',
        reason: `Patrón peligroso detectado: ${pattern.source}`,
      };
    }
  }

  // Capa 3 — Sanitize search parameter (buscar_contacto:nombre / buscar_cliente:nombre)
  if (queryType === 'buscar_contacto' || queryType === 'buscar_cliente') {
    const paramPart = trimmed.slice(queryType.length + 1).trim();
    if (!paramPart) {
      return {
        isValid: false,
        sanitizedQuery: '',
        reason: 'Falta el nombre de búsqueda después de ":"',
      };
    }
    if (paramPart.length > 100) {
      return {
        isValid: false,
        sanitizedQuery: '',
        reason: 'Parámetro de búsqueda excede 100 caracteres',
      };
    }
    if (FORBIDDEN_PARAM_CHARS.test(paramPart)) {
      return {
        isValid: false,
        sanitizedQuery: '',
        reason: 'Caracteres no permitidos en parámetro de búsqueda',
      };
    }
    return { isValid: true, sanitizedQuery: `${queryType}:${paramPart}` };
  }

  return { isValid: true, sanitizedQuery: trimmed };
}

// ── Audit Logger (fire-and-forget) ──────────────────────────────────────────
export async function logQueryAudit(params: {
  toolName: string;
  queryInput: string;
  validated: boolean;
  rejectionReason?: string;
  resultPreview?: string;
  executionMs?: number;
}): Promise<void> {
  const db = createAdminClient();
  db.from('ai_audit_log')
    .insert({
      tool_name: params.toolName,
      query_input: params.queryInput,
      validated: params.validated,
      rejection_reason: params.rejectionReason ?? null,
      result_preview: params.resultPreview ?? null,
      execution_ms: params.executionMs ?? null,
    })
    .then(() => {
      /* ok */
    })
    .catch((err: any) => console.error('[AuditLog] Error:', err.message));
}

// ── Test cases (reference) ──────────────────────────────────────────────────
// validateAndSanitizeQuery('clientes_count')                          → { isValid: true }
// validateAndSanitizeQuery('buscar_contacto:Juan López')              → { isValid: true, sanitizedQuery: 'buscar_contacto:Juan López' }
// validateAndSanitizeQuery('clientes_count; DROP TABLE clientes')     → { isValid: false, reason: contains ';' }
// validateAndSanitizeQuery("buscar_contacto:' OR 1=1 --")            → { isValid: false, reason: forbidden chars }
// validateAndSanitizeQuery('SELECT * FROM legal.clientes')            → { isValid: false, reason: not in whitelist }
// validateAndSanitizeQuery('unknown_query')                           → { isValid: false, reason: not in whitelist }
