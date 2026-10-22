#!/usr/bin/env node
/* Generates assets/banner.svg, the animated README banner (designed in designs/website.pen,
   frame "README Banner (1280x460)"). GitHub renders README SVGs inside <img>, so no web fonts and
   no scripts: text is outlined with Poppins and Roboto Mono (one <path> per glyph in <defs>, placed
   with <use>), and the motion is CSS keyframes inside the SVG, the same approach as
   fonoster/fonoster's assets/banner.svg.

   Usage: node .scripts/readme-banner.js <fonts dir> [out file]
   The fonts dir needs Poppins-SemiBold.ttf, Poppins-Regular.ttf and RobotoMono[wght].ttf
   (OFL, from github.com/google/fonts). opentype.js must be resolvable (npm i opentype.js), or set
   OPENTYPE_PATH to its folder. */
const fs = require("fs");
const path = require("path");
const opentype = require(process.env.OPENTYPE_PATH || "opentype.js");

const fontsDir = process.argv[2];
const out = process.argv[3] || path.join(__dirname, "..", "assets", "banner.svg");
if (!fontsDir) {
  console.error("usage: readme-banner.js <fonts dir> [out file]");
  process.exit(1);
}
const F = {
  semi: ["s", opentype.loadSync(path.join(fontsDir, "Poppins-SemiBold.ttf"))],
  reg: ["r", opentype.loadSync(path.join(fontsDir, "Poppins-Regular.ttf"))],
  mono: ["m", opentype.loadSync(path.join(fontsDir, "RobotoMono[wght].ttf"))]
};

const W = 1280, H = 460;
const C = {
  bg: "#181818", surface: "#202020", border: "#333333", t1: "#FFFFFF", t3: "#C2C2C2", t4: "#8D8D8D",
  ln: "#555555", accent: "#5FCFCE", subtle: "#0B3D3D", ok: "#39E19E"
};
const r1 = (n) => Math.round(n * 10) / 10;

/* ---------- Text as glyph <use>s. Arrows (→ ←) are drawn, the fonts have no glyph for them. ---------- */
const glyphDefs = new Map(); // id -> path data (font units, y up flipped by getPath)
const text = (font, str, x, y, size, opts = {}) => {
  const [tag, f] = font;
  const scale = size / f.unitsPerEm;
  const ls = (opts.ls || 0) * size;
  const uses = [];
  let cx = x;
  const glyphs = f.stringToGlyphs(str);
  for (let i = 0; i < glyphs.length; i++) {
    const g = glyphs[i];
    const ch = str[i];
    if (ch === "→" || ch === "←") {
      const w = size * 0.6;
      const yy = y - size * 0.3, x0 = cx + 1, x1 = cx + w - 1;
      const d = ch === "→"
        ? `M${r1(x0)} ${r1(yy)}H${r1(x1)}M${r1(x1 - 3)} ${r1(yy - 3)}L${r1(x1)} ${r1(yy)}L${r1(x1 - 3)} ${r1(yy + 3)}`
        : `M${r1(x1)} ${r1(yy)}H${r1(x0)}M${r1(x0 + 3)} ${r1(yy - 3)}L${r1(x0)} ${r1(yy)}L${r1(x0 + 3)} ${r1(yy + 3)}`;
      uses.push(`<path d="${d}" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`);
      cx += w + ls;
      continue;
    }
    if (g.index !== 0 && ch !== " ") {
      const id = `${tag}${g.index}`;
      if (!glyphDefs.has(id)) glyphDefs.set(id, g.getPath(0, 0, f.unitsPerEm).toPathData(1));
      uses.push(`<use href="#${id}" transform="translate(${r1(cx)} ${r1(y)}) scale(${scale.toFixed(5)})"/>`);
    }
    let adv = g.advanceWidth * scale;
    if (i < glyphs.length - 1) adv += f.getKerningValue(g, glyphs[i + 1]) * scale;
    cx += adv + ls;
  }
  return { svg: uses.join(""), w: cx - x };
};
const tp = (font, str, x, y, size, fill, opts = {}) => {
  const t = text(font, str, x, y, size, opts);
  return { svg: `<g fill="${fill}" color="${fill}">${t.svg}</g>`, w: t.w };
};

const body = [];
const push = (s) => body.push(s);

/* ---------- Card, dot grid, light sweep (same construction as fonoster's banner) ---------- */
push(`<g clip-path="url(#card)">
<rect width="${W}" height="${H}" fill="${C.bg}"/>
<g mask="url(#atmos)"><rect width="${W}" height="${H}" fill="url(#dots)"/><rect width="${W}" height="${H}" fill="url(#dots-hi)" mask="url(#band)"/></g>
</g>`);

