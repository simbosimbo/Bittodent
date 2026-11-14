#!/usr/bin/env python3
"""Validate legend.json against legend.schema.json and WCAG AA contrast.

Exit 0 if the document is valid and every checked colour meets its rule on
each declared background. Exit 1 otherwise.

Rules (stated on every line of the report):
  - 4.5:1  WCAG 1.4.3 AA text — text-ish glyph / ink colours
            (condition glyphs, status markers, draft & signed state ink, draft accent)
  - 3.0:1  WCAG 1.4.11 non-text graphics — large graphic fills that are not ink
            (not applied to draft wash; wash is a background, not a foreground)

Backgrounds: #FFFFFF (neutral-0 / enamel / surface) plus surface tokens from
design/tokens.json (neutral-25, shell A background). Draft ink is also checked
against the draft wash.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LEGEND = ROOT / "legend.json"
SCHEMA = ROOT / "legend.schema.json"
TOKENS = ROOT.parent / "tokens.json"

TEXTISH_MIN = 4.5  # WCAG 1.4.3 AA
NONTEXT_MIN = 3.0  # WCAG 1.4.11

HEX = re.compile(r"^#[0-9A-Fa-f]{6}$")


def _lin(c: float) -> float:
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def luminance(hex_color: str) -> float:
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return 0.2126 * _lin(r) + 0.7152 * _lin(g) + 0.0722 * _lin(b)


def contrast_ratio(fg: str, bg: str) -> float:
    a, b = luminance(fg), luminance(bg)
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)


# ----- minimal JSON Schema (draft 2020-12 subset used by legend.schema.json) -----

def validate(instance, schema, path="$"):
    errors = []
    typ = schema.get("type")
    if typ == "object":
        if not isinstance(instance, dict):
            return [f"{path}: expected object, got {type(instance).__name__}"]
        for key in schema.get("required", []):
            if key not in instance:
                errors.append(f"{path}: missing required property '{key}'")
        props = schema.get("properties", {})
        for key, val in instance.items():
            if key in props:
                errors.extend(validate(val, props[key], f"{path}.{key}"))
    elif typ == "array":
        if not isinstance(instance, list):
            return [f"{path}: expected array, got {type(instance).__name__}"]
        if "minItems" in schema and len(instance) < schema["minItems"]:
            errors.append(f"{path}: expected at least {schema['minItems']} items")
        item_schema = schema.get("items")
        if isinstance(item_schema, dict):
            for i, item in enumerate(instance):
                errors.extend(validate(item, item_schema, f"{path}[{i}]"))
    elif typ == "string":
        if not isinstance(instance, str):
            return [f"{path}: expected string, got {type(instance).__name__}"]
        if "minLength" in schema and len(instance) < schema["minLength"]:
            errors.append(f"{path}: shorter than minLength {schema['minLength']}")
        if "pattern" in schema and not re.search(schema["pattern"], instance):
            errors.append(f"{path}: {instance!r} does not match {schema['pattern']}")
    elif typ == "boolean":
        if not isinstance(instance, bool):
            errors.append(f"{path}: expected boolean")
    elif typ == "number":
        if not isinstance(instance, (int, float)) or isinstance(instance, bool):
            errors.append(f"{path}: expected number")
    if "enum" in schema and instance not in schema["enum"]:
        errors.append(f"{path}: {instance!r} not in {schema['enum']}")
    return errors


def token_colors(tokens: dict) -> dict[str, str]:
    found: dict[str, str] = {}

    def walk(obj, parts):
        if not isinstance(obj, dict):
            if isinstance(obj, str) and obj.startswith("#") and len(obj) == 7:
                found["-".join(parts)] = obj.upper()
            return
        for k, v in obj.items():
            if k.startswith("$"):
                continue
            walk(v, parts + [k])

    walk(tokens, [])
    return found


def unique_backgrounds(tokens: dict) -> list[tuple[str, str]]:
    colors = token_colors(tokens) if tokens else {}
    # Declared light surfaces: white / enamel / shell surface, plus nearby page tones.
    wanted = [
        ("#FFFFFF", "color-neutral-0 / color-chart-enamel / shells-a-color-surface"),
        (colors.get("color-neutral-25", "#F8FAFB"), "color-neutral-25"),
        (colors.get("shells-a-color-bg", "#EEF3F4"), "shells-a-color-bg"),
    ]
    seen: set[str] = set()
    out = []
    for hex_c, label in wanted:
        key = hex_c.upper()
        if key in seen:
            # merge labels if same hex appears twice
            for i, (h, lab) in enumerate(out):
                if h.upper() == key:
                    out[i] = (h, f"{lab}; {label}")
                    break
            continue
        seen.add(key)
        out.append((hex_c.upper() if hex_c.startswith("#") else hex_c, label))
    return out


def main() -> int:
    if not LEGEND.is_file():
        print(f"FAIL: {LEGEND} not found", file=sys.stderr)
        return 1
    if not SCHEMA.is_file():
        print(f"FAIL: {SCHEMA} not found", file=sys.stderr)
        return 1
    legend = json.loads(LEGEND.read_text())
    schema = json.loads(SCHEMA.read_text())
    tokens = json.loads(TOKENS.read_text()) if TOKENS.is_file() else {}

    schema_errors = validate(legend, schema)
    glyph_errors = []
    for i, cond in enumerate(legend.get("conditions") or []):
        path = f"$.conditions[{i}]"
        key = cond.get("key", f"#{i}")
        glyph = (cond.get("glyph") or "").strip()
        mark = (cond.get("mark") or "").strip()
        if not glyph:
            glyph_errors.append(f"{path} ({key}): missing glyph")
        elif not (ROOT / glyph).is_file():
            glyph_errors.append(f"{path} ({key}): glyph file missing: {glyph}")
        if not mark:
            glyph_errors.append(f"{path} ({key}): missing shape (mark)")

    backgrounds = unique_backgrounds(tokens)
    version = legend.get("version", "(no version)")
    print(f"legend.json v{version}")
    print(f"schema: {SCHEMA.name}")
    print("backgrounds:")
    for hex_c, label in backgrounds:
        print(f"  {hex_c}  ({label})")
    print()

    # (label, color, min, rule name, extra backgrounds)
    checks: list[tuple[str, str, float, str, list[tuple[str, str]]]] = []
    text_rule = "WCAG 1.4.3 AA text 4.5:1 (text-ish glyph/ink)"
    graphic_rule = "WCAG 1.4.11 non-text graphics 3.0:1"

    for cond in legend.get("conditions") or []:
        checks.append((f"condition {cond.get('key')}", cond.get("color", ""), TEXTISH_MIN, text_rule, []))
    for item in (legend.get("statuses") or {}).get("items") or []:
        checks.append((f"status {item.get('key')}", item.get("color", ""), TEXTISH_MIN, text_rule, []))

    states = legend.get("states") or {}
    draft = states.get("draft") or {}
    signed = states.get("signed") or {}
    wash = draft.get("wash")
    extra_wash = [(wash, "states.draft.wash")] if wash and HEX.match(wash) else []
    if draft.get("color"):
        checks.append(("state draft color", draft["color"], TEXTISH_MIN, text_rule, extra_wash))
    if draft.get("accent"):
        checks.append(("state draft accent", draft["accent"], TEXTISH_MIN, text_rule, extra_wash))
    if signed.get("color"):
        checks.append(("state signed color", signed["color"], TEXTISH_MIN, text_rule, []))
    # draft wash is a background, not a foreground — do not require contrast vs white.

    failed = 0
    lines = []
    for label, color, minimum, rule, extra_bgs in checks:
        if not color or not HEX.match(color):
            lines.append(f"FAIL  {label}: missing or invalid color {color!r}  [{rule}]")
            failed += 1
            continue
        for bg, bg_label in backgrounds + extra_bgs:
            ratio = contrast_ratio(color, bg)
            ok = ratio + 1e-9 >= minimum
            status = "OK" if ok else "FAIL"
            if not ok:
                failed += 1
            lines.append(
                f"{status:4}  {label} {color} vs {bg} ({bg_label}) = {ratio:.2f}:1  "
                f"need ≥ {minimum:.1f}:1  [{rule}]"
            )

    print("\n".join(lines))
    print()
    if schema_errors:
        print("schema errors:")
        for e in schema_errors:
            print(f"  {e}")
    if glyph_errors:
        print("glyph/shape errors:")
        for e in glyph_errors:
            print(f"  {e}")

    n_checks = len(lines)
    if schema_errors or glyph_errors or failed:
        print(
            f"check_legend: FAIL  ({failed} contrast failure(s), "
            f"{len(schema_errors)} schema, {len(glyph_errors)} glyph/shape; {n_checks} contrast rows)"
        )
        return 1
    print(f"check_legend: PASS  ({n_checks} contrast rows, schema OK, every condition has color + glyph/shape)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
