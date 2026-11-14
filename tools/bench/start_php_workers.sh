#!/usr/bin/env bash
# Several php artisan serve workers + a tiny round-robin proxy.
# Still not production (not FrankenPHP/Octane/FPM). Used only to separate php -S queueing from app+DB time.
set -euo pipefail
export PATH=/opt/php84/bin:/home/box/.local/bin:$PATH
ROOT=/workspace/Bittodent-bench/app/backend
N=${1:-4}
PROXY_PORT=${2:-8001}
BASE=${3:-8011}
cd "$ROOT"
mkdir -p storage/logs
# free old workers
for p in $(seq 0 $((N-1))); do
  port=$((BASE+p))
  fuser -k ${port}/tcp 2>/dev/null || true
done
fuser -k ${PROXY_PORT}/tcp 2>/dev/null || true
sleep 0.3
for p in $(seq 0 $((N-1))); do
  port=$((BASE+p))
  nohup php artisan serve --host=127.0.0.1 --port=$port --no-reload \
    > /tmp/bittodent-bench-w${p}.log 2>&1 &
  echo "worker $p pid $! port $port"
done
# wait
for p in $(seq 0 $((N-1))); do
  port=$((BASE+p))
  for i in $(seq 1 50); do
    if curl -sf -o /dev/null --max-time 0.2 "http://127.0.0.1:${port}/" ; then break; fi
    # artisan serve may 404 on / but still listen
    if ss -ltn | rg -q ":${port} "; then break; fi
    sleep 0.2
  done
done
python3 - << PY &
import socket, threading, itertools, sys
ports = list(range($BASE, $BASE+$N))
it = itertools.cycle(ports)
listen = $PROXY_PORT
srv = socket.socket(); srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
srv.bind(("127.0.0.1", listen)); srv.listen(128)
print(f"proxy 127.0.0.1:{listen} -> {ports}", flush=True)

def pipe(a,b):
    try:
        while True:
            d=a.recv(65536)
            if not d: break
            b.sendall(d)
    except Exception:
        pass
    finally:
        try: a.shutdown(socket.SHUT_RDWR)
        except Exception: pass

def handle(cs):
    port = next(it)
    us = socket.socket(); us.settimeout(60)
    try:
        us.connect(("127.0.0.1", port))
        t1=threading.Thread(target=pipe, args=(cs,us), daemon=True)
        t2=threading.Thread(target=pipe, args=(us,cs), daemon=True)
        t1.start(); t2.start(); t1.join(); t2.join()
    except Exception:
        pass
    finally:
        try: cs.close(); us.close()
        except Exception: pass

while True:
    c,_=srv.accept()
    threading.Thread(target=handle, args=(c,), daemon=True).start()
PY
echo "PROXY_PID=$!"
# write pid file
echo $! > /tmp/bittodent-bench-proxy.pid
