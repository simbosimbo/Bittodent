#!/usr/bin/env python3
"""HTTP load harness for Bittodent bench/scale. SYNTHETIC data only.

Usage:
  python3 tools/bench/http_load.py --base http://127.0.0.1:8001 --manifest app/backend/database/bench/out/manifest-A.json
"""
from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

OUT = Path(__file__).resolve().parent / "out"
OUT.mkdir(exist_ok=True)


def login(base: str, email: str) -> requests.Session:
    s = requests.Session()
    origin = base
    headers = {
        "Accept": "application/json",
        "Origin": origin,
        "Referer": origin + "/",
        "X-Requested-With": "XMLHttpRequest",
    }
    r = s.get(base + "/sanctum/csrf-cookie", headers=headers, timeout=30)
    r.raise_for_status()
    xsrf = None
    for c in s.cookies:
        if c.name == "XSRF-TOKEN":
            xsrf = urllib.parse.unquote(c.value)
    if not xsrf:
        raise RuntimeError("no XSRF-TOKEN cookie")
    headers["X-XSRF-TOKEN"] = xsrf
    r = s.post(base + "/dev/quick-login", json={"user_email": email}, headers=headers, timeout=30)
    if r.status_code != 204:
        raise RuntimeError(f"quick-login {r.status_code}: {r.text[:300]}")
    # refresh csrf after session regenerate
    r = s.get(base + "/sanctum/csrf-cookie", headers=headers, timeout=30)
    r.raise_for_status()
    for c in s.cookies:
        if c.name == "XSRF-TOKEN":
            headers["X-XSRF-TOKEN"] = urllib.parse.unquote(c.value)
    s.headers.update(headers)
    r = s.get(base + "/api/me", timeout=30)
    if r.status_code != 200:
        raise RuntimeError(f"/api/me {r.status_code}: {r.text[:300]}")
    return s


def pct(xs, p):
    if not xs:
        return None
    ys = sorted(xs)
    if p <= 0:
        return ys[0]
    k = min(len(ys) - 1, max(0, int(round((p / 100) * (len(ys) - 1)))))
    return ys[k]


def summarize(samples):
    oks = [s for s in samples if s["ok"]]
    times = [s["ms"] for s in oks]
    q = [s["queries"] for s in oks if s["queries"] is not None]
    err = [s for s in samples if not s["ok"]]
    return {
        "n": len(samples),
        "ok": len(oks),
        "errors": len(err),
        "error_examples": [
            {"status": e.get("status"), "ms": e["ms"], "body": (e.get("body") or "")[:180]} for e in err[:5]
        ],
        "ms_p50": round(statistics.median(times), 2) if times else None,
        "ms_p95": round(pct(times, 95), 2) if times else None,
        "ms_p99": round(pct(times, 99), 2) if times else None,
        "ms_min": round(min(times), 2) if times else None,
        "ms_max": round(max(times), 2) if times else None,
        "queries_p50": statistics.median(q) if q else None,
        "queries_max": max(q) if q else None,
        "bytes_p50": int(statistics.median([s["bytes"] for s in oks])) if oks else None,
        "confirmed": sum(1 for s in oks if s.get("confirmed")),
    }


def one_request(session, method, url, **kw):
    t0 = time.perf_counter()
    try:
        r = session.request(method, url, timeout=60, **kw)
        ms = (time.perf_counter() - t0) * 1000
        q = r.headers.get("X-Bench-Query-Count")
        return {
            "ok": 200 <= r.status_code < 300,
            "status": r.status_code,
            "ms": ms,
            "bytes": len(r.content),
            "queries": int(q) if q is not None and str(q).isdigit() else None,
            "body": r.text,
            "headers": dict(r.headers),
        }
    except Exception as e:
        ms = (time.perf_counter() - t0) * 1000
        return {"ok": False, "status": 0, "ms": ms, "bytes": 0, "queries": None, "body": str(e), "headers": {}}


