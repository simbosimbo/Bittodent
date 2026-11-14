#!/usr/bin/env python3
"""Synthetic radiograph compression + envelope-encryption microbench.

All images are SYNTHETIC (not clinical). Writes tools/bench/out/imaging.json.
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import statistics
import struct
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent / "out"
OUT.mkdir(exist_ok=True)
WORKDIR = Path(tempfile.mkdtemp(prefix="bittodent-img-"))

# Sizes requested: panoramic ~2900x1400, periapical ~1500x1000, 12/16-bit grayscale.
SPECS = {
    "panoramic_2900x1400_16bit": {"w": 2900, "h": 1400, "bits": 16, "used_bits": 12},
    "periapical_1500x1000_16bit": {"w": 1500, "h": 1000, "bits": 16, "used_bits": 12},
}

WARMUP = 1
RUNS = 5  # + warmup discarded


def label_overlay(arr: np.ndarray, text: str) -> np.ndarray:
    """Burn a visible SYNTHETIC banner into the mid-gray range (doesn't clip 12-bit anatomy)."""
    h, w = arr.shape
    # Draw on an 8-bit canvas then scale into 12-bit so the label is readable after decode.
    canvas = Image.new("L", (w, min(80, h)), 0)
    draw = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 28)
    except Exception:
        font = ImageFont.load_default()
    draw.text((16, 16), text, fill=255, font=font)
    band = np.array(canvas, dtype=np.uint16)
    overlay = (band.astype(np.uint32) * 16).clip(0, 4095).astype(np.uint16)
    out = arr.copy()
    out[: band.shape[0], :w] = np.maximum(out[: band.shape[0], :w], overlay)
    return out


def synthetic_radiograph(w: int, h: int, used_bits: int, seed: int) -> np.ndarray:
    """Rough 12-bit panoramic/periapical-like field: jaw arc, teeth, trabecular noise.

    This is NOT a real radiograph and must never be treated as clinical data.
    """
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:h, 0:w]
    # background soft-tissue / air gradient
    field = 800 + 200 * (yy / max(h - 1, 1))
    # jaw arc (ellipse)
    cy, cx, ry, rx = h * 0.55, w * 0.5, h * 0.38, w * 0.42
    ell = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
    field = np.where(ell < 1.0, field + 900 * (1 - ell), field)
    # teeth as brighter rounded blocks along the arc
    n_teeth = 16 if w >= 2000 else 6
    for i in range(n_teeth):
        tx = cx + (i - (n_teeth - 1) / 2) * (rx * 1.6 / n_teeth)
        ty = cy - ry * 0.15
        tw, th = max(18, w * 0.018), max(40, h * 0.16)
        tooth = np.exp(-((xx - tx) ** 2) / (2 * tw ** 2) - ((yy - ty) ** 2) / (2 * th ** 2))
        field = field + 700 * tooth
    # trabecular mid-frequency noise
    noise = rng.normal(0, 1, (h, w))
    # cheap blur via box filter
    k = 5
    kern = np.ones((k, k), dtype=np.float64) / (k * k)
    try:
        from numpy.lib.stride_tricks import sliding_window_view
        pad = np.pad(noise, k // 2, mode="edge")
        noise = sliding_window_view(pad, (k, k)).reshape(h, w, k * k).dot(kern.ravel())
    except Exception:
        pass
    field = field + 80 * noise
    maxv = (1 << used_bits) - 1
    field = np.clip(field, 0, maxv)
    arr = field.astype(np.uint16)
    arr = label_overlay(arr, "SYNTHETIC - NOT A CLINICAL IMAGE - BITTODENT BENCH")
    return arr


def write_png16(path: Path, arr: np.ndarray) -> None:
    h, w = arr.shape
    Image.frombytes("I;16", (w, h), arr.astype("<u2").tobytes()).save(path, format="PNG")


def write_pgm16(path: Path, arr: np.ndarray) -> None:
    h, w = arr.shape
    header = f"P5\n{w} {h}\n65535\n".encode("ascii")
    # PGM 16-bit is network (big-endian) byte order
    path.write_bytes(header + arr.astype(">u2").tobytes())


def write_raw(path: Path, arr: np.ndarray) -> None:
    path.write_bytes(arr.astype("<u2").tobytes())


def timed(fn, runs=RUNS, warmup=WARMUP):
    for _ in range(warmup):
        fn()
    xs = []
    for _ in range(runs):
        t0 = time.perf_counter()
        fn()
        xs.append(time.perf_counter() - t0)
    return {
        "runs": runs,
        "warmup_discarded": warmup,
        "seconds_p50": statistics.median(xs),
        "seconds_min": min(xs),
        "seconds_max": max(xs),
        "seconds_all": xs,
    }


def run(cmd, **kw):
    r = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, **kw)
    if r.returncode != 0:
        raise RuntimeError(f"cmd failed {cmd}: {r.stderr.decode()[:500]}")
    return r


