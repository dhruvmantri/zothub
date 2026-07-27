// Full ZotHub brand asset build: favicon set, app icons, manifest icons, OG card,
// and a brand-kit folder. Outlines real Instrument Sans (wght 700) glyphs.
const fs = require("fs");
const path = require("path");
const fontkit = require("fontkit");
const { Resvg } = require("@resvg/resvg-js");
const _ico = require("png-to-ico");
const pngToIco = _ico.default || _ico;

const DIR = __dirname;
const OUT = path.join(DIR, "dist");
const KIT = path.join(OUT, "brand-kit");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(KIT, { recursive: true });

const UPM = 1000;
const uprightVF = fontkit.openSync(path.join(DIR, "InstrumentSans.ttf")).getVariation({ wght: 700, wdth: 100 });
const italicVF = fontkit.openSync(path.join(DIR, "InstrumentSans-Italic.ttf")).getVariation({ wght: 700, wdth: 100 });

const C = {
  discDark: "#101112",
  bgDark: "#0E0F10",
  zotOnDark: "#F5F5F6",
  hubOnDark: "#5AA2E6",
  discLight: "#FFFFFF",
  hairline: "#CDD6DD",
  zotOnLight: "#14171B",
  hubOnLight: "#0F5FA8",
  inkDark: "#F0F1F2",
  ink2Dark: "#A8ABAF",
  inkLight: "#0D1519",
  ink2Light: "#44515A",
};

function layoutLine(vf, str, trackEm) {
  const track = trackEm * UPM;
  const run = vf.layout(str);
  let pen = 0, yMin = Infinity, yMax = -Infinity;
  const paths = [];
  for (let i = 0; i < run.glyphs.length; i++) {
    const g = run.glyphs[i];
    const d = g.path.toSVG();
    if (d) paths.push({ d, x: pen });
    const bb = g.bbox;
    if (isFinite(bb.minY)) { yMin = Math.min(yMin, bb.minY); yMax = Math.max(yMax, bb.maxY); }
    pen += run.positions[i].xAdvance + track;
  }
  const width = pen - track;
  if (!isFinite(yMin)) { yMin = 0; yMax = UPM; }
  return { paths, width, yMin, yMax };
}

function glyphPaths(parts, s) {
  return parts.map(p =>
    `<path d="${p.d}" transform="translate(${(p.px).toFixed(3)} ${p.py.toFixed(3)}) scale(${s.toFixed(6)} ${(-s).toFixed(6)})" fill="${p.color}"/>`
  ).join("");
}

// Stacked mark inner content, centred in a box of side D at origin (ox,oy).
function stackedInner({ D, ox = 0, oy = 0, theme = "dark" }) {
  let ratio, trackEm, lh;
  if (D <= 16) { ratio = 0.375; trackEm = -0.05; lh = 0.82; }
  else if (D <= 32) { ratio = 0.335; trackEm = -0.045; lh = 0.84; }
  else { ratio = 0.3125; trackEm = -0.035; lh = 0.86; }
  const fontPx = ratio * D, s = fontPx / UPM;
  const zot = layoutLine(uprightVF, "zot", trackEm);
  const hub = layoutLine(italicVF, "hub", trackEm);
  const gapPx = lh * fontPx;
  let y1 = 0, y2 = gapPx;
  const top = y1 - zot.yMax * s, bottom = y2 - hub.yMin * s;
  const dy = (D - (bottom - top)) / 2 - top;
  y1 += dy; y2 += dy;
  const zc = theme === "dark" ? C.zotOnDark : C.zotOnLight;
  const hc = theme === "dark" ? C.hubOnDark : C.hubOnLight;
  const x1 = (D - zot.width * s) / 2, x2 = (D - hub.width * s) / 2;
  const parts = [
    ...zot.paths.map(p => ({ d: p.d, px: ox + x1 + p.x * s, py: oy + y1, color: zc })),
    ...hub.paths.map(p => ({ d: p.d, px: ox + x2 + p.x * s, py: oy + y2, color: hc })),
  ];
  return glyphPaths(parts, s);
}

// Full circle disc mark (transparent bg) — favicons, avatar.
function discMark({ D, theme = "dark" }) {
  const fill = theme === "dark" ? C.discDark : C.discLight;
  let disc = `<circle cx="${D / 2}" cy="${D / 2}" r="${D / 2}" fill="${fill}"/>`;
  if (theme === "light") disc += `<circle cx="${D / 2}" cy="${D / 2}" r="${D / 2 - 0.5}" fill="none" stroke="${C.hairline}" stroke-width="1"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${D}" height="${D}" viewBox="0 0 ${D} ${D}">${disc}${stackedInner({ D, theme })}</svg>`;
}

// Full-bleed dark square icon (apple-touch / manifest any). safe=true -> maskable.
function squareIcon({ D, safe = false }) {
  const inset = safe ? D * 0.16 : 0; // maskable safe zone ~ keep art in inner 68%
  const inner = D - inset * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${D}" height="${D}" viewBox="0 0 ${D} ${D}"><rect width="${D}" height="${D}" fill="${C.discDark}"/>${stackedInner({ D: inner, ox: inset, oy: inset, theme: "dark" })}</svg>`;
}

// One-line wordmark: zot (upright) + hub (italic), baseline at by, left at bx.
function inlineWordmark({ fontPx, bx, by, zc, hc, trackEm = -0.045 }) {
  const s = fontPx / UPM;
  const zot = layoutLine(uprightVF, "zot", trackEm);
  const hub = layoutLine(italicVF, "hub", trackEm);
  const gap = trackEm * UPM;
  const hubX = zot.width + gap;
  const parts = [
    ...zot.paths.map(p => ({ d: p.d, px: bx + p.x * s, py: by, color: zc })),
    ...hub.paths.map(p => ({ d: p.d, px: bx + (p.x + hubX) * s, py: by, color: hc })),
  ];
  return { svg: glyphPaths(parts, s), width: (hubX + hub.width) * s };
}

