# Pixel Art, Juice & Strategic Clarity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pixel-art creatures, full combat juice, and damage-preview strategic clarity to the French-folklore deck-builder, with no build step and no broken saves.

**Architecture:** Three new vanilla-JS files (`pixelArt.js` engine, `sprites.js` data, `fx.js` effect layer) loaded before `ui.js`. `game.js` gets bounded `fx.emit()` hooks and a shared damage formula extracted so previews can't drift from resolution. `ui.js` rebuilds the combat screen as a framed "arena" with rendered sprites; `style.css` gains the arena layout, card frames, pixel rendering, and animations.

**Tech Stack:** HTML5 `<canvas>` (nearest-neighbor), CSS animations, plain ES (no modules, global script tags — matches existing project).

**Testing reality:** No test runner exists. Pure math (damage preview vs resolution) is verified by an in-repo assertion harness `html/js/selftest.js` that runs in the console and logs PASS/FAIL. Everything visual is verified by browser playthrough using the `run` tool.

---

## File Structure

- `html/js/pixelArt.js` (new) — palette + `renderSprite(name, scale)` → cached `<canvas>`.
- `html/js/sprites.js` (new) — `SPRITES = { name: {w,h,palette,pixels} }` for enemies + icons.
- `html/js/fx.js` (new) — `FX` effect queue: `FX.emit(...)`, `FX.flush(layerEl)`.
- `html/js/selftest.js` (new) — console assertion harness for damage math; no-op in normal play.
- `html/js/combatMath.js` (new) — extracted pure helpers: `playerHitDamage`, `enemyHitDamage`, `previewIncoming`, `previewCardDamage`.
- `html/js/game.js` (edit) — use `combatMath` helpers in `dealDamage`/`enemyAct`; add `FX.emit` hooks.
- `html/js/ui.js` (edit) — arena render, sprite render, intent bubble, damage preview badges, fx flush.
- `html/css/style.css` (edit) — arena, card frames, `image-rendering: pixelated`, animations, reduced-motion.
- `html/index.html` (edit) — load new scripts (order: pixelArt, sprites, combatMath, fx, data, game, ui, selftest), add `<div id="fx-layer">`.

---

## Task 1: Pixel-art engine + first sprite (vertical slice)

**Files:**
- Create: `html/js/pixelArt.js`, `html/js/sprites.js`
- Modify: `html/index.html`, `html/css/style.css`

- [ ] **Step 1: Engine.** In `pixelArt.js` define a shared `PALETTE` object (named hex colors, e.g. `{ k:'#1a1320', W:'#f4e9d8', r:'#c0392b', ... }`) and:

```js
const _spriteCache = {};
function renderSprite(name, scale = 6) {
  const key = name + '@' + scale;
  if (_spriteCache[key]) return _spriteCache[key].cloneNode(true);
  const s = SPRITES[name];
  if (!s) { const c = document.createElement('canvas'); c.width=c.height=1; return c; }
  const cv = document.createElement('canvas');
  cv.width = s.w * scale; cv.height = s.h * scale;
  cv.className = 'pixel-sprite';
  const ctx = cv.getContext('2d');
  for (let y = 0; y < s.h; y++) {
    const row = s.pixels[y] || '';
    for (let x = 0; x < s.w; x++) {
      const ch = row[x] || '.';
      if (ch === '.') continue;
      ctx.fillStyle = (s.palette && s.palette[ch]) || PALETTE[ch] || '#f0f';
      ctx.fillRect(x*scale, y*scale, scale, scale);
    }
  }
  _spriteCache[key] = cv;
  return cv.cloneNode(true);
}
```

- [ ] **Step 2: First sprite.** In `sprites.js` author ONE 24×24 enemy, `"Loup-Garou"`, as `{w:24,h:24,palette:{...},pixels:[...]}`. Use a local palette keyed by single chars.

- [ ] **Step 3: Wire CSS.** Add to `style.css`:

```css
.pixel-sprite { image-rendering: pixelated; image-rendering: crisp-edges; }
```

- [ ] **Step 4: Load scripts.** In `index.html`, add before `data.js`:
`<script src="js/pixelArt.js"></script><script src="js/sprites.js"></script>` and add `<div id="fx-layer"></div>` as last child of `<body>`.

- [ ] **Step 5: Smoke render.** Temporarily in `ui.js redraw()`, append `renderSprite("Loup-Garou", 6)` to the enemy section. Open in browser via `run`; confirm the wolf draws crisp. Remove the temp line after confirming.

- [ ] **Step 6: Commit** `feat: pixel-art engine + first creature sprite`.

---

## Task 2: All creature sprites + icon set

**Files:** Modify `html/js/sprites.js`

- [ ] **Step 1:** Author 24×24 sprites for every enemy name in `ENEMIES` (data.js) — all tiers — plus `"L'Ombre Souveraine"`. Names must exactly match `enemy.name` strings. Keep a shared readable palette; lean into recognizable silhouettes (Ankou = hooded reaper + scythe; Tarasque = spiked shell + dragon head; Mélusine = serpent coil + fae; Gargouille = stone wings; etc.).

- [ ] **Step 2:** Author small icon sprites (8–12px): `icon_attack`, `icon_skill`, `icon_power`, `icon_block`, `icon_vuln`, `icon_weak`, `icon_strength`, `icon_armor`, `icon_energy`, `icon_poison`, `icon_relic`, `icon_potion`, plus intent icons `intent_attack`, `intent_multi`, `intent_block`, `intent_buff`, `intent_debuff`, `intent_unknown`.

- [ ] **Step 3: Debug gallery.** Add `window.spriteGallery()` to `pixelArt.js` that appends every `SPRITES` key (scaled) to the body — call it manually in console to eyeball all sprites for broken encodings. Fix any.

- [ ] **Step 4: Commit** `feat: full creature roster + icon sprites`.

---

## Task 3: Extract shared combat math (prevents preview drift)

**Files:** Create `html/js/combatMath.js`, `html/js/selftest.js`; Modify `html/js/game.js`, `html/index.html`

- [ ] **Step 1:** In `combatMath.js`, write pure functions mirroring the existing formulas in `game.js` (`dealDamage` lines ~185–211, `enemyAct` lines ~546–574). Signatures:

```js
// Damage ONE player attack deals to enemy hp (post-block, post-strength/vuln/weak).
function playerHitDamage(base, ctx) { /* ctx: {strength,weak,enemyVuln,redSkull,...} -> {toHp, toBlock} */ }
// Damage ONE enemy hit deals to player hp given remaining block.
function enemyHitDamage(intentValue, ctx) { /* {enemyWeak,enrage,packHunterNoBlock,playerVuln,torii,blockRemaining} -> {toHp, blockLeft} */ }
// Total damage to player across all hits of current intent, after block.
function previewIncoming(intent, ctx) { /* loops enemyHitDamage across hits, depleting block */ }
// Display damage of an attack card (per hit) for the hand badge.
function previewCardDamage(card, ctx) { /* returns number or null for non-attacks */ }
```

- [ ] **Step 2:** In `game.js`, refactor `dealDamage` and `enemyAct` to call the same helpers (no behavior change — pure extraction). Keep relic/special branches that the helpers don't model inline, but route the core arithmetic through `combatMath`.

- [ ] **Step 3:** In `selftest.js`, assert previews equal resolution for a table of cases (weak, vuln, multi-hit, block partial/over, enrage, pack_hunter, torii). Log `SELFTEST: N passed / M failed`. Guard so it only runs when `localStorage.getItem('stl_selftest')==='1'`.

- [ ] **Step 4:** Set the flag in console, reload, confirm `0 failed`. Fix mismatches by aligning helpers to `game.js`.

