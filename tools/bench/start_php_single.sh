#!/usr/bin/env bash
set -euo pipefail
export PATH=/opt/php84/bin:/home/box/.local/bin:$PATH
cd /workspace/Bittodent-bench/app/backend
fuser -k 8001/tcp 2>/dev/null || true
sleep 0.2
nohup php artisan serve --host=127.0.0.1 --port=8001 --no-reload > /tmp/bittodent-bench-single.log 2>&1 &
echo "SINGLE_PID=$!"
