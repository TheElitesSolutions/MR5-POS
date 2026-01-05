#!/bin/bash

# Test Script: Direct Supabase API Test (curl)
# Purpose: Test Supabase with curl to bypass all application code
# Date: 2026-01-04

SUPABASE_URL="https://buivobulqaryifxesvqo.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1aXZvYnVscWFyeWlmeGVzdnFvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDcyNDUxNSwiZXhwIjoyMDY2MzAwNTE1fQ.-G0GXB57aRlD9VldrkTeBb_l5lDlkXl385-qYpgdpoE"

echo "═══════════════════════════════════════════"
echo "  Direct Supabase API Test (curl)"
echo "═══════════════════════════════════════════"
echo ""

echo "📋 Test 1: Upsert category with only 'name' field"
echo "─────────────────────────────────────────"
curl -X POST \
  "${SUPABASE_URL}/rest/v1/category?on_conflict=name" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"name": "Curl Test Category"}' \
  -v 2>&1 | tee curl-test-output.log

echo ""
echo ""
echo "📋 Test 2: Query categories"
echo "─────────────────────────────────────────"
curl -X GET \
  "${SUPABASE_URL}/rest/v1/category?limit=5" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "Accept: application/json" \
  2>&1 | python -m json.tool || cat

echo ""
echo "✅ Check curl-test-output.log for full HTTP details"