/* ---------- Logo (wordmark paths, 106x28 scaled to 124x32) ---------- */
const LOGO = [
  "M6.58346 9.30769C7.35345 8.1282 8.31594 7.20513 9.47094 6.53846C10.6259 5.84615 11.9093 5.5 13.3209 5.5V12.4615H11.5114C9.86877 12.4615 8.63678 12.8205 7.81545 13.5385C6.99412 14.2308 6.58346 15.4615 6.58346 17.2308V27.1923H0V5.73077H6.58346V9.30769Z",
  "M26.2466 27.5C24.1419 27.5 22.2426 27.0513 20.5486 26.1538C18.8803 25.2564 17.5585 23.9744 16.5832 22.3077C15.6335 20.641 15.1587 18.6923 15.1587 16.4615C15.1587 14.2564 15.6463 12.3205 16.6217 10.6538C17.597 8.96154 18.9316 7.66667 20.6256 6.76923C22.3196 5.87179 24.2189 5.42308 26.3236 5.42308C28.4282 5.42308 30.3276 5.87179 32.0216 6.76923C33.7155 7.66667 35.0502 8.96154 36.0255 10.6538C37.0009 12.3205 37.4885 14.2564 37.4885 16.4615C37.4885 18.6667 36.988 20.6154 35.987 22.3077C35.0117 23.9744 33.6642 25.2564 31.9446 26.1538C30.2506 27.0513 28.3512 27.5 26.2466 27.5ZM26.2466 21.8077C27.5043 21.8077 28.5694 21.3462 29.4421 20.4231C30.3404 19.5 30.7896 18.1795 30.7896 16.4615C30.7896 14.7436 30.3532 13.4231 29.4806 12.5C28.6336 11.5769 27.5813 11.1154 26.3236 11.1154C25.0403 11.1154 23.9751 11.5769 23.1281 12.5C22.2811 13.3974 21.8576 14.7179 21.8576 16.4615C21.8576 18.1795 22.2683 19.5 23.0896 20.4231C23.9366 21.3462 24.9889 21.8077 26.2466 21.8077Z",
  "M62.1945 5.73077V27.1923H55.6111V24.2692C54.9437 25.218 54.0326 25.9872 52.8776 26.5769C51.7483 27.141 50.4906 27.4231 49.1046 27.4231C47.462 27.4231 46.0118 27.0641 44.7541 26.3462C43.4965 25.6026 42.5212 24.5385 41.8282 23.1538C41.1352 21.7692 40.7887 20.141 40.7887 18.2692V5.73077H47.3336V17.3846C47.3336 18.8205 47.7058 19.9359 48.4501 20.7308C49.1944 21.5256 50.1954 21.9231 51.4531 21.9231C52.7364 21.9231 53.7502 21.5256 54.4946 20.7308C55.2389 19.9359 55.6111 18.8205 55.6111 17.3846V5.73077H62.1945Z",
  "M78.8968 21.6154V27.1923H75.5473C73.1603 27.1923 71.2995 26.6154 69.9649 25.4615C68.6302 24.2821 67.9629 22.3718 67.9629 19.7308V11.1923H65.3449V5.73077H67.9629V0.5H74.5463V5.73077H78.8583V11.1923H74.5463V19.8077C74.5463 20.4487 74.7003 20.9103 75.0083 21.1923C75.3163 21.4744 75.8296 21.6154 76.5483 21.6154H78.8968Z",
  "M89.1473 9.30769C89.9173 8.1282 90.8798 7.20513 92.0348 6.53846C93.1898 5.84615 94.4731 5.5 95.8848 5.5V12.4615H94.0753C92.4327 12.4615 91.2007 12.8205 90.3793 13.5385C89.558 14.2308 89.1473 15.4615 89.1473 17.2308V27.1923H82.5639V5.73077H89.1473V9.30769Z"
];
const DOT = "M102.112 27.5C100.957 27.5 100.007 27.1667 99.2626 26.5C98.5439 25.8077 98.1846 24.9615 98.1846 23.9615C98.1846 22.9359 98.5439 22.0769 99.2626 21.3846C100.007 20.6923 100.957 20.3462 102.112 20.3462C103.241 20.3462 104.165 20.6923 104.884 21.3846C105.628 22.0769 106 22.9359 106 23.9615C106 24.9615 105.628 25.8077 104.884 26.5C104.165 27.1667 103.241 27.5 102.112 27.5Z";
push(`<g transform="translate(64 64) scale(1.1698)">${LOGO.map((d) => `<path fill="${C.t1}" fill-rule="evenodd" d="${d}"/>`).join("")}<path fill="${C.accent}" d="${DOT}"/></g>`);

