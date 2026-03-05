#!/bin/bash
# ============================================================================
# scripts/check-secrets.sh
# Verifica que no hay secrets expuestos en client bundles
# ============================================================================
set -e

echo "🔍 Checking for leaked secrets..."

# 1. Static analysis: no 'use client' file should import admin client
echo ""
echo "── Step 1: Checking for 'use client' files importing admin client..."

USE_CLIENT_FILES=$(grep -rl "'use client'" app/ components/ 2>/dev/null || true)
LEAKED=0
for f in $USE_CLIENT_FILES; do
  if grep -q "supabase/admin" "$f" 2>/dev/null; then
    echo "❌ DANGER: $f has 'use client' AND imports supabase/admin!"
    LEAKED=1
  fi
  if grep -q "SUPABASE_SERVICE_ROLE_KEY" "$f" 2>/dev/null; then
    echo "❌ DANGER: $f has 'use client' AND references SERVICE_ROLE_KEY!"
    LEAKED=1
  fi
done

if [ "$LEAKED" -eq 1 ]; then
  echo "❌ Static analysis FAILED — service_role may be exposed to client"
  exit 1
fi
echo "✅ No client files import admin client"

# 2. Check next.config for env exposure
echo ""
echo "── Step 2: Checking next.config for exposed secrets..."

if grep -q "SUPABASE_SERVICE_ROLE_KEY" next.config.ts 2>/dev/null || \
   grep -q "SUPABASE_SERVICE_ROLE_KEY" next.config.js 2>/dev/null; then
  echo "❌ DANGER: next.config exposes SUPABASE_SERVICE_ROLE_KEY!"
  exit 1
fi
echo "✅ next.config does not expose service_role key"

# 3. Build and check client bundles
echo ""
echo "── Step 3: Building project and scanning client bundles..."

npm run build --silent 2>&1 | tail -5

if [ -d ".next/static" ]; then
  # Check for Supabase service_role key patterns (the actual risk)
  if grep -rE "SUPABASE_SERVICE_ROLE_KEY|service_role|supabase_service" .next/static/ 2>/dev/null; then
    echo ""
    echo "❌ SUPABASE SECRETS FOUND IN CLIENT BUNDLE!"
    exit 1
  fi
  # Check for Stripe secret keys (actual keys, not SDK prefix constants like "sk_test_")
  if grep -rE "sk_(live|test)_[a-zA-Z0-9]{20,}" .next/static/ 2>/dev/null; then
    echo ""
    echo "❌ STRIPE SECRET KEYS FOUND IN CLIENT BUNDLE!"
    exit 1
  fi
  echo "✅ No secrets found in client bundles"
else
  echo "⚠️  .next/static not found — build may have failed"
  exit 1
fi

echo ""
echo "════════════════════════════════════════"
echo "✅ All secret checks passed"
echo "════════════════════════════════════════"