- [ ] **Step 5:** Load `combatMath.js` (before game.js) and `selftest.js` (last) in `index.html`. **Commit** `refactor: shared combat math + self-test harness`.

---

## Task 4: Battle-stage layout + sprite rendering

**Files:** Modify `html/js/ui.js`, `html/css/style.css`

- [ ] **Step 1:** Rework the enemy/player sections of `redraw()` into an `.arena` container: per-tier backdrop class (`arena-tier-1..5` chosen from `game.enemy.tier`/final boss), `#enemy-stage` holding `renderSprite(game.enemy.name, scale)` centered with stable id `#enemy-sprite`, HP bar below, and status badges rendered as icon chips (`icon_vuln` + number, etc.). Player block/str/armor likewise become icon chips; energy orb kept but restyled.

- [ ] **Step 2:** Add `.arena`, `.arena-tier-*` (CSS gradient backdrops + faint pattern), `#enemy-stage`, `.status-chip`, restyled `.energy-orb`, and card-frame upgrades (`.card` gets layered border/inner glow per rarity, type icon slot) to `style.css`. Preserve `.unplayable` dimming and mobile rules.

- [ ] **Step 3:** In `makeCard`, insert a type icon (`renderSprite('icon_'+type, 2)`) into the card and keep name/text. Keep click handler intact.

- [ ] **Step 4:** Browser-verify a full fight renders: sprite, bars, chips, hand. **Commit** `feat: pixel battle stage + card frames`.

---

## Task 5: Intent bubble + damage preview (strategic clarity)

**Files:** Modify `html/js/ui.js`

- [ ] **Step 1:** Replace the text intent with a floating `.intent-bubble` above `#enemy-sprite`: intent icon (`intent_attack`/`intent_multi`/`intent_block`/`intent_buff` chosen from `game.enemyIntent` and `enemy.special`) + raw value, and for attacks a second line `→ X` where `X = previewIncoming(intent, ctx)` (actual HP loss after current block). Keep `revealedIntents` future row, now with mini icons.

- [ ] **Step 2:** In `makeCard`, for Attack cards add a `.card-dmg-badge` showing `previewCardDamage(card, ctx)` (real damage incl. Strength/Vuln) when it differs from the base; non-attacks unchanged.

- [ ] **Step 3:** Browser-verify: previews update live as you gain block / apply Vuln / play Strength, and match what actually happens on End Turn (cross-check with selftest still green). **Commit** `feat: intent bubble + live damage preview`.

---

## Task 6: Juice layer (fx.js)

**Files:** Create `html/js/fx.js`; Modify `html/js/game.js`, `html/js/ui.js`, `html/css/style.css`

- [ ] **Step 1:** In `fx.js`: `FX = { queue:[], emit(e){this.queue.push(e)}, flush(layer){...} }`. `flush` reads `#enemy-sprite` / `#player-stage` positions and spawns DOM nodes for each queued effect, then clears the queue. Effect types: `damage` (floating red number + target hit-flash + shake if `amount>=12`), `block` (floating cyan number), `status` (icon pop), `heal` (green number), `death` (sprite dissolve), `cardplay` (pulse). All effects auto-remove via `animationend`.

- [ ] **Step 2:** Add CSS keyframes: `floatNum`, `hitFlash`, `screenShake` (applied to `#game-area`), `statusPop`, `spriteDissolve`, `cardPulse`. Wrap all motion (not opacity/number) in `@media (prefers-reduced-motion: no-preference)`; reduced-motion users still get numbers + flash.

- [ ] **Step 3:** Add bounded `FX.emit` calls in `game.js`: in `dealDamage` (emit `damage` on enemy with returned amount; `death` when `enemy.hp<=0`), `gainBlock` (`block`), `applyVuln`/`applyWeak` (`status`), `heal` (`heal`), `enemyAct` per hit (`damage` on player; shake on big), and `playCard` (`cardplay`). Emit only — never read DOM from game.js.