/* ---------- Copy ---------- */
push(tp(F.semi, "The SIP server", 64, 170, 58, C.t1, { ls: -0.034 }).svg);
push(tp(F.semi, "built for the cloud.", 64, 230, 58, C.t1, { ls: -0.034 }).svg);
push(tp(F.reg, "A lightweight SIP proxy, location server, and registrar.", 64, 284, 19, C.t3).svg);
push(tp(F.reg, "The signaling engine behind Fonoster.", 64, 312, 19, C.t3).svg);
push(tp(F.mono, "routr.io", 64, 355, 16, C.t4).svg);

/* ---------- Trace window ---------- */
const WX = 676, WY = 80, WW = 544, WH = 300;
push(`<rect x="${WX}" y="${WY}" width="${WW}" height="${WH}" rx="14" fill="${C.bg}" stroke="${C.border}" filter="url(#shadow)"/>`);
push(`<line x1="${WX}" y1="${WY + 44.5}" x2="${WX + WW}" y2="${WY + 44.5}" stroke="${C.border}"/>`);
[["#F97066", 0], ["#F5A524", 1], ["#39E19E", 2]].forEach(([c, i]) =>
  push(`<circle cx="${WX + 23 + i * 18}" cy="${WY + 22}" r="4.5" fill="${c}" fill-opacity="0.6"/>`)
);
push(tp(F.mono, "sip trace  ·  INVITE from 1001@sip.local", WX + 88, WY + 26.5, 12, C.t4).svg);

// Path chips. Each has an "on" overlay (teal) that the animation fades in.
const chips = ["Softphone", "EdgePort", "Dispatcher", "Connect", "Trunk"];
const chipW = chips.map((c) => Math.round(text(F.mono, c, 0, 0, 12).w) + 22);
const chipGap = (WW - 56 - chipW.reduce((a, b) => a + b, 0)) / (chips.length - 1);
let cx = WX + 28;
chips.forEach((label, i) => {
  const w = chipW[i], y = WY + 68, h = 30;
  const t = text(F.mono, label, cx + 11, y + 19.5, 12).svg;
  push(`<g class="chip c${i}">
<rect x="${r1(cx)}" y="${y}" width="${w}" height="${h}" rx="8" fill="${C.surface}" stroke="${C.border}"/>
<g fill="${C.t1}">${t}</g>
<g class="on"><rect x="${r1(cx)}" y="${y}" width="${w}" height="${h}" rx="8" fill="${C.subtle}" stroke="${C.accent}"/><g fill="${C.accent}">${t}</g></g>
</g>`);
  if (i < chips.length - 1) {
    const lx = cx + w, ly = y + h / 2;
    push(`<g class="link k${i}"><line x1="${r1(lx)}" y1="${ly}" x2="${r1(lx + chipGap)}" y2="${ly}" stroke="#fff" stroke-opacity="0.15" stroke-width="2"/><line class="on" x1="${r1(lx)}" y1="${ly}" x2="${r1(lx + chipGap)}" y2="${ly}" stroke="${C.accent}" stroke-width="2"/></g>`);
  }
  cx += w + chipGap;
});

// Log rows: [time, direction, head, rest, chip index lit when the row prints]
const rows = [
  ["00.004", "→", "INVITE", " sip:+19103434434@sip.local SIP/2.0", 1],
  ["00.006", "·", "edgeport-01", " → dispatcher  (gRPC)", 2],
  ["00.007", "·", "match", " req => true  → connect", 3],
  ["00.011", "·", "egress", " domain-01 › number-01 › trunk-01", 4],
  ["00.013", "←", "100 Trying", "", null],
  ["00.412", "←", "180 Ringing", "", null],
  ["04.120", "←", "200 OK", "   session established", null]
];
const rowY0 = WY + 136, rowH = 23, fsz = 12;
rows.forEach(([t, dir, head, rest], i) => {
  const y = rowY0 + i * rowH;
  const dirColor = dir === "→" ? C.accent : dir === "←" ? C.t4 : C.ln;
  const headColor = head === "200 OK" ? C.ok : C.t1;
  let x = WX + 28;
  const parts = [];
  const a = tp(F.mono, t, x, y, fsz, C.ln); parts.push(a.svg); x += a.w + 14;
  const b = tp(F.mono, dir, x, y, fsz, dirColor); parts.push(b.svg); x += 7.2 + 14;
  const h = tp(F.mono, head, x, y, fsz, headColor); parts.push(h.svg); x += h.w;
  if (rest) parts.push(tp(F.mono, rest, x, y, fsz, C.t3).svg);
  push(`<g class="row r${i}">${parts.join("")}</g>`);
});

