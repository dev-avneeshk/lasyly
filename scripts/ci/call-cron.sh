#!/usr/bin/env bash
#
# Invoke an authenticated cron/job endpoint from GitHub Actions.
#
# WHY THIS EXISTS
# ---------------
# Eleven workflows each hand-rolled the same curl, and they all shared the same
# two failure modes while reporting neither usefully:
#
#   1. REDIRECT. secrets.SITE_URL may hold the apex domain, which 307s to the www
#      canonical host. Without -L that surfaced as "failed with status 307"; with
#      plain -L curl DROPS the Authorization header across a cross-host redirect
#      and it became a 401. Either way the job never ran.
#
#   2. SECRET MISMATCH. If secrets.CRON_SECRET does not match the CRON_SECRET in
#      the Vercel environment, every one of these endpoints returns 401. This is
#      what was actually happening: Keep Warm (the only workflow carrying no
#      credentials) was green while all eleven authenticated ones were red, and
#      computed_props / rankings / player-of-week had been stale for ~2 weeks.
#
# A bare "status 401" in a log does not tell you which of those it is, so this
# resolves the origin explicitly, validates its inputs, and prints the actual
# remediation on failure.
#
# Credentials are never sent through a redirect: we resolve where SITE_URL lands
# using an unauthenticated request first, then post directly to that origin.
#
# USAGE
#   scripts/ci/call-cron.sh <path> [method]
#
#   SITE_URL=https://www.example.com CRON_SECRET=… \
#     scripts/ci/call-cron.sh /api/cron/precompute-props GET
#
# Exits 0 only on HTTP 200.

set -uo pipefail

PATH_ARG="${1:-}"
METHOD="${2:-POST}"
TIMEOUT="${CRON_TIMEOUT:-300}"

if [ -z "$PATH_ARG" ]; then
  echo "::error::call-cron.sh requires an endpoint path (e.g. /api/cron/retention)"
  exit 1
fi

# ─── Validate inputs before blaming the server ────────────────────────────────

if [ -z "${SITE_URL:-}" ]; then
  echo "::error::The SITE_URL secret is empty or unset. Set it to https://www.lasyly.me in"
  echo "::error::  GitHub → Settings → Secrets and variables → Actions."
  exit 1
fi

if [ -z "${CRON_SECRET:-}" ]; then
  echo "::error::The CRON_SECRET secret is empty or unset. It must match the CRON_SECRET"
  echo "::error::  environment variable in the Vercel project exactly."
  exit 1
fi

# ─── Resolve the canonical origin, unauthenticated ────────────────────────────
# Follow redirects on a harmless endpoint to learn where SITE_URL actually lands,
# so the secret can then be sent straight to the final origin.

FINAL=$(curl -s -o /dev/null -L --max-time 30 -w '%{url_effective}' "${SITE_URL%/}/api/health" || echo "")
if [ -n "$FINAL" ]; then
  ORIGIN=$(printf '%s' "$FINAL" | sed -E 's#^(https?://[^/]+).*#\1#')
else
  ORIGIN="${SITE_URL%/}"
fi

if [ "$ORIGIN" != "${SITE_URL%/}" ]; then
  echo "note: SITE_URL (${SITE_URL%/}) redirects to $ORIGIN — using the canonical origin."
  echo "      Consider updating the SITE_URL secret to $ORIGIN so no redirect is needed."
fi

TARGET="$ORIGIN$PATH_ARG"
echo "→ $METHOD $TARGET"

# ─── Call it ──────────────────────────────────────────────────────────────────

RESPONSE=$(curl -s -w $'\n%{http_code}' -X "$METHOD" --max-time "$TIMEOUT" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  "$TARGET")

CODE=$(printf '%s' "$RESPONSE" | tail -n1)
BODY=$(printf '%s' "$RESPONSE" | sed '$d')

# Truncate the body. A JSON error is a couple of lines, but a 404 returns a full
# Next.js HTML document and dumping that buries the actual diagnosis in the log.
BODY_SHORT=$(printf '%s' "$BODY" | head -c 500)
if [ "${#BODY}" -gt 500 ]; then
  BODY_SHORT="$BODY_SHORT… [truncated, ${#BODY} bytes total]"
fi

echo "status: $CODE"
echo "body:   $BODY_SHORT"

# ─── Explain, rather than just failing ────────────────────────────────────────

case "$CODE" in
  200)
    echo "✓ ok"
    exit 0
    ;;
  401)
    echo "::error::401 Unauthorized — the request REACHED the endpoint and was rejected."
    echo "::error::  This is a secret mismatch, not a URL or redirect problem."
    echo "::error::  Fix: make these two identical, then redeploy so Vercel picks it up."
    echo "::error::    GitHub → Settings → Secrets and variables → Actions → CRON_SECRET"
    echo "::error::    Vercel → Project → Settings → Environment Variables → CRON_SECRET"
    echo "::error::  If CRON_SECRET is absent in Vercel, every authenticated cron 401s."
    ;;
  307|308|301|302)
    echo "::error::$CODE redirect — origin resolution failed and the request was not followed."
    echo "::error::  Set the SITE_URL secret to the canonical host (https://www.lasyly.me)."
    ;;
  404)
    echo "::error::404 — $PATH_ARG does not exist on $ORIGIN. Either the route was renamed"
    echo "::error::  or SITE_URL points at the wrong deployment."
    ;;
  000)
    echo "::error::No response (timeout or DNS failure) for $TARGET."
    ;;
  *)
    echo "::error::Unexpected status $CODE from $TARGET."
    ;;
esac
exit 1
