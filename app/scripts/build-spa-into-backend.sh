#!/usr/bin/env bash
# Build the React SPA and publish it into the Laravel app at backend/public/client, so one host serves SPA + API
# (Sanctum session/XSRF cookies stay first-party). Laravel serves client/index.html at "/" (routes/web.php);
# public/index.php is never touched. Used by the Laravel Cloud build command (docs/deploy/staging.md).
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
out="$here/backend/public/client"
cd "$here/frontend"
[ "${SKIP_NPM_CI:-}" = 1 ] || npm ci --no-audit --no-fund
npm run build -- --base=/client/ --outDir "$out" --emptyOutDir
# Self-check: entry script is external and under /client/ (the CSP allows no inline script).
grep -q 'src="/client/assets/' "$out/index.html" || { echo "build-spa: index.html tidak merujuk /client/assets/" >&2; exit 1; }
if grep -Eq '<script( type="module")?>' "$out/index.html"; then echo "build-spa: ada <script> inline, diblokir CSP" >&2; exit 1; fi
echo "SPA siap di $out"