- [ ] **Step 4:** In `ui.js redraw()`, after building DOM call `FX.flush(document.getElementById('fx-layer'))`. Ensure `#fx-layer` is `position:fixed; inset:0; pointer-events:none; z-index:200`.

- [ ] **Step 5:** Browser-verify: playing Strike pops a damage number + flash; big hits shake; enemy death dissolves; reduced-motion mode is calm. **Commit** `feat: combat juice layer`.

---

## Task 7: Content pack — Poison keyword + new cards/relics

**Files:** Modify `html/js/data.js`, `html/js/game.js`, `html/js/ui.js`

- [ ] **Step 1:** Add `enemy.poison` (default 0) wherever enemy state is initialized (regular + final boss). At enemy turn start, before its action, apply poison: `enemy.hp -= enemy.poison; enemy.poison = Math.max(0, enemy.poison-1); FX.emit poison damage`. Show enemy poison as a status chip + in preview math (poison kills/chip independent of block).

- [ ] **Step 2:** Add effect key `applyPoison(n){ this.enemy.poison += n; }` and ~5 new cards in `data.js` + their `effectKey` cases in `game.js`, e.g.:
  - `Venin de la Vouivre` (1, Attack, "Deal 4. Apply 3 Poison.", uncommon)
  - `Souffle Empoisonné` (1, Skill, "Apply 5 Poison.", uncommon)
  - `Catalyseur` (0, Skill, "Double the enemy's Poison. Exhaust.", rare)
  - `Estoc Précis` (2, Attack, "Deal 7. If enemy is Poisoned, deal 7 again.", uncommon)
  - `Pacte du Crapaud` (1, Power, "At end of each turn, apply 2 Poison. Exhaust.", rare)
  Add at least one to the neutral pool and others to relevant `REGIONS` lists so they appear in rewards.

- [ ] **Step 2b:** Add 2 relics in `data.js` + `applyRelic` handling: `Fiole de Venin` ("Enemies start each combat with 2 Poison.") and `Dague Enduite` ("First attack each combat applies 2 Poison.").

- [ ] **Step 3:** Verify poison ticks, scales, and previews correctly; run a fight using a poison card; selftest still green. **Commit** `feat: Poison keyword + venom cards & relics`.

---

## Task 8: Polish pass + save compatibility + final verification

**Files:** Modify as needed across `ui.js`, `style.css`, `game.js`

- [ ] **Step 1:** Restyle shop / reward / scry / removal / death / legacy / challenge-select surfaces to share the new card-frame + chip vocabulary (cheap reuse; don't touch victory screens — already polished). Use creature sprites in reward/enemy-preview where natural.

- [ ] **Step 2:** Save compatibility: load an old save string (no `poison` field). Confirm `JSON.parse` + defaulting (`enemy.poison ?? 0`, `player.poison`/etc.) doesn't crash. Add defensive defaults in the load path.

- [ ] **Step 3:** Full regression playthrough via `run`: start → several fights → shop → elite/boss → death and victory screens. Confirm: sprites for every enemy encountered, previews accurate, juice firing, no console errors, saves load. Run selftest one final time.

- [ ] **Step 4:** Update `README.md` with a short feature blurb + a screenshot note. **Commit** `feat: polish, save-compat, docs`.

---

## Self-Review

- **Spec coverage:** engine (T1), creatures+icons (T2), arena+frames (T4), juice (T6),
  damage preview (T3+T5), richer intents (T5), Poison content pack (T7), save-compat &
  restyle (T8). Between-fight events = spec stretch, intentionally omitted (cut-first).
- **Placeholder scan:** none — every step states concrete files/functions/cards.
- **Type consistency:** `renderSprite(name,scale)`, `FX.emit`/`FX.flush`,
  `previewIncoming`/`previewCardDamage`/`playerHitDamage`/`enemyHitDamage`,
  `applyPoison`, `enemy.poison` — names used consistently across tasks.
