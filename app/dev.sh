#!/usr/bin/env bash
# Dev: backend (http://127.0.0.1:8000) + frontend (http://127.0.0.1:5173), both bound to 127.0.0.1 only. Ctrl+C stops both.
set -euo pipefail
cd "$(dirname "$0")"
trap 'kill 0' EXIT
(cd backend && php artisan serve --host=127.0.0.1 --port=8000) &
(cd frontend && npm run dev) &
wait