/* ---------- Motion (CSS keyframes) ----------
   One cycle: 0.3s lead-in with the Softphone lit, 7 rows printing every 0.42s while the chip the
   message reaches lights up, then a 3.2s hold on 200 OK. prefers-reduced-motion shows the end state. */
const STEP = 0.42, LEAD = 0.3, HOLD = 3.2, T = LEAD + rows.length * STEP + HOLD;
const pct = (s) => ((s / T) * 100).toFixed(3);
let css = `
.sweep { transform: translateX(-200px); }
.row, .on { opacity: 0 } .c0 .on { opacity: 1 }
@media (prefers-reduced-motion: no-preference) {
.sweep { animation: sweep 8s cubic-bezier(.65,0,.35,1) .6s infinite; }
@keyframes sweep { 0% { transform: translateX(0) } 40%, 100% { transform: translateX(${W + 380}px) } }
`;
rows.forEach((_, i) => {
  const t0 = LEAD + i * STEP;
  css += `.r${i} { animation: r${i} ${T}s linear infinite; }
@keyframes r${i} { 0% { opacity: 0 } ${pct(t0)}% { opacity: 0 } ${pct(t0 + 0.2)}% { opacity: 1 } 100% { opacity: 1 } }
`;
});
// Chip k is lit from the time its row prints until the next chip's row prints (Trunk holds to the end).
const starts = [0, ...rows.map((r, i) => (r[4] !== null ? LEAD + i * STEP : null)).filter((v) => v !== null)];
starts.forEach((a, k) => {
  const last = k === starts.length - 1;
  const b = last ? T : starts[k + 1];
  const first = k === 0 ? 1 : 0;
  css += `.c${k} .on { animation: c${k} ${T}s linear infinite; }
@keyframes c${k} { 0% { opacity: ${first} } ${pct(a)}% { opacity: ${first} } ${pct(a + 0.15)}% { opacity: 1 } ${pct(b - 0.15)}% { opacity: 1 } ${last ? "" : `${pct(b)}% { opacity: 0 }`} 100% { opacity: ${last ? 1 : 0} } }
`;
  if (!last) {
    css += `.k${k} .on { animation: k${k} ${T}s linear infinite; }
@keyframes k${k} { 0% { opacity: 0 } ${pct(b)}% { opacity: 0 } ${pct(b + 0.15)}% { opacity: 1 } 100% { opacity: 1 } }
`;
  }
});
css += `}
@media (prefers-reduced-motion: reduce) { .row { opacity: 1 } .c3 .on, .k0 .on, .k1 .on, .k2 .on { opacity: 1 } .c0 .on { opacity: 0 } }
`;

const defs = `<defs>
<clipPath id="card"><rect width="${W}" height="${H}" rx="28"/></clipPath>
<pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="14" cy="14" r="1.35" fill="#fff" fill-opacity=".13"/></pattern>
<pattern id="dots-hi" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="14" cy="14" r="1.6" fill="#fff" fill-opacity=".6"/></pattern>
<radialGradient id="atmos-g" gradientUnits="userSpaceOnUse" cx="920" cy="193" r="832" gradientTransform="translate(920 193) scale(1 0.387) translate(-920 -193)"><stop offset="0" stop-color="#fff"/><stop offset=".72" stop-color="#fff" stop-opacity="0"/></radialGradient>
<mask id="atmos" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="url(#atmos-g)"/></mask>
<linearGradient id="band-g"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".32" stop-color="#fff" stop-opacity=".35"/><stop offset=".5" stop-color="#fff"/><stop offset=".68" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<mask id="band" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><g class="sweep"><rect x="-180" y="-40" width="180" height="540" fill="url(#band-g)" transform="skewX(-10)"/></g></mask>
<filter id="shadow" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#000" flood-opacity=".45"/></filter>
${Array.from(glyphDefs, ([id, d]) => `<path id="${id}" d="${d}"/>`).join("\n")}
</defs>`;

const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t d">
<title id="t">Routr: the SIP server built for the cloud.</title>
<desc id="d">A lightweight SIP proxy, location server, and registrar. The signaling engine behind Fonoster. A SIP trace shows an INVITE moving from a softphone through an EdgePort, the Dispatcher, and the Connect processor to a trunk, ending in 200 OK.</desc>
<style>${css}</style>
${defs}
${body.join("\n")}
</svg>
`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, doc);
console.log(`wrote ${out} (${(doc.length / 1024).toFixed(1)} KB, ${glyphDefs.size} glyphs, cycle ${T.toFixed(2)}s)`);
