-- Bug 1 fix: service_role missing USAGE on sequences in legal schema.
-- Symptom: INSERT to legal.cobros fails with sqlstate 42501
-- "permission denied for sequence cobros_numero_cobro_seq" because the
-- DEFAULT nextval() needs USAGE on the sequence.
--
-- Diagnosed via /api/admin/diag/whoami on 2026-04-28.
-- Root cause: schema_*.sql files created tables with SERIAL columns
-- but never granted sequence permissions explicitly.
--
-- All 4 sequences in legal schema had "NO ACL ENTRIES" before this migration.
-- Already applied to production on 2026-04-28 via Supabase MCP.
-- This file documents the change for repo parity (idempotent re-application).

GRANT USAGE, SELECT ON SEQUENCE legal.clientes_codigo_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE legal.cobros_numero_cobro_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE legal.fiscalias_mp_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE legal.tribunales_oj_id_seq TO service_role;
