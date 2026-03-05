# Audit Report — Amanda Santizo / IURISLEX

**Date:** 2026-02-08
**Scope:** Full admin system — API endpoints, authentication, security, build integrity
**Result:** 0 TypeScript errors, 4 issues fixed, 3 recommendations for future

---

## Summary

| Category | Status |
|----------|--------|
| TypeScript build | PASS — 0 errors, 75 pages |
| Admin auth (Clerk middleware) | PASS — all /admin and /api/admin protected |
| Portal auth (Supabase JWT) | PASS — all /api/portal routes verified |
| Cron auth (CRON_SECRET) | PASS |
| Public endpoint validation | PASS — rate limit + honeypot + input validation |
| Stripe webhook auth | PASS — signature verification |
| Secrets in code | PASS — all from process.env, no NEXT_PUBLIC_ leaks |
| Supabase write operations | PASS — all use service_role via createAdminClient() |
| Encryption (Outlook tokens) | PASS — AES-256-GCM |

---

## Issues Found and Fixed

### 1. CRITICAL — Diagnostico endpoint was public (FIXED)

**File:** `middleware.ts`
**Problem:** `/api/admin/calendario/diagnostico` was in the public routes list, bypassing Clerk auth. This endpoint exposes Outlook connection status, Azure config presence, Graph API user info, and calendar names — all without requiring authentication.
**Fix:** Removed from `isPublicRoute` matcher. Now requires Clerk auth like all other `/api/admin/*` routes.

### 2. MEDIUM — Diagnostico response leaked sensitive metadata (FIXED)

**File:** `app/api/admin/calendario/diagnostico/route.ts`
**Problem:** Response included Azure client ID prefixes, secret lengths, encrypted token previews, decrypted token previews, calendar internal IDs, and the Outlook user's email address. Even behind auth, this is excessive.
**Fix:** Response now shows only boolean presence (`SET`/`NOT SET` for env vars, `true`/`false` for tokens), no previews of any secret or token material, no email addresses.

### 3. MEDIUM — Email addresses logged in plaintext (FIXED)

**Files:**
- `app/api/public/agendar/route.ts:124`
- `app/api/admin/ai/route.ts:578`
- `lib/services/outlook.service.ts:472`
- `app/api/portal/auth/login/route.ts:44`

**Problem:** Client email addresses written to production logs in plaintext. Vercel logs are accessible to team members and could be included in error reports.
**Fix:** All four locations now mask emails: `am***@domain.com`.

### 4. LOW — Dead /admin/login page (FIXED)

**File:** `app/admin/login/page.tsx` (deleted)
**Problem:** Legacy login page using Supabase email/password auth. Clerk middleware intercepts all `/admin` routes and redirects to `/sign-in` before this page could ever render. Dead code that could confuse future developers.
**Fix:** Deleted page and directory.

---

## Verified — No Issues Found

### Authentication

| Route group | Method | Status |
|-------------|--------|--------|
| `/api/admin/*` (41 routes) | Clerk middleware `auth.protect()` | PASS |
| `/api/portal/*` (8 routes) | `getPortalSession()` JWT + rate limiting | PASS |
| `/api/cron/*` (1 route) | `Authorization: Bearer CRON_SECRET` | PASS |
| `/api/pagos/webhook` | Stripe signature verification | PASS |
| `/api/public/*` (2 routes) | Rate limit + honeypot + input validation | PASS |

### Error Handling

All 52 API route files have try/catch with descriptive error messages. Error responses do not expose stack traces to the client.

### Supabase Security

- All write operations use `createAdminClient()` (service_role key)
- Portal routes verify JWT ownership before returning data
- Admin client locked to `legal` schema
- Portal client uses anon key (browser-safe) for auth flow only; all data queries go through admin client with session verification

### Encryption

- Outlook tokens: AES-256-GCM via `lib/crypto.ts`
- IV + authTag stored with ciphertext
- Key from `ENCRYPTION_KEY` env var (64 hex chars)

### Environment Variables

No secrets use `NEXT_PUBLIC_` prefix. Verified:
- `SUPABASE_SERVICE_ROLE_KEY` — server only
- `CLERK_SECRET_KEY` — server only
- `ANTHROPIC_API_KEY` — server only
- `AZURE_CLIENT_SECRET` — server only
- `STRIPE_SECRET_KEY` — server only
- `STRIPE_WEBHOOK_SECRET` — server only
- `ENCRYPTION_KEY` — server only
- `CRON_SECRET` — server only

---

## Recommendations (Future)

### 1. Persistent rate limiting for public endpoints

The `/api/public/agendar` rate limiter uses an in-memory Map. On Vercel serverless, each cold start gets a fresh Map, so a determined attacker could bypass the 5-requests-per-hour limit by waiting for instance rotation.

**Recommendation:** Use Vercel KV (Redis) or Upstash for persistent rate limiting when scaling becomes a concern. Current honeypot + input validation provides adequate protection for current traffic levels.

### 2. Role-based access when team grows

`lib/auth/api-auth.ts` has a `requireAdmin()` helper with role validation commented out (by design — solo admin phase). When adding team members:

1. Uncomment the role check in `requireAdmin()`
2. Set Clerk session claims metadata with role (`admin`, `abogado`, `asistente`)
3. Consider adding `requireAdmin()` calls in individual API routes for defense-in-depth

### 3. Outlook token logging in development

`lib/services/outlook.service.ts` has detailed token substring logging (lines 98-110 in `exchangeCodeForTokens`). These are useful for debugging OAuth flows but should be gated behind a `NODE_ENV === 'development'` check or removed after the OAuth integration is stable.

---

## Files Modified

| File | Change |
|------|--------|
| `middleware.ts` | Removed diagnostico from public routes |
| `app/admin/login/page.tsx` | Deleted (dead code) |
| `app/api/admin/calendario/diagnostico/route.ts` | Redacted token/config metadata from response |
| `app/api/public/agendar/route.ts` | Masked email in console.log |
| `app/api/admin/ai/route.ts` | Masked email in console.log |
| `lib/services/outlook.service.ts` | Masked email in console.log |
| `app/api/portal/auth/login/route.ts` | Masked email in console.warn |

## Inventory

- **52 API routes** audited (41 admin, 8 portal, 2 public, 1 cron)
- **75 pages** build successfully (was 76; login page removed)
- **23 database tables** referenced, all in `legal` schema (+ `posts` in public)
- **0 TypeScript errors**
- **0 hardcoded secrets**
