# SlayTheLegends

A roguelike deck-builder steeped in French folklore. Battle the Loup-Garou, the
Tarasque, Ankou the reaper, Mélusine, and finally **L'Ombre Souveraine** across 40
floors — forging a deck, claiming relics, and conquering challenges.

Pure HTML/CSS/JS — no build step. Open `html/index.html` (or the root `index.html`,
which redirects) and play.

## Features

- **Pixel-art creatures** — every enemy and boss is a hand-authored pixel sprite,
  rendered from compact encoded data (no image files, no build).
- **Living battle stage** — a framed, per-region arena with floating intent bubbles,
  icon status chips, gradient health bars, and idle-animated foes.
- **Combat juice** — floating damage/block/heal numbers, hit flashes, screen shake on
  big blows, and enemy death dissolves (respects `prefers-reduced-motion`).
- **Strategic clarity** — the enemy's intent shows the *actual* HP you'll lose after
  your block, and attack cards show their *real* damage with Strength/Vulnerable.
- **Poison archetype** — a stacking damage-over-time keyword with five venom cards and
  two relics to build around.
- Deep meta-progression: legacy upgrades, region-locked challenges, and a final gauntlet.

## Project layout

```
html/index.html      entry point
html/js/pixelArt.js   sprite engine (palette + nearest-neighbor canvas renderer)
html/js/sprites.js    encoded creature + icon sprite data
html/js/combatMath.js pure damage helpers shared by resolution and previews
html/js/data.js       cards, relics, potions, enemies, challenges
html/js/game.js       game engine / rules
html/js/fx.js         combat juice (effect queue + animations)
html/js/ui.js         rendering
html/js/selftest.js   console assertion harness (combat math vs resolution)
```

### Dev: combat-math self-test

Run `localStorage.setItem('stl_selftest','1')` in the console and reload — the console
logs `SELFTEST: N passed / 0 failed`, proving previews match real resolution.
