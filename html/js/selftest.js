// ===================== SELF-TEST =====================
// Runs only when localStorage.getItem('stl_selftest') === '1'.
// Proves the preview helpers in combatMath.js produce the SAME numbers the
// real resolution methods in game.js apply. Logs to the console.

(function () {
  if (typeof localStorage === "undefined" || localStorage.getItem("stl_selftest") !== "1") return;

  let pass = 0, fail = 0;
  const fails = [];
  function eq(label, got, want) {
    if (got === want) pass++;
    else { fail++; fails.push(`${label}: got ${got}, expected ${want}`); }
  }
  function fresh() { return new Game(new MetaProgress()); }

  // ---- previewIncoming vs enemyAct ----
  const cases = [
    { pb: 0, vuln: 0, weak: 0, enrage: 0, sp: null, torii: false, intent: { type: "attack", value: 10, hits: 1 } },
    { pb: 6, vuln: 0, weak: 0, enrage: 0, sp: null, torii: false, intent: { type: "attack", value: 10, hits: 1 } },
    { pb: 3, vuln: 0, weak: 0, enrage: 0, sp: null, torii: false, intent: { type: "attack", value: 5, hits: 2 } },
    { pb: 0, vuln: 2, weak: 0, enrage: 0, sp: null, torii: false, intent: { type: "attack", value: 8, hits: 1 } },
    { pb: 0, vuln: 0, weak: 2, enrage: 0, sp: null, torii: false, intent: { type: "attack", value: 10, hits: 1 } },
    { pb: 0, vuln: 0, weak: 0, enrage: 3, sp: null, torii: false, intent: { type: "attack", value: 6, hits: 2 } },
    { pb: 0, vuln: 0, weak: 0, enrage: 0, sp: "pack_hunter", torii: false, intent: { type: "attack", value: 7, hits: 1 } },
    { pb: 4, vuln: 0, weak: 0, enrage: 0, sp: "pack_hunter", torii: false, intent: { type: "attack", value: 7, hits: 2 } },
    { pb: 0, vuln: 0, weak: 0, enrage: 0, sp: null, torii: true, intent: { type: "attack", value: 4, hits: 1 } },
  ];
  cases.forEach((c, i) => {
    const g = fresh();
    g.relics = c.torii ? [{ name: "Torii" }] : [];
    g.player.block = c.pb; g.player.vuln = c.vuln; g.player.hp = 300; g.player.max_hp = 300;
    g.enemy.weak = c.weak; g.enemy.enrage_stacks = c.enrage; g.enemy.special = c.sp;
    g.enemyIntent = c.intent;
    const predicted = previewIncoming(c.intent, {
      enemyWeak: g.enemy.weak, enrage: g.enemy.enrage_stacks,
      packHunter: g.enemy.special === "pack_hunter", playerVuln: g.player.vuln,
      torii: g.hasRelic("Torii"), playerBlock: g.player.block,
    });
    const hp0 = g.player.hp;
    g.enemyAct();
    eq("incoming#" + i, predicted, hp0 - g.player.hp);
  });

  // ---- playerHitDamage vs dealDamage ----
  const p = [
    { str: 0, weak: 0, evuln: 0, eblock: 0, base: 6 },
    { str: 3, weak: 0, evuln: 0, eblock: 0, base: 6 },
    { str: 0, weak: 2, evuln: 0, eblock: 0, base: 9 },
    { str: 0, weak: 0, evuln: 2, eblock: 0, base: 8 },
    { str: 2, weak: 0, evuln: 2, eblock: 5, base: 7 },
  ];
  p.forEach((c, i) => {
    const g = fresh();
    g.relics = [];
    g.player.strength = c.str; g.player.weak = c.weak; g.player.hp = 300; g.player.max_hp = 300; g.attacksPlayed = 0;
    g.enemy.vuln = c.evuln; g.enemy.block = c.eblock; g.enemy.special = null; g.enemy.hp = 800; g.enemy.max_hp = 800;
    const predicted = playerHitDamage(c.base, {
      strength: c.str, weak: c.weak, enemyVuln: c.evuln, redSkull: false, lowHp: false,
      penNibTrigger: false, stoneSkin: false, stoneThreshold: 0, enemyBlock: c.eblock,
    }).toHp;
    const hp0 = g.enemy.hp;
    g.dealDamage(c.base, "You");
    eq("playerhit#" + i, predicted, hp0 - g.enemy.hp);
  });

  // ---- poison ----
  (function () {
    const g = fresh();
    g.relics = []; g.player.hp = 300; g.player.max_hp = 300;
    g.enemy.hp = 100; g.enemy.max_hp = 100; g.enemy.block = 0; g.enemy.special = null; g.enemy.poison = 0;
    g.applyPoison(5);
    eq("poison-apply", g.enemy.poison, 5);
    g.enemyIntent = { type: "block", value: 0 };
    const hp0 = g.enemy.hp;
    g.endPlayerTurn();
    eq("poison-tick-dmg", hp0 - g.enemy.hp, 5);
    eq("poison-decrement", g.enemy.poison, 4);
  })();
  (function () {
    const g = fresh();
    g.relics = []; g.player.strength = 0; g.player.weak = 0;
    g.enemy.vuln = 0; g.enemy.block = 0; g.enemy.special = null;
    g.enemy.hp = 200; g.enemy.max_hp = 200; g.enemy.poison = 3;
    const hp = g.enemy.hp;
    g.executeCardEffect({ effectKey: "estocPrecis", text: "Deal 7. If enemy is Poisoned, deal 7 again." });
    eq("estoc-poison-combo", hp - g.enemy.hp, 14);
  })();
  (function () {
    const g = fresh();
    g.enemy.special = null; g.enemy.poison = 4;
    g.executeCardEffect({ effectKey: "catalyseur", text: "Double the enemy's Poison. Exhaust." });
    eq("catalyseur-double", g.enemy.poison, 8);
  })();

  console.log(`SELFTEST: ${pass} passed / ${fail} failed`);
  if (fail) console.warn("SELFTEST failures:\n" + fails.join("\n"));
})();