def run_case(name, sessions, builder, warmup, iters, concurrency):
    # builder(session, i) -> (method, url, kwargs, confirm_fn)
    # warmup
    for i in range(warmup):
        s = sessions[i % len(sessions)]
        method, url, kw, confirm = builder(s, i)
        one_request(s, method, url, **kw)
    samples = []

    def work(i):
        s = sessions[i % len(sessions)]
        method, url, kw, confirm = builder(s, i)
        rec = one_request(s, method, url, **kw)
        rec["confirmed"] = False
        if rec["ok"] and confirm:
            try:
                rec["confirmed"] = bool(confirm(rec))
            except Exception:
                rec["confirmed"] = False
        # drop body after confirm to keep the report small
        rec.pop("headers", None)
        if rec["ok"]:
            rec["body"] = ""
        return rec

    if concurrency <= 1:
        for i in range(iters):
            samples.append(work(i))
    else:
        with ThreadPoolExecutor(max_workers=concurrency) as ex:
            futs = [ex.submit(work, i) for i in range(iters)]
            for f in as_completed(futs):
                samples.append(f.result())
    return {"name": name, "warmup": warmup, "concurrency": concurrency, "iters": iters, **summarize(samples)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:8001")
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--out", default=str(OUT / "http.json"))
    ap.add_argument("--sessions", type=int, default=50)
    args = ap.parse_args()
    man = json.loads(Path(args.manifest).read_text())
    t = man["tenants"][0]
    email = t["users"]["dokter"]["email"]
    owner_email = t["users"]["pemilik"]["email"]
    print("logging in", args.sessions, "sessions as", email, "against", args.base)
    sessions = []
    t0 = time.perf_counter()
    for i in range(args.sessions):
        sessions.append(login(args.base, email))
        if (i + 1) % 10 == 0:
            print("  sessions", i + 1)
    owner_sessions = [login(args.base, owner_email) for _ in range(min(10, args.sessions))]
    print("login_s", round(time.perf_counter() - t0, 2))

    branch = t["branch_id"]
    today = t["today"]
    typical = t["typical_patient_id"]
    heavy = t["heavy_patient_id"]
    nik = t["search_nik"]
    phone = t["search_phone"]
    drafts = t["draft_visits"]
    future = t["open_future_appointment_ids"]
    name_q = t["search_name"]

    cases = []

    def add(name, builder, warmup=5, iters=30, concs=(1, 10, 50)):
        for c in concs:
            # fewer iters at high C to finish in reasonable time, but still enough for p95
            n = iters if c == 1 else max(iters, c * 4)
            print(f"  {name} c={c} n={n}")
            rec = run_case(name, sessions, builder, warmup, n, c)
            print("   ", rec["ms_p50"], rec["ms_p95"], "err", rec["errors"], "q", rec["queries_p50"], "ok_confirm", rec["confirmed"])
            cases.append(rec)

    def conf_list(rec):
        data = json.loads(rec["body"] or "{}")
        return isinstance(data.get("data"), list) and rec["bytes"] > 2

    def conf_obj(rec):
        data = json.loads(rec["body"] or "{}")
        return isinstance(data, dict) and rec["status"] == 200 and rec["bytes"] > 10

    add("patient_search_name", lambda s, i: ("GET", f"{args.base}/api/patients?q={name_q}", {}, 
        lambda r: len(json.loads(r["body"]).get("data") or []) > 0))
    add("patient_search_nik", lambda s, i: ("GET", f"{args.base}/api/patients?q={nik}", {},
        lambda r: len(json.loads(r["body"]).get("data") or []) == 1))
    add("patient_search_phone", lambda s, i: ("GET", f"{args.base}/api/patients?q={phone}", {},
        lambda r: len(json.loads(r["body"]).get("data") or []) == 1))
    add("patient_detail", lambda s, i: ("GET", f"{args.base}/api/patients/{typical}", {},
        lambda r: json.loads(r["body"]).get("id") == typical))
    add("chart_typical", lambda s, i: ("GET", f"{args.base}/api/patients/{typical}/chart", {},
        lambda r: "findings" in json.loads(r["body"]) and "visits" in json.loads(r["body"])))
    add("chart_heavy", lambda s, i: ("GET", f"{args.base}/api/patients/{heavy}/chart", {},
        lambda r: len(json.loads(r["body"]).get("visits") or []) >= 1), iters=20, concs=(1, 10, 50))
    add("schedule_today", lambda s, i: ("GET", f"{args.base}/api/schedule?branch_id={branch}&date={today}", {},
        lambda r: "chairs" in json.loads(r["body"])))
    def add_owner(name, builder, warmup=5, iters=30, concs=(1, 10, 50)):
        for c in concs:
            n = iters if c == 1 else max(iters, c * 4)
            print(f"  {name} c={c} n={n}")
            rec = run_case(name, owner_sessions, builder, warmup, n, c)
            print("   ", rec["ms_p50"], rec["ms_p95"], "err", rec["errors"], "q", rec["queries_p50"], "ok_confirm", rec["confirmed"])
            cases.append(rec)

    add_owner("billing_list_today", lambda s, i: ("GET", f"{args.base}/api/bench/invoices?from={today}&to={today}", {}, conf_list))
    add_owner("billing_list_30d", lambda s, i: ("GET", f"{args.base}/api/bench/invoices?from=2026-10-15&to={today}", {}, conf_list))
    add("audit_patient_90d", lambda s, i: ("GET", f"{args.base}/api/bench/audit?entity_type=patient&entity_id={typical}&days=90", {},
        lambda r: "data" in json.loads(r["body"])))
    add("audit_patient_3650d", lambda s, i: ("GET", f"{args.base}/api/bench/audit?entity_type=patient&entity_id={typical}&days=3650", {},
        lambda r: "data" in json.loads(r["body"])), iters=20, concs=(1, 10))

    # Writes: encounter create (unique future appts, then leftovers are idempotent 200)
    def build_visit(s, i):
        appt = future[i % len(future)]
        return ("POST", f"{args.base}/api/appointments/{appt}/visit", {"json": {}},
                lambda r: json.loads(r["body"]).get("id"))
    add("encounter_create_or_idempotent", build_visit, warmup=1, iters=min(40, max(10, len(future))), concs=(1, 10))

    # Save draft note on remaining draft visits (revision increments — only use each once at c=1)
    if drafts:
        def build_save(s, i):
            d = drafts[i % len(drafts)]
            body = {
                "revision": 1,
                "source": "manual",
                "soap": {
                    "S": "SYNTHETIC bench save",
                    "O": "Pemeriksaan sintetis",
                    "A": {"codes": ["K02.1"], "text": "Karies sintetis"},
                    "P": {"codes": ["23.2"], "text": "Rencana fiktif"},
                },
            }
            return ("PUT", f"{args.base}/api/visits/{d['visit_id']}/note", {"json": body},
                    lambda r: r["status"] in (200, 409))
        # only concurrency 1: revision conflicts otherwise
        add("note_save_draft", build_save, warmup=0, iters=min(10, len(drafts)), concs=(1,))

    # Imaging upload+view if a compressed sample exists
    img = Path(__file__).resolve().parent / "out" / "panoramic_2900x1400_16bit.jxl"
    if not img.exists():
        img = Path(__file__).resolve().parent / "out" / "panoramic_2900x1400_16bit.png"
    if img.exists():
        def build_up(s, i, path=img):
            files = {"file": (path.name, path.read_bytes(), "application/octet-stream")}
            data = {"kind": "original", "codec": path.suffix.lstrip("."), "label": "SYNTHETIC"}
            return ("POST", f"{args.base}/api/bench/images", {"files": files, "data": data},
                    lambda r: json.loads(r["body"]).get("id"))
        recs = []
        # sequential so we keep ids
        ids = []
        for i in range(5):
            method, url, kw, confirm = build_up(sessions[0], i)
            r = one_request(sessions[0], method, url, **kw)
            r["confirmed"] = False
            if r["ok"]:
                mid = json.loads(r["body"]).get("id")
                r["confirmed"] = bool(mid)
                if mid:
                    ids.append(mid)
                r["body"] = ""
            recs.append(r)
        cases.append({"name": "image_upload_original", "warmup": 0, "concurrency": 1, "iters": 5, **summarize(recs)})
        if ids:
            def build_view(s, i, ids=ids):
                return ("GET", f"{args.base}/api/bench/images/{ids[i % len(ids)]}", {},
                        lambda r: r["status"] == 200 and r["bytes"] > 100 and r["headers"].get("X-Bench-Label") == "SYNTHETIC")
            # one_request drops headers after confirm in run_case — fix confirm to use before drop; run_case keeps headers until confirm. Good.
            add("image_view_stream", build_view, warmup=1, iters=10, concs=(1, 10))

    report = {
        "base": args.base,
        "manifest": args.manifest,
        "tenant_tag": t["tag"],
        "email": email,
        "cases": cases,
    }
    Path(args.out).write_text(json.dumps(report, indent=2))
    print("wrote", args.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