# --- envelope (must match App\\Bench\\Support\\FileEnvelope) ---
MAGIC = b"BTD1"
CHUNK = 1_048_576


def tenant_kek(master: bytes, tenant_id: str) -> bytes:
    import hmac

    return hmac.new(master, f"bittodent:kek:v1:{tenant_id}".encode(), hashlib.sha256).digest()


def aad(file_id: str, tenant_id: str, sha: bytes, idx: int) -> bytes:
    return f"bittodent:v1:{file_id}:{tenant_id}:{sha.hex()}:{idx}".encode()


def aes_gcm_encrypt(key: bytes, iv: bytes, pt: bytes, aad_b: bytes) -> tuple[bytes, bytes]:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    # cryptography AESGCM bundles tag at the end; we need raw tag separate.
    # Use PyCryptodome-less path: openssl via cryptography AESGCM and split.
    c = AESGCM(key).encrypt(iv, pt, aad_b)
    return c[:-16], c[-16:]


def aes_gcm_decrypt(key: bytes, iv: bytes, ct: bytes, tag: bytes, aad_b: bytes) -> bytes:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    return AESGCM(key).decrypt(iv, ct + tag, aad_b)


def envelope_encrypt(plain: bytes, tenant_id: str, file_id: str, master: bytes) -> bytes:
    sha = hashlib.sha256(plain).digest()
    kek = tenant_kek(master, tenant_id)
    dek = os.urandom(32)
    wrap_iv = os.urandom(12)
    wrap_ct, wrap_tag = aes_gcm_encrypt(kek, wrap_iv, dek, tenant_id.encode())
    file_nonce = os.urandom(8)
    chunks = b""
    n_chunks = 0
    for off in range(0, max(len(plain), 1), CHUNK):
        # empty plaintext still gets one chunk if len==0? skip if empty
        sl = plain[off : off + CHUNK]
        if not sl and off > 0:
            break
        iv = file_nonce + struct.pack(">I", n_chunks)
        ct, tag = aes_gcm_encrypt(dek, iv, sl, aad(file_id, tenant_id, sha, n_chunks))
        chunks += struct.pack(">I", len(ct)) + iv + tag + ct
        n_chunks += 1
    kek_id = f"tenant:{tenant_id}".encode()
    header = MAGIC + bytes([1, len(kek_id)]) + kek_id + wrap_iv + wrap_tag + wrap_ct + file_nonce + struct.pack(">I", n_chunks)
    return header + chunks, sha.hex()


def envelope_decrypt(blob: bytes, tenant_id: str, file_id: str, expected_sha_hex: str, master: bytes) -> bytes:
    if blob[:4] != MAGIC:
        raise ValueError("bad magic")
    p = 4
    ver = blob[p]; p += 1
    if ver != 1:
        raise ValueError("ver")
    kek_len = blob[p]; p += 1
    kek_id = blob[p : p + kek_len]; p += kek_len
    if kek_id != f"tenant:{tenant_id}".encode():
        raise ValueError("kek id")
    wrap_iv = blob[p : p + 12]; p += 12
    wrap_tag = blob[p : p + 16]; p += 16
    wrap_ct = blob[p : p + 32]; p += 32
    dek = aes_gcm_decrypt(tenant_kek(master, tenant_id), wrap_iv, wrap_ct, wrap_tag, tenant_id.encode())
    file_nonce = blob[p : p + 8]; p += 8
    n_chunks = struct.unpack(">I", blob[p : p + 4])[0]; p += 4
    sha = bytes.fromhex(expected_sha_hex)
    h = hashlib.sha256()
    out = []
    for i in range(n_chunks):
        ct_len = struct.unpack(">I", blob[p : p + 4])[0]; p += 4
        iv = blob[p : p + 12]; p += 12
        tag = blob[p : p + 16]; p += 16
        ct = blob[p : p + ct_len]; p += ct_len
        pt = aes_gcm_decrypt(dek, iv, ct, tag, aad(file_id, tenant_id, sha, i))
        h.update(pt)
        out.append(pt)
    if h.hexdigest() != expected_sha_hex:
        raise ValueError("hash mismatch")
    return b"".join(out)


