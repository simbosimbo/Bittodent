/* Bitto odontogram — 3D view renderer (framework-free reference for the React port).
 * Same data as the 2D five-surface chart: one record per tooth drives both views.
 *
 *   record = { tooth: 16, state: "empty|draft|signed", baseline: "missing"?,
 *              layers: [ { condition: "tambalan", surfaces: ["O","M"], status: "sudah_ada_sini" },
 *                        { condition: "mahkota", status: "direncanakan" } ] }   // no surfaces = whole tooth
 *
 * Output attributes mirror the 2D chart: data-tooth / data-state / data-condition / data-status on
 * the .t3 group (whole-tooth condition), data-surface + data-condition + data-status on each layer.
 * Colours never live here: CSS variables come from legend.json (legend-vars.css, generated).
 */
(function (global) {
  const FRAMES = ["M", "D", "O", "B", "L", "crown", "root"];
  const WHOLE_PRECEDENCE = ["hilang", "implan", "sisa_akar", "mahkota", "perlu_dicabut"];
  // FDI position -> [model suffix, uniform scale vs model]
  const POS = {
    1: ["incisor", 1.0], 2: ["incisor", 0.80], 3: ["canine", 1.0], 4: ["premolar1", 1.0],
    5: ["premolar", 1.0], 6: ["molar", 1.0], 7: ["molar", 0.92], 8: ["molar", 0.85],
  };
  const POS_LOWER = { 1: ["incisor", 0.96], 2: ["incisor", 1.05], 3: ["canine", 1.0], 4: ["premolar", 1.0],
    5: ["premolar", 1.0], 6: ["molar", 1.0], 7: ["molar", 0.95], 8: ["molar", 0.90] };
  const POS_PRIMARY = { 1: ["p-incisor", 1.0], 2: ["p-incisor", 0.82], 3: ["p-canine", 1.0], 4: ["p-molar", 0.80], 5: ["p-molar", 0.93] };
  const POS_PRIMARY_LOWER = { 1: ["p-incisor", 0.95], 2: ["p-incisor", 1.05], 3: ["p-canine", 0.92], 4: ["p-molar", 0.82], 5: ["p-molar", 1.02] };

  function info(fdi) {
    const q = Math.floor(fdi / 10), p = fdi % 10;
    const upper = [1, 2, 5, 6].includes(q);
    const primary = q >= 5;
    const mirror = [2, 3, 6, 7].includes(q);           // patient-left quadrants sit on chart right
    let table = primary ? (upper ? POS_PRIMARY : POS_PRIMARY_LOWER) : (upper ? POS : POS_LOWER);
    let [kind, scale] = table[p];
    if (kind === "premolar1" && !upper) kind = "premolar";
    const model = `${kind}-${upper ? "upper" : "lower"}`;
    return { q, p, upper, primary, mirror, model, scale };
  }

  function wholeOf(layers) {
    for (const k of WHOLE_PRECEDENCE) {
      const l = layers.find((x) => x.condition === k && !(x.surfaces && x.surfaces.length));
      if (l) return l;
    }
    return null;
  }

  const SVGNS = "http://www.w3.org/2000/svg";
  function el(tag, attrs, parent) {
    const e = tag.startsWith("svg:") ? document.createElementNS(SVGNS, tag.slice(4)) : document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v !== undefined && v !== null) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  }

  // ---- glyphs (fixed shapes; colour = currentColor from CSS vars) ----
  function glyph(g, key, x, y, r) {
    const G = el("svg:g", { class: `g g-${key}`, transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` }, g);
    switch (key) {
      case "karies":
        el("svg:circle", { r, class: "halo-fill" }, G);
        for (const [dx, dy] of [[-0.38, -0.2], [0.36, -0.28], [0, 0.36]]) el("svg:circle", { cx: dx * r, cy: dy * r, r: r * 0.24, class: "ink-fill" }, G);
        el("svg:circle", { r, class: "ink-stroke" }, G);
        break;
      case "tambalan":
        el("svg:rect", { x: -r * 0.8, y: -r * 0.8, width: r * 1.6, height: r * 1.6, rx: r * 0.3, class: "ink-fill halo-stroke" }, G);
        break;
      case "sehat":
        el("svg:circle", { r, class: "halo-fill" }, G);
        el("svg:path", { d: `M${-r * 0.5} 0 L${-r * 0.12} ${r * 0.4} L${r * 0.55} ${-r * 0.45}`, class: "ink-stroke thick" }, G);
        break;
      case "implan":
        el("svg:rect", { x: -r * 0.55, y: -r, width: r * 1.1, height: r * 2, rx: r * 0.25, class: "halo-fill ink-stroke" }, G);
        for (const t of [-0.5, 0, 0.5]) el("svg:path", { d: `M${-r * 0.75} ${t * r} L${r * 0.75} ${t * r + r * 0.18}`, class: "ink-stroke" }, G);
        break;
      case "sisa_akar":
        el("svg:circle", { r, class: "halo-fill" }, G);
        el("svg:path", { d: `M${-r * 0.55} ${-r * 0.45} L0 ${r * 0.55} L${r * 0.55} ${-r * 0.45}`, class: "ink-stroke thick" }, G);
        break;
      case "perlu_dicabut":
        el("svg:circle", { r, class: "halo-fill" }, G);
        el("svg:path", { d: `M0 ${-r * 0.6} L0 ${r * 0.45} M${-r * 0.4} ${r * 0.05} L0 ${r * 0.5} L${r * 0.4} ${r * 0.05}`, class: "ink-stroke thick" }, G);
        break;
      case "mahkota":
        el("svg:circle", { r, class: "halo-fill" }, G);
        el("svg:circle", { r: r * 0.55, class: "ink-stroke thick" }, G);
        break;
      case "hilang":
        el("svg:path", { d: `M${-r} ${-r} L${r} ${r} M${r} ${-r} L${-r} ${r}`, class: "halo-stroke xl" }, G);
        el("svg:path", { d: `M${-r} ${-r} L${r} ${r} M${r} ${-r} L${-r} ${r}`, class: "ink-stroke thick" }, G);
        break;
    }
    return G;
  }

  function statusMarker(g, key, x, y, s) {
    const G = el("svg:g", { class: `sm sm-${key}`, "data-status": key, transform: `translate(${x} ${y})` }, g);
    const h = s / 2;
    switch (key) {
      case "kondisi": el("svg:circle", { r: h * 0.8, class: "ink-fill halo-stroke" }, G); break;
      case "sudah_ada_sini": el("svg:rect", { x: -h * 0.8, y: -h * 0.8, width: h * 1.6, height: h * 1.6, class: "ink-fill halo-stroke" }, G); break;
      case "sudah_ada_lain": el("svg:rect", { x: -h * 0.75, y: -h * 0.75, width: h * 1.5, height: h * 1.5, class: "halo-fill ink-stroke thick" }, G); break;
      case "direncanakan": el("svg:path", { d: `M0 ${-h} L${h} ${h * 0.8} L${-h} ${h * 0.8}Z`, class: "ink-fill halo-stroke" }, G); break;
      case "selesai": el("svg:circle", { r: h, class: "halo-fill" }, G); el("svg:path", { d: `M${-h * 0.5} 0 L${-h * 0.1} ${h * 0.45} L${h * 0.55} ${-h * 0.45}`, class: "ink-stroke thick" }, G); break;
      case "dirujuk": el("svg:path", { d: `M${-h} 0 L${h * 0.6} 0 M${h * 0.05} ${-h * 0.6} L${h * 0.7} 0 L${h * 0.05} ${h * 0.6}`, class: "ink-stroke thick" }, G); break;
    }
    return G;
  }

  /* Build one view (buccal | occlusal) of one tooth.
   *  K = display px per @160 px. Returns a column element sized to the crown width so neighbours nearly touch. */
  function view(record, viewName, M, K, base) {
    const fdi = record.tooth;
    const I = info(fdi);
    const m = M.models[I.model];
    const layers = record.layers || [];
    const whole = wholeOf(layers);
    const v = m[viewName];
    const s = I.scale;
    const boxW = m.w * s * K, boxH = v.h * s * K;
    const rowH = v.h * K;
    const colW = m.crownWidthPx * s * K;
    const top = viewName === "buccal" ? v.cejY * rowH * (1 - s) : (rowH - boxH) / 2;
    const left = (colW - boxW) / 2;

    const cell = el("div", {
      class: "t3", "data-tooth": fdi, "data-view": viewName, "data-model": I.model,
      "data-state": record.state || "empty", "data-baseline": record.baseline,
      "data-condition": whole ? whole.condition : null, "data-status": whole ? whole.status : null,
      "data-arch": I.upper ? "upper" : "lower", "data-dentition": I.primary ? "primary" : "permanent",
      id: `t${fdi}-${viewName}`, role: "img",          // read-only view: edits happen in the 2D chart
      "aria-label": `Gigi ${fdi}`,
    });
    cell.style.width = colW + "px"; cell.style.height = rowH + "px";
    const box = el("div", { class: "t3-box" }, cell);
    Object.assign(box.style, { left: left + "px", top: top + "px", width: boxW + "px", height: boxH + "px" });
    if (I.mirror) box.style.transform = "scaleX(-1)";
    const img = el("div", { class: "t3-img" }, box);
    const src = (o) => o ? `url("${base}${o["320"]}")` : "none";
    img.style.setProperty("--img", src(v.img));
    if (m.roots) img.style.setProperty("--img-roots", src(m.roots[viewName]));
    if (viewName === "buccal") {
      img.style.setProperty("--img-ghost", src(m.ghost));
      img.style.setProperty("--img-implant", m.implant ? src(m.implant) : src(v.img));
    } else {
      img.style.setProperty("--img-ghost", src(v.img));
      img.style.setProperty("--img-implant", src(v.img));
    }
    const maskUrl = `url("${base}${v.mask}")`;
    const addLayer = (L, frame) => {
      const d = el("div", { class: "t3-layer", "data-condition": L.condition, "data-status": L.status || "kondisi",
        "data-surface": frame === "crown" ? null : frame }, box);
      d.style.setProperty("--mask", maskUrl);
      d.style.setProperty("--i", FRAMES.indexOf(frame));
      return d;
    };
    // layers: surface conditions + crown tint, in data order (later = on top)
    for (const L of layers) {
      if (L.surfaces && L.surfaces.length) {
        for (const sf of L.surfaces) {
          const fr = sf === "I" ? "O" : sf;
          if (v.anchors[fr]) addLayer(L, fr);
        }
      } else if (L.condition === "mahkota") addLayer(L, "crown");
    }

    // glyph overlay (not mirrored: glyphs stay readable; anchors mirrored in x)
    const svg = el("svg:svg", { class: "t3-glyphs", width: colW, height: rowH, viewBox: `0 0 ${colW.toFixed(1)} ${rowH.toFixed(1)}`, "aria-hidden": "true" }, cell);
    const ax = (fr) => { const a = v.anchors[fr]; if (!a) return null; const x = I.mirror ? 1 - a[0] : a[0]; return [left + x * boxW, top + a[1] * boxH]; };
    const bb = v.bbox && v.bbox.crown;
    const crownRect = bb ? (() => { let x0 = I.mirror ? 1 - bb[2] : bb[0], x1 = I.mirror ? 1 - bb[0] : bb[2];
      return [left + x0 * boxW, top + bb[1] * boxH, (x1 - x0) * boxW, (bb[3] - bb[1]) * boxH]; })() : null;
    const r = Math.max(6, Math.min(10, colW * 0.13));
    const gl = el("svg:g", {}, svg);
    // missing slot outline
    if ((whole && whole.condition === "hilang") || record.baseline === "missing") {
      const R = crownRect || [4, 4, colW - 8, rowH - 8];
      el("svg:rect", { class: "slot", x: R[0] + 1, y: R[1] + 1, width: R[2] - 2, height: R[3] - 2, rx: Math.min(R[2], R[3]) * 0.3 }, gl);
    }
    const used = new Set();
    for (const L of layers) {
      if (L.surfaces && L.surfaces.length) {
        for (const sf of L.surfaces) {
          const fr = sf === "I" ? "O" : sf; const p = ax(fr);
          if (!p || used.has(fr + L.condition)) continue; used.add(fr + L.condition);
          const g = glyph(gl, L.condition, p[0], p[1], r * 0.8);
          g.setAttribute("data-condition", L.condition); g.setAttribute("data-status", L.status || "kondisi");
        }
      } else {
        const g = el("svg:g", { class: "whole", "data-condition": L.condition, "data-status": L.status || "kondisi" }, gl);
        const cx = colW / 2;
        if (L.condition === "mahkota" && crownRect) {
          el("svg:rect", { class: "cap", x: crownRect[0] - 1, y: crownRect[1] - 1, width: crownRect[2] + 2, height: crownRect[3] + 2, rx: crownRect[3] * 0.35 }, g);
          glyph(g, "mahkota", cx, I.upper ? crownRect[1] + crownRect[3] + r * 0.2 : crownRect[1] - r * 0.2, r * 0.75);
        } else if (L.condition === "hilang") {
          glyph(g, "hilang", cx, crownRect ? crownRect[1] + crownRect[3] / 2 : rowH / 2, r);
        } else if (L.condition === "perlu_dicabut") {
          el("svg:path", { class: "slash halo-stroke xl", d: `M${colW * 0.12} ${rowH * 0.88} L${colW * 0.88} ${rowH * 0.12}` }, g);
          el("svg:path", { class: "slash ink-stroke thick", d: `M${colW * 0.12} ${rowH * 0.88} L${colW * 0.88} ${rowH * 0.12}` }, g);
          glyph(g, "perlu_dicabut", cx, rowH / 2, r * 0.8);
        } else if (viewName === "buccal" || L.condition !== "implan") {
          const y = crownRect ? (I.upper ? crownRect[1] - r * 1.4 : crownRect[1] + crownRect[3] + r * 1.4) : rowH / 2;
          glyph(g, L.condition, cx, y, r * 0.8);
        } else {
          glyph(g, "implan", cx, rowH / 2, r * 0.7);
        }
      }
    }
    // status markers (one per distinct status) in the corner away from the roots
    // status markers live on the buccal view only (the occlusal view sits right next to it)
    const statuses = viewName === "buccal" ? [...new Set(layers.map((l) => l.status).filter(Boolean))] : [];
    const my = viewName === "occlusal" ? 7 : (I.upper ? rowH - 8 : 8);
    statuses.forEach((st, i) => statusMarker(el("svg:g", { class: "status-layer" }, svg), st, colW - 7 - i * 12, my, 10));
    // state treatment
    const fr = el("svg:rect", { class: "state-frame", x: 1.5, y: 1.5, width: colW - 3, height: rowH - 3, rx: 8 }, svg);
    if (record.state === "draft") {
      el("svg:path", { class: "draft-mark", d: "M8 2 L14 8 L8 14 L2 8Z", transform: `translate(1 ${viewName === "occlusal" || !I.upper ? 1 : rowH - 17})` }, svg);
    } else if (record.state === "signed") {
      const g = el("svg:g", { class: "lock", transform: `translate(4 ${viewName === "occlusal" || !I.upper ? 3 : rowH - 17})` }, svg);
      el("svg:rect", { x: 0, y: 5, width: 11, height: 8, rx: 1.5 }, g);
      el("svg:path", { d: "M2.5 5 V3.5 a3 3 0 0 1 6 0 V5", fill: "none" }, g);
    }
    return cell;
  }

  function supernumerary(nextTo, viewName, M, K, base) {
    const c = view({ tooth: nextTo, state: "empty", layers: [] }, viewName, M, K * 0.5, base);
    c.classList.add("t3-super"); c.setAttribute("data-tooth", `S${nextTo}`); c.setAttribute("aria-label", `Gigi supernumerari dekat ${nextTo}`);
    return c;
  }

  global.Tooth3D = { view, info, supernumerary, FRAMES };
})(window);
