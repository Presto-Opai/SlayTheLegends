# Slay The Legends — Pixel Art, Juice & Strategic Clarity

**Date:** 2026-06-05
**Status:** Approved (design)
**Goal:** Make the game more aesthetic, more illustrated, more dynamic, and more fun — including strategically — while staying a pure HTML/CSS/JS project with no build step and keeping saves working.

## Constraints

- No build step, no framework, no binary asset files. Everything stays text in the repo.
- Keep English UI; French folklore names stay French.
- Do not break the save format (`legendes_save`) or meta (`legendes_meta`). Migrate gracefully.
- Do not change meta/legacy/challenge *rules* or the run structure.

## Architecture

Three new files, plus edits to `ui.js`, `style.css`, and bounded hooks in `game.js`.

```
html/js/pixelArt.js   (new)  — sprite engine + sprite data + palette
html/js/fx.js         (new)  — effect queue + animation player (#fx-layer)
html/js/sprites.js    (new)  — encoded sprite data (enemies, icons, relics, potions)
html/js/game.js       (edit) — fx.emit() hooks at damage/block/status/death points
html/js/ui.js         (edit) — battle-stage rendering, sprite rendering, damage preview
html/css/style.css    (edit) — arena layout, card frames, pixel rendering, animations
html/index.html       (edit) — include new scripts, add #fx-layer
```

### 1. Pixel-art engine — `pixelArt.js`

- A shared limited folklore palette (16–32 named colors).
- Sprite data shape: `{ w, h, palette: [...], pixels: ["..0011..", ...] }` where each char
  is a palette index (`.` = transparent).
- `renderSprite(data, scale)` → a `<canvas>` element drawn with nearest-neighbor;
  CSS uses `image-rendering: pixelated`.
- Caches rendered canvases by `(name, scale)` to avoid re-painting every redraw.

**Coverage:** unique 24×24 sprite for all ~21 enemies + final boss. Small reusable icons
(8–12px) for card types (Attack/Skill/Power), keywords (Block, Vuln, Weak, Strength,
Armor, Energy, Poison), relics, and potions. Cards do NOT get 60 unique illustrations —
they get a juicy frame + type icon + rarity glow.

### 2. Battle stage — `ui.js` + `style.css`

- Replace the flat enemy/player text blocks with a framed **arena**:
  - per-tier subtle backdrop (CSS gradient + faint pixel pattern).
  - enemy sprite centered; floating **intent bubble** (icon + number) above it.
  - restyled HP bars, status badges as pixel-icon chips.
- Hand row: cleaner fanned cards with pixel frames, cost orb, type icon, rarity glow,
  unplayable dimming preserved.
- Sidebar restyled to match (same data, nicer surface).
- All existing screens (shop, reward, scry, removal, death, victory, legacy, challenge
  select) keep working; restyle only where cheap. Victory screens already polished — leave.

### 3. Juice layer — `fx.js`

- A persistent `#fx-layer` overlay div that is NOT wiped by `redraw()`.
- An **effect queue**: game logic pushes `{type, target, amount, ...}` during action
  resolution; UI drains and plays after each redraw.
- Effects: floating damage/block numbers, hit flash, attacker lunge, screen shake on big
  hits (threshold-based), status-effect pop, enemy **death dissolve**, card-play pulse.
- Respects `prefers-reduced-motion`: degrades to numbers + flashes only.

### 4. Strategic depth (bounded)

- **Damage preview (priority):**
  - Enemy intent shows the *actual* damage you'll take after current block (and Vuln on
    you), e.g. "Attack 12 → 4 after block".
  - Attack cards show *real* damage including Strength and enemy Vulnerable, not the raw
    base text number (as a computed badge; base text preserved).
- **Richer intents:** distinct icons for attack / multi-hit / block / buff / debuff,
  keyed off each enemy's `special`.
- **Content pack:** ~4–6 new cards, 1–2 new relics, one new keyword — leaning
  **Poison** (stacking damage-over-time the player can apply; ticks at enemy turn start).
  Poison also wired into a relic and 1–2 cards. Balanced against existing damage curve.

### 5. Stretch (optional, flagged in plan, cut first if needed)

- Occasional between-fight **event node**: a single risk/reward choice. Ships only if core
  is solid; isolated so it can be dropped.

## Data flow

`playCard()` / `enemyTurn()` mutate state as today, but now also call `fx.emit(...)` at
each numeric change. `redraw()` rebuilds the DOM (as today), renders sprites via the cached
engine, then `fx.flush()` plays queued effects against the freshly-rendered nodes (located
by stable ids/classes like `#enemy-sprite`, `#player-avatar`).

## Damage-preview computation

A pure helper `previewIncoming(enemyIntent, player)` and `previewCardDamage(card, game)`
that mirror the real resolution math in `game.js`. To avoid drift, the design extracts the
core damage formula into a shared function used by both resolution and preview.

## Testing

- Manual playthrough via the `run`/browser tools: start run, play cards, verify previews
  match actual outcomes, verify saves load across the change, verify reduced-motion.
- Sprite smoke test: a hidden debug gallery (dev-only, behind a flag) listing every sprite
  to catch broken encodings.

## Out of scope

- Per-card unique illustrations (60 sprites).
- Changing meta/legacy/challenge rules or run length.
- Networking, audio, mobile-specific rework beyond keeping current responsive rules.
