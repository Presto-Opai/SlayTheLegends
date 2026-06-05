// ===================== PIXEL ART ENGINE =====================
// Sprites are encoded as { w, h, palette?, pixels: ["..ab..", ...] }.
// Each character is a palette key; '.' (or ' ') is transparent.
// renderSprite(name, scale) -> a <canvas> drawn nearest-neighbor.

const PALETTE = {
  ".": null, " ": null,
  k: "#14101a", // outline / near-black
  K: "#2a2236", // dark
  h: "#241a33", // shadow purple
  g: "#6d6a7a", // grey
  G: "#b8b4c4", // light grey
  u: "#8a96a8", // steel
  U: "#586273", // dark steel
  W: "#f4ecdd", // bone / white
  w: "#ccc2b0", // dim white
  r: "#b8332a", // red
  R: "#e1564a", // bright red
  d: "#7a1f1f", // blood
  o: "#d97a2b", // orange
  f: "#ff8c1a", // fire
  y: "#e8c049", // yellow / gold
  Y: "#fff0a8", // bright gold
  n: "#6b4a2f", // brown
  N: "#43301f", // dark brown
  t: "#b08653", // tan
  T: "#8a6038", // dark tan
  e: "#4a8c3f", // green
  E: "#6fc05a", // bright green
  q: "#2f5a36", // deep green
  b: "#3a6ea5", // blue
  B: "#6fa8dc", // light blue
  c: "#4ec0c0", // cyan
  i: "#bfe6f0", // ice
  p: "#6a3d8f", // purple
  P: "#a06fc0", // light purple
  m: "#c45a8f", // pink / magenta
  s: "#e0a878", // skin
  S: "#b07a4f", // dark skin
  v: "#3a2a1a", // void brown
  x: "#0c0a12", // pure shadow
};

// Build a full symmetric sprite from left-half rows (right side mirrored).
// Pass odd width for a center column, even for clean mirror.
function mirrorRows(rows) {
  return rows.map(row => {
    const rev = row.split("").reverse().join("");
    return row + rev;
  });
}

// Cache of 1x source canvases (one device pixel per sprite pixel).
const _sourceCache = {};

function _sourceCanvas(name) {
  if (_sourceCache[name]) return _sourceCache[name];
  const s = (typeof SPRITES !== "undefined") ? SPRITES[name] : null;
  const cv = document.createElement("canvas");
  if (!s) { cv.width = cv.height = 1; _sourceCache[name] = cv; return cv; }
  cv.width = s.w;
  cv.height = s.h;
  const ctx = cv.getContext("2d");
  const pal = s.palette || {};
  for (let y = 0; y < s.h; y++) {
    const row = s.pixels[y] || "";
    for (let x = 0; x < s.w; x++) {
      const ch = row[x] || ".";
      if (ch === "." || ch === " ") continue;
      const col = (ch in pal ? pal[ch] : PALETTE[ch]);
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  _sourceCache[name] = cv;
  return cv;
}

function renderSprite(name, scale = 6) {
  const src = _sourceCanvas(name);
  const cv = document.createElement("canvas");
  cv.className = "pixel-sprite";
  cv.width = src.width * scale;
  cv.height = src.height * scale;
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false; // nearest-neighbor upscale
  ctx.drawImage(src, 0, 0, src.width, src.height, 0, 0, cv.width, cv.height);
  return cv;
}

// Dev helper: dump every sprite to the page to eyeball encodings.
function spriteGallery(scale = 5) {
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:fixed;inset:0;overflow:auto;background:#0d1117;z-index:9999;padding:20px;display:flex;flex-wrap:wrap;gap:16px;align-content:flex-start";
  Object.keys(SPRITES).sort().forEach(nm => {
    const cell = document.createElement("div");
    cell.style.cssText = "display:flex;flex-direction:column;align-items:center;width:140px;color:#cfe0ff;font:11px sans-serif;gap:4px;background:#161b22;padding:8px;border-radius:6px";
    cell.appendChild(renderSprite(nm, scale));
    const lbl = document.createElement("div");
    lbl.textContent = nm;
    lbl.style.textAlign = "center";
    cell.appendChild(lbl);
    wrap.appendChild(cell);
  });
  const close = document.createElement("button");
  close.textContent = "Close gallery";
  close.style.cssText = "position:fixed;top:8px;right:8px;z-index:10000;padding:6px 12px";
  close.onclick = () => wrap.remove();
  wrap.appendChild(close);
  document.body.appendChild(wrap);
}
