#!/usr/bin/env bash
# Build a deployable ZIP for Hostinger shared hosting (STAGING, synthetic data only; docs/deploy/hostinger.md).
# Archive root = contents of app/backend (+ vendor, SPA in public/client, root .htaccess), to be extracted into public_html.
# Works on a clean `git archive HEAD` export: uncommitted changes are NOT included and the working tree is never modified.
#
# Usage: [PHP_BIN=/path/to/php8.4] [COMPOSER_BIN=composer] [ENV_FILE=/secure/path/.env] [SKIP_NPM_CI=1] \
#          app/scripts/build-hostinger-archive.sh [OUTPUT_DIR=/tmp]
set -euo pipefail

PHP_BIN="${PHP_BIN:-php}"
COMPOSER_BIN="${COMPOSER_BIN:-composer}"
out_dir="${1:-/tmp}"
here="$(cd "$(dirname "$0")/.." && pwd)"          # app/
repo="$(git -C "$here" rev-parse --show-toplevel)"
prefix="$(git -C "$here" rev-parse --show-prefix)"  # path of app/ inside the repo, e.g. "app/"

die() { echo "build-hostinger: $*" >&2; exit 1; }

"$PHP_BIN" -r 'exit(PHP_VERSION_ID >= 80400 && PHP_VERSION_ID < 80500 ? 0 : 1);' \
  || die "PHP_BIN harus PHP 8.4 (sekarang: $("$PHP_BIN" -r 'echo PHP_VERSION;' 2>/dev/null || echo tidak ada))"
mkdir -p "$out_dir"
out_dir="$(cd "$out_dir" && pwd)"
[ -n "$(git -C "$repo" status --porcelain -- "$prefix")" ] && echo "PERINGATAN: ada perubahan belum di-commit di $prefix; arsip memakai HEAD saja." >&2
if [ -n "${ENV_FILE:-}" ]; then
  [ -f "$ENV_FILE" ] || die "ENV_FILE tidak ada: $ENV_FILE"
  case "$(cd "$(dirname "$ENV_FILE")" && pwd)/" in "$repo"/*) die "ENV_FILE tidak boleh dari dalam repo (rahasia di luar repo)";; esac
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
export_dir="$work/export"
stage="$work/stage"
mkdir -p "$export_dir" "$stage"

# 1. Clean export of the committed app/ tree.
git -C "$repo" archive --format=tar HEAD "$prefix" | tar -x -C "$export_dir"
app="$export_dir/${prefix%/}"

# 2. Production dependencies with PHP 8.4 (composer's `php` resolves to PHP_BIN's directory first).
php_dir="$(dirname "$(command -v "$PHP_BIN")")"
(cd "$app/backend" && PATH="$php_dir:$PATH" "$COMPOSER_BIN" install --no-dev --optimize-autoloader --classmap-authoritative \
  --no-interaction --no-progress)

# 3. SPA into public/client, same logic as the Laravel Cloud build. SKIP_NPM_CI=1 reuses app/frontend/node_modules.
if [ "${SKIP_NPM_CI:-}" = 1 ]; then
  [ -d "$here/frontend/node_modules" ] || die "SKIP_NPM_CI=1 tapi app/frontend/node_modules tidak ada"
  ln -s "$here/frontend/node_modules" "$app/frontend/node_modules"
fi
bash "$app/scripts/build-spa-into-backend.sh"

# 4. Stage: archive root = Laravel root, minus tests, dev/container files and secrets.
tar -C "$app/backend" -cf - \
  --exclude=./tests --exclude=./phpunit.xml --exclude=./Dockerfile --exclude=./docker --exclude=./.dockerignore \
  --exclude='./.env*' --exclude=./node_modules --exclude=./AGENTS.md --exclude=./CLAUDE.md . | tar -C "$stage" -xf -
# Runtime storage starts empty; directories and their .gitignore stay (Laravel needs them writable).
find "$stage/storage/logs" "$stage/storage/framework/views" "$stage/storage/framework/cache" "$stage/storage/framework/sessions" \
  -type f ! -name .gitignore -delete
cp "$app/deploy/hostinger/root.htaccess" "$stage/.htaccess"
if [ -n "${ENV_FILE:-}" ]; then
  install -m 600 "$ENV_FILE" "$stage/.env"
else
  echo "PERINGATAN: ENV_FILE tidak diberikan; arsip TANPA .env. Deploy menimpa public_html, jadi aplikasi tidak jalan tanpa .env." >&2
fi
for f in .htaccess artisan public/.htaccess public/index.php public/client/index.html vendor/autoload.php bootstrap/app.php; do
  [ -e "$stage/$f" ] || die "berkas wajib tidak ada di arsip: $f"
done

# 5. Zip with files at the archive root (dotfiles included).
zip_path="$out_dir/bittodent-staging_$(date +%Y%m%d_%H%M%S).zip"
if command -v zip >/dev/null; then
  (cd "$stage" && zip -r -q "$zip_path" .)
else
  # shortcut: zip(1) missing on this machine; Python's zipfile CLI writes the same layout (dotfiles included).
  (cd "$stage" && shopt -s dotglob && python3 -m zipfile -c "$zip_path" *)
fi

# Self-check on the finished archive.
listing="$(unzip -Z1 "$zip_path")"
grep -qx '.htaccess' <<<"$listing" || die "arsip tanpa .htaccess root"
grep -qx 'public/index.php' <<<"$listing" || die "arsip tanpa public/index.php"
grep -q '^tests/' <<<"$listing" && die "arsip berisi tests/"
if [ -z "${ENV_FILE:-}" ] && grep -qx '.env' <<<"$listing"; then die "arsip berisi .env padahal ENV_FILE tidak diberikan"; fi
echo "$zip_path"