// OG / social card 1200x630.
function ogCard({ theme = "dark" }) {
  const W = 1200, H = 630;
  const bg = theme === "dark" ? C.bgDark : "#FFFFFF";
  const zc = theme === "dark" ? C.inkDark : C.inkLight;
  const hc = theme === "dark" ? C.hubOnDark : C.hubOnLight;
  const tag = theme === "dark" ? C.ink2Dark : C.ink2Light;
  const M = 100;
  const discD = 132;
  // stacked disc top-left
  const disc = discMark({ D: discD, theme });
  const discInner = disc.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  // big wordmark
  const wm = inlineWordmark({ fontPx: 168, bx: M, by: 370, zc, hc });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${bg}"/>
  <g transform="translate(${M} 96)">${discInner}</g>
  ${wm.svg}
  <text x="${M}" y="452" font-family="Instrument Sans" font-size="42" font-weight="600" fill="${zc}" letter-spacing="-1">Your gateway to campus life.</text>
  <text x="${M}" y="500" font-family="Instrument Sans" font-size="29" font-weight="500" fill="${tag}" letter-spacing="-0.4">Opportunities, clubs, and events — all in one place at UCI.</text>
  <rect x="${M}" y="536" width="56" height="5" rx="2.5" fill="${C.hubOnDark}"/>
  <text x="${M}" y="566" font-family="Instrument Sans" font-size="26" font-weight="600" fill="${hc}" letter-spacing="-0.4">zothub.app</text>
</svg>`;
}

const FONT_OPT = {
  loadSystemFonts: false,
  fontFiles: [path.join(DIR, "InstrumentSans.ttf"), path.join(DIR, "InstrumentSans-Italic.ttf")],
  defaultFontFamily: "Instrument Sans",
};
function render(svg, out, size) {
  const opts = { background: "rgba(0,0,0,0)", font: FONT_OPT };
  if (size) opts.fitTo = { mode: "width", value: size };
  fs.writeFileSync(out, new Resvg(svg, opts).render().asPng());
}

// ---------- FAVICON PNGs + ICO ----------
const icoParts = [];
for (const D of [16, 32, 48]) {
  const p = path.join(OUT, `favicon-${D}.png`);
  render(discMark({ D, theme: "dark" }), p);
  icoParts.push(p);
}
fs.writeFileSync(path.join(OUT, "favicon-64.png"), new Resvg(discMark({ D: 64, theme: "dark" }), { background: "rgba(0,0,0,0)" }).render().asPng());

// ---------- SVG favicon (scalable) ----------
fs.writeFileSync(path.join(OUT, "favicon.svg"), discMark({ D: 64, theme: "dark" }));

// ---------- apple-touch (180 full-bleed) ----------
render(squareIcon({ D: 180 }), path.join(OUT, "apple-touch-icon.png"));

// ---------- manifest icons ----------
render(squareIcon({ D: 192 }), path.join(OUT, "icon-192.png"));
render(squareIcon({ D: 512 }), path.join(OUT, "icon-512.png"));
render(squareIcon({ D: 512, safe: true }), path.join(OUT, "icon-maskable-512.png"));

// ---------- OG images ----------
render(ogCard({ theme: "dark" }), path.join(OUT, "og-image.png"), 1200);
render(ogCard({ theme: "light" }), path.join(OUT, "og-image-light.png"), 1200);

// ---------- brand kit ----------
fs.writeFileSync(path.join(KIT, "mark-dark.svg"), discMark({ D: 512, theme: "dark" }));
fs.writeFileSync(path.join(KIT, "mark-light.svg"), discMark({ D: 512, theme: "light" }));
fs.writeFileSync(path.join(KIT, "mark-appicon.svg"), squareIcon({ D: 512 }));
render(discMark({ D: 512, theme: "dark" }), path.join(KIT, "mark-dark-512.png"));
render(discMark({ D: 1024, theme: "dark" }), path.join(KIT, "mark-dark-1024.png"));
render(discMark({ D: 512, theme: "light" }), path.join(KIT, "mark-light-512.png"));

// wordmark lockups (transparent, trimmed height ~ 220px)
function wordmarkSVG(theme) {
  const zc = theme === "dark" ? C.inkDark : C.inkLight;
  const hc = theme === "dark" ? C.hubOnDark : C.hubOnLight;
  const fontPx = 200, by = 210, bx = 12;
  const wm = inlineWordmark({ fontPx, bx, by, zc, hc });
  const W = Math.ceil(wm.width + bx * 2), H = 260;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${wm.svg}</svg>`;
}
fs.writeFileSync(path.join(KIT, "wordmark-dark.svg"), wordmarkSVG("dark"));
fs.writeFileSync(path.join(KIT, "wordmark-light.svg"), wordmarkSVG("light"));
render(wordmarkSVG("light"), path.join(KIT, "wordmark-light-x2.png"), 900);
render(wordmarkSVG("dark"), path.join(KIT, "wordmark-dark-x2.png"), 900);

// build favicon.ico last (async)
(async () => {
  const ico = await pngToIco(icoParts);
  fs.writeFileSync(path.join(OUT, "favicon.ico"), ico);
  console.log("BUILD COMPLETE →", OUT);
  const walk = (d, pre = "") => fs.readdirSync(d).sort().forEach(f => {
    const fp = path.join(d, f), st = fs.statSync(fp);
    if (st.isDirectory()) { console.log(pre + f + "/"); walk(fp, pre + "  "); }
    else console.log(pre + f, "(" + st.size + "b)");
  });
  walk(OUT);
})();
