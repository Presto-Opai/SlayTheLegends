// ===================== SPRITE DATA =====================
// Creatures are 24x24. Symmetric ones are authored as 12-wide left halves
// and mirrored; asymmetric ones are authored full-width.
// Names MUST match enemy.name strings in data.js exactly.
//
// defSprite(name, rows, opts)
//   opts.sym  : true (default) -> rows are left halves (<=12 chars), mirrored to 24
//               false -> rows are full width (<=W chars)
//   opts.w    : full width for asymmetric sprites (default 24)
//   opts.pal  : per-sprite palette overrides

const SPRITES = {};

function _pad(row, n) {
  row = row || "";
  if (row.length > n) return row.slice(0, n);
  return row + ".".repeat(n - row.length);
}

function defSprite(name, rows, opts) {
  opts = opts || {};
  const sym = opts.sym !== false;
  let pixels;
  if (sym) {
    const half = rows.map(r => _pad(r, 12));
    pixels = mirrorRows(half);            // -> 24 wide
  } else {
    const w = opts.w || 24;
    pixels = rows.map(r => _pad(r, w));
  }
  SPRITES[name] = { w: pixels[0].length, h: pixels.length, pixels, palette: opts.pal || null };
}

// ---- Loup-Garou (werewolf) ----
defSprite("Loup-Garou", [
  "",
  "...kk",
  "..knnk",
  "..knnnk",
  ".knnnnnk",
  ".knnnnnnnk",
  ".knnnnnnnnnn",
  "knRRnnnnnnnN",
  "knRRnnnnnnnN",
  "kNnnnnnnnnNN",
  ".kNnnnnnNN",
  "..kNnnnNk",
  "...knWWWNk",
  "....kWWk",
  ".nnNnnnnnnnn",
  "nnNnnnnnnnnn",
  "nNnnnnttnnnn",
  "knnnnnttnnnn",
  "WkNnnnnttnnn",
  "WWkNnnnnnnnn",
  ".WkNnnnnnnnN",
  "..nnnnnNn",
  "..knnnk",
  "...kWWk",
]);
