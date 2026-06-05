// ===================== COMBAT MATH =====================
// Pure helpers shared by resolution (game.js) and previews (ui.js).
// Keeping the arithmetic here means the numbers the player SEES are computed
// by the exact same code that resolves the turn — previews cannot drift.

// Stone Skin threshold: attacks at/under this are reduced to 1 (mirrors game.js).
function stoneSkinThreshold(level) {
  const scale = level <= 40 ? 1.0 + 0.05 * level : 3.0 + 0.1 * (level - 40);
  return Math.floor(5 * scale);
}

// Damage ONE player attack deals.
// ctx: { strength, weak, enemyVuln, redSkull, lowHp, penNibTrigger,
//        stoneSkin, stoneThreshold, enemyBlock }
// returns { raw, toHp, enemyBlockLeft }  (raw = pre-block displayed damage)
function playerHitDamage(base, ctx) {
  let amount = base;
  amount += ctx.strength || 0;
  if (ctx.redSkull && ctx.lowHp) amount += 3;
  if (ctx.weak > 0) amount = Math.floor(amount * 0.75);
  if (ctx.penNibTrigger) amount *= 2;
  if (ctx.enemyVuln > 0) amount = Math.floor(amount * 1.5);
  amount = Math.max(0, amount);
  if (ctx.stoneSkin && amount > 0 && amount <= (ctx.stoneThreshold || 0)) amount = 1;

  let toHp = amount;
  let block = ctx.enemyBlock || 0;
  if (block > 0) { const ab = Math.min(block, toHp); block -= ab; toHp -= ab; }
  return { raw: amount, toHp: Math.max(0, toHp), enemyBlockLeft: block };
}

// Displayed (pre-block) damage of an attack card, after Strength/Weak/Vuln.
// Returns a number, or null when the card isn't a simple "Deal N" attack.
function previewCardDamage(card, ctx) {
  if (!card || card.type !== "Attack") return null;
  const m = /Deal (\d+)/.exec(card.text || "");
  if (!m) return null;
  const base = parseInt(m[1], 10);
  const res = playerHitDamage(base, {
    strength: ctx.strength, weak: ctx.weak, enemyVuln: ctx.enemyVuln,
    redSkull: ctx.redSkull, lowHp: ctx.lowHp,
    penNibTrigger: false, stoneSkin: false, enemyBlock: 0,
  });
  return res.raw;
}

// Damage ONE enemy hit deals to the player, given block remaining BEFORE the hit.
// ctx: { enemyWeak, enrage, packHunter, playerVuln, torii, blockRemaining }
// returns { toHp, blockLeft }
function enemyHitDamage(intentValue, ctx) {
  let dmg = intentValue;
  if (ctx.enemyWeak > 0) dmg = Math.floor(dmg * 0.75);
  dmg += ctx.enrage || 0;
  if (ctx.packHunter && (ctx.blockRemaining || 0) === 0) dmg += 3;
  if (ctx.playerVuln > 0) dmg = Math.floor(dmg * 1.5);
  if (ctx.torii && dmg <= 5 && dmg > 0) dmg = 1;

  let block = ctx.blockRemaining || 0;
  let toHp = dmg;
  if (block > 0) { const ab = Math.min(block, dmg); block -= ab; toHp = dmg - ab; }
  return { toHp: Math.max(0, toHp), blockLeft: block };
}

// Total HP the player will lose from the current intent, after their block.
// ctx: { enemyWeak, enrage, packHunter, playerVuln, torii, playerBlock }
function previewIncoming(intent, ctx) {
  if (!intent || intent.type !== "attack") return 0;
  const hits = intent.hits || 1;
  let block = ctx.playerBlock || 0;
  let total = 0;
  for (let h = 0; h < hits; h++) {
    const r = enemyHitDamage(intent.value, {
      enemyWeak: ctx.enemyWeak, enrage: ctx.enrage,
      packHunter: ctx.packHunter, playerVuln: ctx.playerVuln,
      torii: ctx.torii, blockRemaining: block,
    });
    total += r.toHp;
    block = r.blockLeft;
  }
  return total;
}