def has_cryptography() -> bool:
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM  # noqa: F401

        return True
    except Exception:
        return False


def encode_png(src_png: Path, dst: Path):
    # already a PNG; copy is not an encode. Re-encode with Pillow to time it.
    im = Image.open(src_png)
    im.save(dst, format="PNG", compress_level=6)


def decode_png(path: Path):
    im = Image.open(path)
    a = np.array(im)
    if a.ndim == 3:
        a = a[..., 0]
    return a.astype(np.uint16, copy=False)


def main():
    if not has_cryptography():
        # fallback: use openssl via PHP one-shot? Try install in venv note.
        sys.stderr.write("python cryptography is required for the envelope microbench\n")
    results = {
        "label": "SYNTHETIC",
        "disclaimer": "Generated grayscale images only. Not clinical radiographs. Not patient data.",
        "tool_versions": {
            "cjxl": subprocess.run(["cjxl", "--version"], text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT).stdout.splitlines()[0],
            "opj_compress": subprocess.run(["opj_compress"], text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT).stdout.splitlines()[0],
            "zstd": subprocess.run(["zstd", "--version"], text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT).stdout.splitlines()[0],
            "python": sys.version.split()[0],
            "numpy": np.__version__,
            "PIL": Image.__version__,
        },
        "images": {},
        "workdir": str(WORKDIR),
    }
    master = os.urandom(32)
    tenant_id = "00000000-0000-0000-0000-000000000001"
    file_id = "00000000-0000-7000-8000-0000000000aa"

    for name, spec in SPECS.items():
        arr = synthetic_radiograph(spec["w"], spec["h"], spec["used_bits"], seed=20261114 + spec["w"])
        raw_bytes = arr.astype("<u2").tobytes()
        raw_path = WORKDIR / f"{name}.raw"
        png_path = WORKDIR / f"{name}.png"
        pgm_path = WORKDIR / f"{name}.pgm"
        write_raw(raw_path, arr)
        write_png16(png_path, arr)
        write_pgm16(pgm_path, arr)
        # persist a small preview jpeg (lossy, UI only) labeled
        preview = Image.fromarray((arr / 16).clip(0, 255).astype(np.uint8), mode="L")
        preview.thumbnail((400, 200))
        preview_path = OUT / f"{name}.thumb.jpg"
        preview.save(preview_path, format="JPEG", quality=70)
        # also save a visible 8-bit full preview for the report (lossy, not diagnostic)
        full8 = Image.fromarray((arr / 16).clip(0, 255).astype(np.uint8), mode="L")
        full8_path = OUT / f"{name}.preview8.png"
        full8.save(full8_path)

        src_sha = hashlib.sha256(raw_bytes).hexdigest()
        entry = {
            "width": spec["w"],
            "height": spec["h"],
            "container_bits": spec["bits"],
            "used_bits": spec["used_bits"],
            "raw_bytes": len(raw_bytes),
            "raw_sha256": src_sha,
            "label": "SYNTHETIC - NOT A CLINICAL IMAGE - BITTODENT BENCH",
            "preview_thumb": str(preview_path),
            "codecs": {},
        }

        def check_roundtrip(decoded: np.ndarray, codec: str):
            dec = np.asarray(decoded)
            if dec.ndim == 3:
                dec = dec[..., 0]
            dec = dec.astype(np.uint16, copy=False)
            if dec.shape != arr.shape:
                # some codecs may drop to 8-bit or scale — record, don't silently pass
                entry["codecs"][codec]["roundtrip"] = f"shape {dec.shape} != {arr.shape}"
                return False
            if not np.array_equal(dec, arr):
                # if values were scaled (e.g. max 4095 vs 65535) still fail lossless
                entry["codecs"][codec]["roundtrip"] = "pixel mismatch"
                return False
            entry["codecs"][codec]["roundtrip"] = "ok"
            return True

        # PNG (Pillow re-encode)
        dst = WORKDIR / f"{name}.re.png"
        t_enc = timed(lambda: encode_png(png_path, dst))
        t_dec = timed(lambda: decode_png(dst))
        entry["codecs"]["png"] = {
            "role": "lossless diagnostic candidate",
            "bytes": dst.stat().st_size,
            "ratio_vs_raw": round(len(raw_bytes) / dst.stat().st_size, 3),
            "encode": t_enc,
            "decode": t_dec,
        }
        check_roundtrip(decode_png(dst), "png")

        # JPEG-XL lossless
        jxl = WORKDIR / f"{name}.jxl"
        def enc_jxl():
            # cjxl --lossless / -d 0
            if jxl.exists():
                jxl.unlink()
            run(["cjxl", str(png_path), str(jxl), "-d", "0", "--quiet"])
        t_enc = timed(enc_jxl)
        jxl_dec_png = WORKDIR / f"{name}.jxl.png"
        def dec_jxl():
            if jxl_dec_png.exists():
                jxl_dec_png.unlink()
            run(["djxl", str(jxl), str(jxl_dec_png), "--quiet"])
        t_dec = timed(dec_jxl)
        entry["codecs"]["jpegxl_lossless"] = {
            "role": "lossless diagnostic candidate",
            "bytes": jxl.stat().st_size,
            "ratio_vs_raw": round(len(raw_bytes) / jxl.stat().st_size, 3),
            "encode": t_enc,
            "decode": t_dec,
        }
        check_roundtrip(decode_png(jxl_dec_png), "jpegxl_lossless")

        # JPEG 2000 lossless
        jp2 = WORKDIR / f"{name}.jp2"
        def enc_jp2():
            if jp2.exists():
                jp2.unlink()
            # default is lossless when no -r / -q
            run(["opj_compress", "-i", str(pgm_path), "-o", str(jp2), "-n", "6"], check=False)
        # opj_compress returns 0; run() already checks
        try:
            t_enc = timed(enc_jp2)
            jp2_dec = WORKDIR / f"{name}.jp2.pgm"
            def dec_jp2():
                if jp2_dec.exists():
                    jp2_dec.unlink()
                run(["opj_decompress", "-i", str(jp2), "-o", str(jp2_dec)])
            t_dec = timed(dec_jp2)
            # read pgm16
            def read_pgm(path):
                data = path.read_bytes()
                # skip header
                parts = data.split(b"\n")
                # P5\n w h\n 65535\n raw
                # but comments possible
                raw = data
                if raw.startswith(b"P5"):
                    idx = 0
                    # parse manually
                    nl = []
                    i = 0
                    while len(nl) < 3:
                        j = raw.find(b"\n", i)
                        line = raw[i:j]
                        i = j + 1
                        if line.startswith(b"#"):
                            continue
                        nl.append(line)
                    wh = nl[1].split(); maxv = int(nl[2])
                    body = raw[i:]
                    arrp = np.frombuffer(body, dtype=">u2" if maxv > 255 else np.uint8)
                    w_, h_ = int(wh[0]), int(wh[1])
                    return arrp.reshape(h_, w_).astype(np.uint16)
                raise ValueError("not pgm")
            entry["codecs"]["jpeg2000_lossless"] = {
                "role": "lossless diagnostic candidate",
                "bytes": jp2.stat().st_size,
                "ratio_vs_raw": round(len(raw_bytes) / jp2.stat().st_size, 3),
                "encode": t_enc,
                "decode": t_dec,
            }
            check_roundtrip(read_pgm(jp2_dec), "jpeg2000_lossless")
        except Exception as e:
            entry["codecs"]["jpeg2000_lossless"] = {"error": str(e)[:400], "role": "lossless diagnostic candidate"}

        # raw + zstd -3 and -19
        for zlev in (3, 19):
            zpath = WORKDIR / f"{name}.raw.zstd{zlev}"
            def enc_z(path=zpath, lev=zlev):
                if path.exists():
                    path.unlink()
                run(["zstd", f"-{lev}", "-f", "-q", "-o", str(path), str(raw_path)])
            t_enc = timed(enc_z)
            zdec = WORKDIR / f"{name}.raw.unzstd{zlev}"
            def dec_z(path=zpath, dest=zdec):
                if dest.exists():
                    dest.unlink()
                run(["zstd", "-d", "-f", "-q", "-o", str(dest), str(path)])
            t_dec = timed(dec_z)
            key = f"raw_zstd_{zlev}"
            entry["codecs"][key] = {
                "role": "lossless diagnostic candidate (raw pixels + zstd, not a viewing format)",
                "bytes": zpath.stat().st_size,
                "ratio_vs_raw": round(len(raw_bytes) / zpath.stat().st_size, 3),
                "encode": t_enc,
                "decode": t_dec,
            }
            ok = zdec.read_bytes() == raw_bytes
            entry["codecs"][key]["roundtrip"] = "ok" if ok else "mismatch"

        # Lossy thumbnails ONLY (not for diagnostic originals)
        jpg = WORKDIR / f"{name}.q70.jpg"
        def enc_jpg():
            im = Image.fromarray((arr / 16).clip(0, 255).astype(np.uint8), mode="L")
            im.save(jpg, format="JPEG", quality=70, optimize=True)
        t_enc = timed(enc_jpg)
        t_dec = timed(lambda: Image.open(jpg).load() or Image.open(jpg))
        entry["codecs"]["jpeg_q70_thumb_only"] = {
            "role": "LOSSY thumbnail/preview ONLY — never a diagnostic original",
            "bytes": jpg.stat().st_size,
            "ratio_vs_raw": round(len(raw_bytes) / jpg.stat().st_size, 3),
            "encode": t_enc,
            "decode": t_dec,
            "roundtrip": "lossy_by_design",
        }
        jxl_lossy = WORKDIR / f"{name}.d1.jxl"
        def enc_jxl_d1():
            if jxl_lossy.exists():
                jxl_lossy.unlink()
            run(["cjxl", str(png_path), str(jxl_lossy), "-d", "1.0", "--quiet"])
        t_enc = timed(enc_jxl_d1)
        jxl_lossy_png = WORKDIR / f"{name}.d1.png"
        def dec_jxl_d1():
            if jxl_lossy_png.exists():
                jxl_lossy_png.unlink()
            run(["djxl", str(jxl_lossy), str(jxl_lossy_png), "--quiet"])
        t_dec = timed(dec_jxl_d1)
        entry["codecs"]["jpegxl_distance1_thumb_only"] = {
            "role": "LOSSY preview candidate ONLY — never a diagnostic original",
            "bytes": jxl_lossy.stat().st_size,
            "ratio_vs_raw": round(len(raw_bytes) / jxl_lossy.stat().st_size, 3),
            "encode": t_enc,
            "decode": t_dec,
            "roundtrip": "lossy_by_design",
        }

        # Envelope encrypt the recommended lossless bitstream (jxl if present else png)
        if has_cryptography():
            payload = jxl.read_bytes() if jxl.exists() else dst.read_bytes()
            blob, sha = envelope_encrypt(payload, tenant_id, file_id, master)
            t_enc = timed(lambda: envelope_encrypt(payload, tenant_id, file_id, master))
            t_dec = timed(lambda: envelope_decrypt(blob, tenant_id, file_id, sha, master))
            # integrity: flip a bit
            tampered = bytearray(blob)
            tampered[-1] ^= 0x01
            tamper_ok = False
            try:
                envelope_decrypt(bytes(tampered), tenant_id, file_id, sha, master)
            except Exception:
                tamper_ok = True
            mb = len(payload) / (1024 * 1024)
            entry["envelope_aes256gcm"] = {
                "order": "compress-then-encrypt",
                "payload_codec": "jpegxl_lossless" if jxl.exists() else "png",
                "payload_bytes": len(payload),
                "envelope_bytes": len(blob),
                "overhead_bytes": len(blob) - len(payload),
                "encrypt": t_enc,
                "decrypt": t_dec,
                "encrypt_mib_s_p50": round(mb / t_enc["seconds_p50"], 1) if t_enc["seconds_p50"] else None,
                "decrypt_mib_s_p50": round(mb / t_dec["seconds_p50"], 1) if t_dec["seconds_p50"] else None,
                "tamper_detected": tamper_ok,
                "sha256_payload": sha,
            }
            # save one envelope for the HTTP upload bench
            (OUT / f"{name}.jxl").write_bytes(payload) if jxl.exists() else None
            (OUT / f"{name}.png").write_bytes(dst.read_bytes())
            (OUT / f"{name}.envelope.bin").write_bytes(blob)

        results["images"][name] = entry
        print(name, {k: v.get("bytes") if isinstance(v, dict) else v for k, v in entry["codecs"].items()})

    outp = OUT / "imaging.json"
    outp.write_text(json.dumps(results, indent=2))
    print("wrote", outp)
    return 0


if __name__ == "__main__":
    # cryptography may need a venv
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM  # noqa
    except ImportError:
        venv = Path(__file__).resolve().parent / ".venv"
        if not (venv / "bin/python").exists():
            subprocess.check_call([sys.executable, "-m", "venv", str(venv)])
            subprocess.check_call([str(venv / "bin/pip"), "install", "-q", "cryptography", "numpy", "pillow"])
        os.execv(str(venv / "bin/python"), [str(venv / "bin/python"), str(Path(__file__).resolve()), *sys.argv[1:]])
    sys.exit(main())
