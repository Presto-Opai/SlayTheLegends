// Neutral cards always available in region-only challenges
const CHALLENGE_NEUTRAL_CARDS = ["Defend", "Cleave", "Gallic Resolve", "Adrenaline Rush"];

// ===================== META PROGRESS =====================
class MetaProgress {
  constructor() {
    this.legacyPoints = 0;
    this.totalRuns = 0;
    this.bestFloor = 0;
    this.totalKills = 0;
    this.upgrades = {};
    this.firstClear = false;
    this.challengesCompleted = {};
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem("legendes_meta");
      if (!raw) return;
      const data = JSON.parse(raw);
      this.legacyPoints = data.legacyPoints || 0;
      this.totalRuns = data.totalRuns || 0;
      this.bestFloor = data.bestFloor || 0;
      this.totalKills = data.totalKills || 0;
      this.upgrades = data.upgrades || {};
      this.firstClear = data.firstClear || false;
      this.challengesCompleted = data.challengesCompleted || {};
    } catch (e) { /* ignore */ }
  }

  save() {
    localStorage.setItem("legendes_meta", JSON.stringify({
      legacyPoints: this.legacyPoints,
      totalRuns: this.totalRuns,
      bestFloor: this.bestFloor,
      totalKills: this.totalKills,
      upgrades: this.upgrades,
      firstClear: this.firstClear,
      challengesCompleted: this.challengesCompleted,
    }));
  }

  rank(id) { return this.upgrades[id] || 0; }

  cost(id) {
    const u = META_UPGRADES.find(u => u.id === id);
    return u ? u.base_cost + u.cost_inc * this.rank(id) : 999;
  }

  canBuy(id) {
    const u = META_UPGRADES.find(u => u.id === id);
    if (!u) return false;
    return this.rank(id) < u.max_rank && this.legacyPoints >= this.cost(id);
  }

  buy(id) {
    if (!this.canBuy(id)) return false;
    this.legacyPoints -= this.cost(id);
    this.upgrades[id] = this.rank(id) + 1;
    this.save();
    return true;
  }

  setFirstClear() {
    this.firstClear = true;
    this.save();
  }

  completeChallenge(id) {
    this.challengesCompleted[id] = true;
    this.save();
  }

  isChallengeComplete(id) {
    return !!this.challengesCompleted[id];
  }

  allChallengesComplete() {
    return CHALLENGES.every(c => this.challengesCompleted[c.id]);
  }

  recordRun(floor, kills, victory = false) {
    this.totalRuns++;
    this.totalKills += kills;
    if (floor > this.bestFloor) this.bestFloor = floor;
    let points = floor * 3 + kills;
    if (floor >= 5) points += 10;
    if (floor >= 10) points += 20;
    if (floor >= 15) points += 30;
    if (victory) points += 100;
    this.legacyPoints += points;
    this.save();
    return points;
  }
}

// ===================== GAME =====================
class Game {
  constructor(meta, challenge = null, options = {}) {
    this.meta = meta || new MetaProgress();
    this.challenge = challenge;
    this.allowChallengeNeutrals = !!options.allowChallengeNeutrals;
    this.level = 0;
    this.kills = 0;
    this.won = false;
    this.strongestEnemy = { max_hp: 0, atk_min: 0, atk_max: 0 };

    const bonusHp = this.meta.rank("max_hp") * 5;
    const baseHp = 65 + bonusHp;
    this.player = {
      max_hp: baseHp, hp: baseHp, block: 0,
      armor: this.meta.rank("start_armor"),
      strength: this.meta.rank("start_str"),
      weak: 0, vuln: 0, song_block: 0
    };
    this.energy = 3;
    this.nextEnergy = 0;
    this.drawPile = [];
    this.discard = [];
    this.hand = [];
    this.exhaust = [];
    this.log = "Welcome, hero!";
    this.enemy = null;
    this.enemyIntent = { type: "attack", value: 6 };
    this.baseHandsize = 5 + this.meta.rank("card_draw");
    this.handsize = this.baseHandsize;
    this.inReward = false;
    this.rewardChoices = [];
    this.rewardType = "card";
    this.gold = this.meta.rank("start_gold") * 15;
    this.inShop = false;
    this.shopItems = [];
    this.relics = [];
    this.potions = [];
    this.maxPotions = 3 + this.meta.rank("potion_slot");
    this.healOnWinBonus = this.meta.rank("heal_on_win") * 3;
    this.damageTakenThisCombat = 0;
    this.drawPenalty = 0;
    this.attacksPlayed = 0;
    this.turnNumber = 0;
    this.rampageBonus = {};
    this.revealedIntents = [];
    this.dead = false;

    // Starting potion from meta (suppressed by No Potion challenge)
    if (this.meta.rank("start_potion") > 0 && !(this.challenge && this.challenge.id === "no_potion")) {
      this.potions.push({ ...POTIONS[Math.floor(Math.random() * POTIONS.length)] });
    }

    // No Healing challenge: suppress all heal-on-win bonuses
    if (this.challenge && this.challenge.id === "no_healing") {
      this.healOnWinBonus = 0;
    }

    // Starting deck
    const startNames = [
      "Strike", "Strike", "Strike", "Strike", "Strike",
      "Defend", "Defend", "Defend", "Defend",
      "Lunge", "Expose", "Focus"
    ];
    this.deck = startNames.map(n => ({ ...CARD_DB[n] }));
    this.shuffle(this.deck);
    this.drawPile = this.deck.map(c => ({ ...c }));
    this.discard = [];
    this.exhaust = [];
    this.nextEnemy();
  }

  // ---- Utilities ----
  randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } }

  clamp() { this.player.hp = Math.max(0, Math.min(this.player.hp, this.player.max_hp)); }

  changeEnergy(d) { this.energy = Math.max(0, this.energy + d); }
  addNextEnergy(n) { this.nextEnergy += n; }

  selfDamage(n) {
    this.player.hp -= n;
    this.damageTakenThisCombat += n;
    this.clamp();
  }

  hasRelic(name) { return this.relics.some(r => r.name === name); }

  dealDamage(amount, source = "You") {
    if (source === "You") {
      amount += this.player.strength;
      if (this.hasRelic("Red Skull") && this.player.hp < this.player.max_hp * 0.5) amount += 3;
      if (this.player.weak > 0) amount = Math.floor(amount * 0.75);
      if (this.hasRelic("Pen Nib") && this.attacksPlayed > 0 && this.attacksPlayed % 10 === 0) amount *= 2;
    }
    if (this.enemy.vuln > 0 && source === "You") amount = Math.floor(amount * 1.5);
    amount = Math.max(0, amount);
    // Stone Skin: attacks dealing low damage (before block) are reduced to 1
    if (source === "You" && this.enemy.special === "stone_skin" && amount > 0) {
      const lvl = this.level;
      const threshold = Math.floor(5 * (lvl <= 40 ? 1.0 + 0.05 * lvl : 3.0 + 0.1 * (lvl - 40)));
      if (amount <= threshold) amount = 1;
    }
    if (this.enemy.block > 0) {
      const absorb = Math.min(this.enemy.block, amount);
      this.enemy.block -= absorb;
      amount -= absorb;
    }
    this.enemy.hp -= amount;
    if (source === "You" && this.enemy.special === "thorns") {
      this.player.hp -= 2;
      this.clamp();
    }
    return amount;
  }

  gainBlock(n) {
    n += this.player.armor;
    this.player.block += n;
    if (this.player.juggernaut > 0 && this.enemy) {
      this.enemy.hp -= this.player.juggernaut;
    }
  }

  heal(n) {
    if (this.challenge && this.challenge.id === "no_healing") return;
    this.player.hp += n; this.clamp();
  }

  draw(n) {
    for (let i = 0; i < n; i++) {
      if (this.drawPile.length === 0) {
        if (this.discard.length === 0) break;
        this.shuffle(this.discard);
        this.drawPile = this.discard;
        this.discard = [];
      }
      this.hand.push(this.drawPile.pop());
    }
  }

  applyVuln(n) { this.enemy.vuln += n; }
  applyWeak(n) { this.enemy.weak += n; }

  discardOrExhaust(card) {
    if (card.text && card.text.includes("Exhaust.")) {
      this.exhaust.push(card);
    } else {
      this.discard.push(card);
    }
  }

  negateEnemyAttack(n) {
    if (this.enemyIntent.type === "attack") {
      this.enemyIntent.value = Math.max(0, this.enemyIntent.value - n);
    }
  }

  revealIntents(n) {
    this.revealedIntents = [];
    for (let i = 0; i < n; i++) {
      if (Math.random() < this.enemy.block_chance) {
        this.revealedIntents.push({ type: "block", value: this.enemyBlockValue() });
      } else {
        this.revealedIntents.push({ type: "attack", value: this.randInt(this.enemy.atk_min, this.enemy.atk_max) });
      }
    }
  }

  usePotion(idx) {
    if (this.challenge && this.challenge.id === "no_potion") { this.log = "Potions are forbidden in this challenge!"; return; }
    if (idx < 0 || idx >= this.potions.length || this.inReward) return;
    const p = this.potions.splice(idx, 1)[0];
    // Scale numeric potion values with floor (10% per floor)
    const potionScale = 1.0 + 0.1 * this.level;
    const sv = (v) => Math.floor(v * potionScale);
    switch (p.action) {
      case "damage": { const v = sv(p.value); this.dealDamage(v, "You"); this.log = `Used ${p.name}: ${v} damage!`; break; }
      case "block": { const v = sv(p.value); this.gainBlock(v); this.log = `Used ${p.name}: +${v} block!`; break; }
      case "strength": {
        const v = Math.max(p.value, sv(p.value));
        this.player.strength += v;
        // Track temporary potion STR so it can be removed between combats
        // (permanent in region challenges that lack strength cards)
        if (!this._regionLacksStrengthCards()) {
          this.player.potionStr = (this.player.potionStr || 0) + v;
        }
        this.log = `Used ${p.name}: +${v} STR!`;
        break;
      }
      case "draw": { this.draw(p.value); this.log = `Used ${p.name}: drew ${p.value}!`; break; }
      case "vuln": { const v = Math.max(p.value, sv(p.value)); this.applyVuln(v); this.log = `Used ${p.name}: ${v} Vulnerable!`; break; }
      case "weak": { const v = Math.max(p.value, sv(p.value)); this.applyWeak(v); this.log = `Used ${p.name}: ${v} Weak!`; break; }
      case "heal": { const v = sv(p.value); this.heal(v); this.log = `Used ${p.name}: healed ${v}!`; break; }
      case "energy": { this.changeEnergy(p.value); this.log = `Used ${p.name}: +${p.value} energy!`; break; }
    }
    if (this.enemy && this.enemy.hp <= 0) { this.winBattle(); return; }
  }

  // ---- Card Effects ----
  executeCardEffect(card) {
    const k = card.effectKey;
    switch (k) {
      case "atk6": return `Deal ${this.dealDamage(6, "You")}.`;
      case "block5": this.gainBlock(5); return "Gain 5 block.";
      case "lunge": this.dealDamage(4, "You"); this.draw(1); return "Hit 4, drew 1.";
      case "draw2": this.draw(2); return "Drew 2.";
      case "vuln1": this.applyVuln(1); return "Enemy is Vulnerable for 1 turn.";
      case "weak1": this.applyWeak(1); return "Enemy is Weakened for 1 turn.";
      case "weak2": this.applyWeak(2); return "Enemy is Weakened for 2 turns.";
      case "fortify": this.player.armor += 2; return "+2 armor (persists).";
      case "rally": this.player.strength += 2; return "+2 strength (persists).";
      case "adrenalineRush": {
        this.changeEnergy(2); this.draw(2);
        if (this.hand.length > 0) { const i = Math.floor(Math.random() * this.hand.length); const c = this.hand.splice(i, 1)[0]; this.exhaust.push(c); }
        return "+2 energy, drew 2. Exhausted a card.";
      }
      case "bloodPact": this.selfDamage(3); this.dealDamage(12, "You"); return "Blood for power: 12 dmg!";
      case "block16": this.gainBlock(16); return "Gain 16 block.";
      case "offering": {
        this.selfDamage(6); this.changeEnergy(2); this.draw(3);
        if (this.hand.length > 0) { const i = Math.floor(Math.random() * this.hand.length); const c = this.hand.splice(i, 1)[0]; this.exhaust.push(c); }
        return "Sacrifice: +2 energy, drew 3. Exhausted a card.";
      }
      case "shockwave": this.applyWeak(3); this.applyVuln(3); return "Shockwave: 3 Weak + 3 Vuln!";
      case "atk9": return `Deal ${this.dealDamage(9, "You")}.`;
      case "atk14": return `Deal ${this.dealDamage(14, "You")}.`;
      case "block7": this.gainBlock(7); return "Gain 7 block.";
      case "block12": this.gainBlock(12); return "Gain 12 block.";
      case "ankouScythe": this.dealDamage(10, "You"); this.enemy.vuln += 1; return "Scythe: 10 + 1 Vuln";
      case "korriganTrick": this.draw(1); this.changeEnergy(1); return "Drew 1, +1 energy.";
      case "tarasqueRoar": this.applyVuln(2); this.draw(1); return "Roar: 2 Vuln, drew 1.";
      case "dracCamargue": { const d = 7 + (this.enemy.vuln > 0 ? 4 : 0); this.dealDamage(d, "You"); return `Drac bites for ${d}.`; }
      case "santonsBlessing": this.gainBlock(6); this.heal(2); return "Blessed: +6 block, heal 2.";
      case "mauvaisPas": this.dealDamage(5, "You"); this.enemy.weak += 1; return "Slip: 5 + 1 Weak";
      case "dahuSidestep": this.gainBlock(4); this.draw(1); return "Sidestep +4 block, drew 1.";
      case "avalancheChant": this.negateEnemyAttack(8); return "Snow muffles claws.";
      case "loupAlpes": { const d = 6 + (this.enemy.weak > 0 ? 3 : 0); this.dealDamage(d, "You"); return `Wolf tears for ${d}.`; }
      case "volcanBreath": this.player.strength += 1; this.enemy.vuln += 1; return "+1 STR, +1 Vuln";
      case "melusineVeil": this.gainBlock(5); this.addNextEnergy(1); return "Veil: +5 block, +1 energy next turn.";
      case "gargantuaStep": this.dealDamage(9, "You"); this.draw(1); return "Stomp for 9; drew 1.";
      case "chateauRuse": this.applyWeak(1); this.applyVuln(1); return "Cunning: 1 Weak + 1 Vuln.";
      case "bayardHoofbeat": this.dealDamage(4, "You"); this.dealDamage(4, "You"); return "Hoofbeat 4x2.";
      case "louPastreBallad": this.player.song_block += 2; return "Ballad: +2 block at start of turn.";
      case "feesOrb": this.heal(3); this.draw(1); return "Fairies: heal 3, drew 1.";
      case "catharResolve": this.gainBlock(9); this.player.weak = Math.max(0, this.player.weak - 1); return "Resolve: +9 block; cleansed 1 Weak.";
      case "mazzeruVision": this.revealIntents(2); this.draw(1); return "The mazzeru sees what comes...";
      case "storkBlessing": this.heal(4); this.gainBlock(4); return "Stork brings good fortune: heal 4, +4 block.";
      case "hansTrapFury": this.dealDamage(8, "You"); this.applyWeak(2); return "Hans Trapp rages: 8 dmg + 2 Weak!";
      case "rhineGold": this.changeEnergy(1); this.gainBlock(3); return "Golden light: +1 energy, +3 block.";
      case "gallicResolve": this.player.armor += 1; this.applyWeak(1); return "Gallic Resolve: +1 armor, 1 Weak!";
      case "demonForm": this.player.demonForm = (this.player.demonForm || 0) + 2; return "Demon Form: +2 STR each turn!";
      case "armureLions": this.player.armor += 3; return "Armure aux Lions: +3 permanent armor!";
      case "juggernaut": this.player.juggernaut = (this.player.juggernaut || 0) + 3; return "Juggernaut: 3 dmg on block gain!";
      case "flameBarrier": this.player.flameBarrier = (this.player.flameBarrier || 0) + 4; return "Flame Barrier: 4 dmg on hit!";
      default: return card.text;
    }
  }

  // ---- Turn Flow ----
  nextEnemy() {
    // Floor 50: spawn the final boss
    if (this.level === 50) {
      this._spawnFinalBoss();
      return;
    }

    let tier = 1;
    if (this.level >= 3) tier = 2;
    if (this.level >= 6) tier = 3;
    if (this.level >= 9) tier = 4;

    const candidates = ENEMIES.filter(e => e.tier <= tier);
    const weights = candidates.map(e => e.tier * e.tier);
    const totalW = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * totalW;
    let template = candidates[0];
    for (let i = 0; i < candidates.length; i++) {
      r -= weights[i];
      if (r <= 0) { template = candidates[i]; break; }
    }
    template = { ...template };

    const lvl = this.level;
    let scale;
    if (lvl <= 40) {
      scale = 1.0 + 0.1 * lvl;
    } else {
      const over = lvl - 40;
      scale = 5.0 + 0.2 * over + 0.015 * over * over;
    }
    template.max_hp = Math.floor(template.max_hp * scale);
    template.atk_min = Math.floor(template.atk_min * scale);
    template.atk_max = Math.floor(template.atk_max * scale);

    // Elite encounter at floors 4, 7, 10, 13... (every 3 starting at 4)
    const isElite = this.level >= 4 && (this.level - 4) % 3 === 0;
    if (isElite) {
      template.max_hp = Math.floor(template.max_hp * 1.5);
      template.atk_min = Math.floor(template.atk_min * 1.3);
      template.atk_max = Math.floor(template.atk_max * 1.3);
    }

    this.enemy = {
      ...template,
      hp: template.max_hp, block: 0, vuln: 0, weak: 0, enrage_stacks: 0,
      lore: template.lore || null, elite: isElite
    };

    // Track strongest enemy for final boss scaling
    if (template.max_hp > this.strongestEnemy.max_hp) this.strongestEnemy.max_hp = template.max_hp;
    if (template.atk_min > this.strongestEnemy.atk_min) this.strongestEnemy.atk_min = template.atk_min;
    if (template.atk_max > this.strongestEnemy.atk_max) this.strongestEnemy.atk_max = template.atk_max;

    this._resetCombatState();

    if (this.hasRelic("Bag of Marbles")) this.enemy.vuln += 1;

    this.inReward = false;
    this.startPlayerTurn();
    this.pickEnemyIntent();
    this.log = isElite ? `An ELITE ${this.enemy.name} appears!` : `A ${this.enemy.name} appears!`;
  }

  _resetCombatState() {
    this.damageTakenThisCombat = 0;
    this.drawPenalty = 0;
    this.player.song_block = 0;
    this.player.strength -= (this.player.demonFormStr || 0);
    this.player.strength -= (this.player.potionStr || 0);
    this.player.demonForm = 0;
    this.player.demonFormStr = 0;
    this.player.potionStr = 0;
    this.player.juggernaut = 0;
    this.player.flameBarrier = 0;
    this.player.vuln = 0;
    this.player.weak = 0;
    this.handsize = this.baseHandsize + (this.hasRelic("Sight of the Mazzeri") ? 1 : 0);
    this.turnNumber = 0;
    this.revealedIntents = [];
    this.rampageBonus = {};
  }

  _spawnFinalBoss() {
    const s = this.strongestEnemy;
    const hp = Math.max(s.max_hp * 2, 200);
    const atkMin = Math.max(s.atk_min * 2, 20);
    const atkMax = Math.max(s.atk_max * 2, 30);

    this.enemy = {
      name: FINAL_BOSS_TEMPLATE.name,
      max_hp: hp, hp: hp,
      atk_min: atkMin, atk_max: atkMax,
      block: 0, vuln: 0, weak: 0,
      block_chance: FINAL_BOSS_TEMPLATE.block_chance,
      special: FINAL_BOSS_TEMPLATE.special,
      tier: FINAL_BOSS_TEMPLATE.tier,
      elite: false, enrage_stacks: 0,
      lore: FINAL_BOSS_TEMPLATE.lore,
      isFinalBoss: true
    };

    this._resetCombatState();

    if (this.hasRelic("Bag of Marbles")) this.enemy.vuln += 1;

    this.inReward = false;
    this.startPlayerTurn();
    this.pickEnemyIntent();
    this.log = "L'OMBRE SOUVERAINE awakens! The final legend awaits!";
  }

  startPlayerTurn() {
    this.turnNumber++;
    this.energy = 3 + this.nextEnergy;
    this.nextEnergy = 0;
    // Retain 25% of block between turns (Endurance)
    this.player.block = Math.floor(this.player.block * 0.25);
    if (this.player.song_block > 0) this.player.block += this.player.song_block;
    if (this.hasRelic("Anchor") && this.turnNumber === 1) this.player.block += 10;
    if (this.player.demonForm > 0) { this.player.strength += this.player.demonForm; this.player.demonFormStr = (this.player.demonFormStr || 0) + this.player.demonForm; }
    this.attacksThisTurn = 0;
    this.skillsThisTurn = 0;
    if (this.hasRelic("Horn Cleat") && this.turnNumber === 2) this.energy += 1;
    // Nightmare draw penalty
    const drawAmount = Math.max(1, this.handsize - (this.drawPenalty || 0));
    this.drawPenalty = 0;
    this.draw(drawAmount);
  }

  endPlayerTurn() {
    if (this.hasRelic("Orichalcum") && this.player.block === 0) this.player.block += 6;

    this.enemyAct();
    this.tickStatus();
    this.discard.push(...this.hand);
    this.hand = [];

    if (this.enemy.hp <= 0) { this.winBattle(); return; }
    if (this.player.hp <= 0) { this.loseGame(); return; }

    this.startPlayerTurn();
    this.pickEnemyIntent();
  }

  tickStatus() {
    if (this.enemy.vuln > 0) this.enemy.vuln--;
    if (this.enemy.weak > 0) this.enemy.weak--;
    if (this.player.weak > 0) this.player.weak--;
    if (this.player.vuln > 0) this.player.vuln--;
  }

  enemyBlockValue() {
    const base = this.randInt(6, 10);
    const lvl = this.level;
    const scale = lvl <= 40 ? 1.0 + 0.05 * lvl : 3.0 + 0.1 * (lvl - 40);
    return Math.floor(base * scale);
  }

  pickEnemyIntent() {
    if (Math.random() < this.enemy.block_chance) {
      this.enemyIntent = { type: "block", value: this.enemyBlockValue() };
    } else {
      const val = this.randInt(this.enemy.atk_min, this.enemy.atk_max);
      const special = this.enemy.special;
      if (special === "sovereign") {
        if (Math.random() < 0.3) {
          this.enemyIntent = { type: "attack", value: Math.floor(val * 0.6), hits: 3 };
        } else {
          this.enemyIntent = { type: "attack", value: val, hits: 1 };
        }
      } else if (special === "multi_hit") {
        this.enemyIntent = { type: "attack", value: Math.floor(val / 2), hits: 2 };
      } else if (special === "crush" && Math.random() < 0.3) {
        this.enemyIntent = { type: "attack", value: Math.floor(val * 1.5), hits: 1 };
      } else {
        this.enemyIntent = { type: "attack", value: val, hits: 1 };
      }
    }
  }

  enemyAct() {
    const special = this.enemy.special;
    // Auto-block: Jean de l'Ours gains cycling block each turn
    if (special === "auto_block") {
      const cycle = [3, 4, 5, 6];
      const ab = cycle[(this.turnNumber - 1) % cycle.length];
      this.enemy.block += ab;
      this.log = `${this.enemy.name} braces with bear-strength (+${ab} block). `;
    }
    if (this.enemyIntent.type === "attack") {
      const hits = this.enemyIntent.hits || 1;
      let total = 0;
      for (let h = 0; h < hits; h++) {
        let dmg = this.enemyIntent.value;
        if (this.enemy.weak > 0) dmg = Math.floor(dmg * 0.75);
        dmg += (this.enemy.enrage_stacks || 0);
        if (special === "pack_hunter" && this.player.block === 0) dmg += 3;
        if (this.player.vuln > 0) dmg = Math.floor(dmg * 1.5);
        if (this.hasRelic("Torii") && dmg <= 5 && dmg > 0) dmg = 1;
        if (this.player.block > 0) {
          const ab = Math.min(this.player.block, dmg);
          this.player.block -= ab;
          dmg -= ab;
        }
        const actual = Math.max(0, dmg);
        this.player.hp -= actual;
        this.damageTakenThisCombat += actual;
        total += actual;
        if (special === "life_drain") {
          this.enemy.hp = Math.min(this.enemy.max_hp, this.enemy.hp + Math.floor(actual / 2));
        }
        if (special === "sovereign") {
          this.enemy.hp = Math.min(this.enemy.max_hp, this.enemy.hp + Math.floor(actual / 3));
        }
        if (actual > 0 && this.player.flameBarrier > 0) {
          this.enemy.hp -= this.player.flameBarrier;
        }
      }
      this.clamp();
      const hitText = hits > 1 ? ` x${hits}` : "";
      this.log = `${this.enemy.name} strikes for ${this.enemyIntent.value}${hitText}.`;
    } else {
      this.enemy.block += this.enemyIntent.value;
      this.log = `${this.enemy.name} braces (+${this.enemyIntent.value} block).`;
    }

    if (special === "steal_energy" && Math.random() < 0.3) {
      this.nextEnergy -= 1;
      this.log += " Drains your energy! (-1 energy next turn)";
    }
    if (special === "weaken_player" && Math.random() < 0.4) {
      this.player.weak += 1;
      this.log += " Applied 1 Weak!";
    }
    if (special === "regen") {
      const ra = Math.max(2, Math.floor(this.enemy.max_hp * 0.04));
      this.enemy.hp = Math.min(this.enemy.max_hp, this.enemy.hp + ra);
      this.log += ` Regenerated ${ra}.`;
    }
    if (special === "enrage") {
      this.enemy.enrage_stacks = (this.enemy.enrage_stacks || 0) + 1;
      this.log += ` Enraged! (+${this.enemy.enrage_stacks} dmg)`;
    }
    if (special === "summon_hounds" && this.turnNumber % 3 === 0) {
      this.player.hp -= 4;
      this.clamp();
      this.log += " Hounds bite for 4!";
    }
    if (special === "mirror" && Math.random() < 0.25) {
      this.enemy.block += 8;
      this.log += " Mirror: +8 block!";
    }
    if (special === "trickster" && Math.random() < 0.35) {
      const trick = Math.floor(Math.random() * 3);
      if (trick === 0) {
        this.player.weak += 1;
        this.log += " Renard's trick: 1 Weak!";
      } else if (trick === 1) {
        this.enemy.block += 6;
        this.log += " Renard dodges behind cover (+6 block)!";
      } else {
        if (this.drawPile.length > 0) {
          const stolen = this.drawPile.splice(Math.floor(Math.random() * this.drawPile.length), 1)[0];
          this.exhaust.push(stolen);
          this.log += ` Renard snatches ${stolen.name} from your deck!`;
        }
      }
    }
    if (special === "venom") {
      const vdmg = 3 + Math.floor(this.turnNumber);
      this.player.hp -= vdmg;
      this.clamp();
      this.log += ` Vouivre's venom burns for ${vdmg}!`;
    }
    if (special === "nightmare" && Math.random() < 0.30) {
      this.drawPenalty = (this.drawPenalty || 0) + 1;
      this.log += " Nightmare! Draw 1 fewer card next turn.";
    }
    if (special === "pack_hunter") {
      // Bonus damage already dealt above if player had 0 block at start of attack
      // Handled in the attack loop via packHunterBonus flag
    }
    if (special === "petrify" && Math.random() < 0.25) {
      this.player.weak += 1;
      this.player.vuln = (this.player.vuln || 0) + 1;
      this.log += " Petrifying gaze! +1 Weak, +1 Vulnerable!";
    }
    if (special === "soul_drain") {
      this.player.max_hp = Math.max(10, this.player.max_hp - 2);
      if (this.player.hp > this.player.max_hp) this.player.hp = this.player.max_hp;
      this.log += " Soul drained! Max HP -2.";
    }
    if (special === "sovereign") {
      // Enrage: +2 per turn
      this.enemy.enrage_stacks = (this.enemy.enrage_stacks || 0) + 2;
      this.log += ` Shadow deepens! (+${this.enemy.enrage_stacks} dmg)`;
      // Soul crush every 2 turns
      if (this.turnNumber % 2 === 0) {
        this.player.max_hp = Math.max(10, this.player.max_hp - 3);
        if (this.player.hp > this.player.max_hp) this.player.hp = this.player.max_hp;
        this.log += " Soul crushed! Max HP -3.";
      }
      // Shadow hounds every 3 turns
      if (this.turnNumber % 3 === 0) {
        const houndDmg = 6;
        this.player.hp -= houndDmg;
        this.clamp();
        this.log += ` Shadow hounds strike for ${houndDmg}!`;
      }
      // Auto-block each turn (scaling)
      const ab = 5 + this.turnNumber * 2;
      this.enemy.block += ab;
    }
  }

  playCard(idx) {
    if (this.inReward || this.dead) return;
    if (idx < 0 || idx >= this.hand.length) return;
    const card = this.hand[idx];
    if (card.cost > this.energy) { this.log = "Not enough energy."; return; }

    const played = this.hand.splice(idx, 1)[0];
    this.energy -= played.cost;
    if (played.type === "Attack") this.attacksPlayed++;
    if (played.type === "Attack") this.attacksThisTurn++;
    if (played.type === "Skill") this.skillsThisTurn++;

    // Special cards
    if (played.effectKey === "dameBlanche") {
      const top = this.drawPile.slice(-2).reverse();
      this.discardOrExhaust(played);
      this.log = "Dame Blanche — Scry 2.";
      this._scryCards = top;
      return;
    }
    if (played.effectKey === "forestAmbush") {
      if (this.enemyIntent.type === "attack") { this.gainBlock(8); this.log = "Ambush: +8 block."; }
      else this.log = "Ambush fizzles.";
      this.discardOrExhaust(played);
      return;
    }
    if (played.effectKey === "smugglersWile") {
      this.draw(2);
      if (this.hand.length > 0) this.discard.push(this.hand.pop());
      this.discardOrExhaust(played);
      this.log = "Wile: drew 2, discarded last.";
      return;
    }
    if (played.effectKey === "whirlwind") {
      const times = Math.max(1, this.energy);
      this.energy = 0;
      for (let i = 0; i < times; i++) this.dealDamage(4, "You");
      this.discardOrExhaust(played);
      this.log = `Whirlwind: 4 damage x${times}!`;
      if (this.enemy.hp <= 0) { this.winBattle(); return; }
      return;
    }
    if (played.effectKey === "secondWind") {
      const n = this.hand.length;
      this.gainBlock(3 * n);
      this.discardOrExhaust(played);
      this.log = `Second Wind: +${3 * n} block (${n} cards)!`;
      return;
    }
    if (played.effectKey === "rampage") {
      const bonus = this.rampageBonus["Rampage"] || 0;
      const baseDmg = 8 + bonus;
      this.dealDamage(baseDmg, "You");
      this.rampageBonus["Rampage"] = bonus + 4;
      this.discardOrExhaust(played);
      this.log = `Rampage: ${baseDmg} damage.`;
      if (this.enemy.hp <= 0) { this.winBattle(); return; }
      return;
    }
    if (played.effectKey === "bodySlam") {
      const dmg = this.player.block;
      this.dealDamage(dmg, "You");
      this.discardOrExhaust(played);
      this.log = `Body Slam: ${dmg} damage (from block)!`;
      if (this.enemy.hp <= 0) { this.winBattle(); return; }
      return;
    }
    if (played.effectKey === "vendettaStrike") {
      const bonus = this.damageTakenThisCombat * 2;
      this.dealDamage(5 + bonus, "You");
      this.discardOrExhaust(played);
      this.log = `Vendetta: ${5 + bonus} damage (${this.damageTakenThisCombat} dmg taken)!`;
      if (this.enemy.hp <= 0) { this.winBattle(); return; }
      return;
    }
    if (played.effectKey === "maquisAmbush") {
      if (this.enemyIntent.type === "attack") {
        this.dealDamage(8, "You");
        this.log = "Maquis Ambush: 8 damage!";
      } else {
        this.dealDamage(3, "You");
        this.log = "Maquis Ambush: 3 damage.";
      }
      this.discardOrExhaust(played);
      if (this.enemy.hp <= 0) { this.winBattle(); return; }
      return;
    }

    // Combo cards
    if (played.effectKey === "botteDeNevers") {
      this.dealDamage(5, "You");
      const extras = this.skillsThisTurn;
      for (let i = 0; i < extras; i++) this.dealDamage(4, "You");
      this.discardOrExhaust(played);
      this.log = extras > 0 ? `Botte de Nevers: 5 + ${extras}x4 damage! (${extras} Skills)` : `Botte de Nevers: 5 damage.`;
      if (this.enemy.hp <= 0) { this.winBattle(); return; }
      return;
    }
    if (played.effectKey === "rempartVauban") {
      const extras = this.attacksThisTurn;
      const total = 4 + extras * 3;
      this.gainBlock(total);
      this.discardOrExhaust(played);
      this.log = extras > 0 ? `Rempart de Vauban: +${total} block! (${extras} Attacks)` : `Rempart de Vauban: +4 block.`;
      return;
    }
    if (played.effectKey === "ruseRenart") {
      if (this.enemyIntent.type === "block") {
        this.applyVuln(1);
        this.dealDamage(8, "You");
        this.log = "Ruse de Renart: 1 Vulnerable, then 8 damage! (combo)";
      } else {
        this.dealDamage(2, "You");
        this.log = "Ruse de Renart: 2 damage.";
      }
      this.discardOrExhaust(played);
      if (this.enemy.hp <= 0) { this.winBattle(); return; }
      return;
    }
    if (played.effectKey === "enchainement") {
      const triggered = this.attacksThisTurn >= 3; // this card is the 3rd+ attack
      if (triggered) { this.dealDamage(9, "You"); this.draw(1); this.log = "Enchaînement: 9 damage, drew 1! (combo)"; }
      else { this.dealDamage(3, "You"); this.log = "Enchaînement: 3 damage."; }
      this.discardOrExhaust(played);
      if (this.enemy.hp <= 0) { this.winBattle(); return; }
      return;
    }

    // Normal effect
    const msg = this.executeCardEffect(played);
    this.discardOrExhaust(played);
    this.log = msg || played.text;
    if (this.enemy.hp <= 0) { this.winBattle(); return; }
  }

  // Scry helpers
  scryDiscardAll() {
    if (!this._scryCards) return;
    for (let i = 0; i < this._scryCards.length; i++) {
      if (this.drawPile.length > 0) this.discard.push(this.drawPile.pop());
    }
    this._scryCards = null;
    this.log = "Discarded scryed cards.";
  }
  scryKeepAll() {
    this._scryCards = null;
    this.log = "Kept scryed cards.";
  }
  scryDiscardFirst() {
    if (this.drawPile.length > 0) this.discard.push(this.drawPile.pop());
    this._scryCards = null;
    this.log = "Discarded first.";
  }

  winBattle() {
    this.inReward = true;
    this.level++;
    this.kills++;
    this.player.block = 0;
    this.enemyIntent = { type: "none", value: 0 };

    // Check if we just beat the final boss
    if (this.enemy && this.enemy.isFinalBoss) {
      this._winGame();
      return;
    }

    let healAmt = 6 + this.healOnWinBonus;
    if (this.hasRelic("Burning Blood")) healAmt += 8;
    if (this.hasRelic("Meat on Bone") && this.player.hp < this.player.max_hp * 0.5) healAmt += 12;
    this.heal(healAmt);

    this.saveRun();

    const eliteBonus = this.enemy.elite ? 25 : 0;
    const goldGain = this.randInt(10, 25) + this.level * 2 + eliteBonus;
    this.gold += goldGain;

    // Elite victory: guaranteed relic reward
    if (this.enemy.elite) {
      const available = RELICS.filter(r => !this.hasRelic(r.name));
      if (available.length > 0) {
        this.rewardType = "relic";
        this.rewardChoices = this._sample(available, 3).map(r => ({ ...r }));
        this.log = `Elite vanquished! +${goldGain} gold. Choose a relic!`;
        return;
      }
    }

    // On scaling floors, always offer card rewards (so the scaling card appears)
    if (this._isScalingFloor()) {
      this._cardReward(goldGain);
    } else {
      const roll = Math.random();
      if (roll < 0.15 && this.potions.length < this.maxPotions && !(this.challenge && this.challenge.id === "no_potion")) {
        this.rewardType = "potion";
        this.rewardChoices = this._sample(POTIONS, 3).map(p => ({ ...p }));
        this.log = `Victory! +${goldGain} gold. Choose a potion.`;
      } else if (roll < 0.25 && this.level % 3 === 0) {
        this.rewardType = "relic";
        const available = RELICS.filter(r => !this.hasRelic(r.name));
        if (available.length > 0) {
          this.rewardChoices = this._sample(available, 3).map(r => ({ ...r }));
          this.log = `Victory! +${goldGain} gold. Choose a relic!`;
        } else {
          this._cardReward(goldGain);
        }
      } else {
        this._cardReward(goldGain);
      }
    }
  }

  _sample(arr, k) {
    const copy = [...arr];
    const result = [];
    for (let i = 0; i < Math.min(k, copy.length); i++) {
      const idx = Math.floor(Math.random() * copy.length);
      result.push(copy.splice(idx, 1)[0]);
    }
    return result;
  }

  _regionLacksStrengthCards() {
    if (!this.challenge || !this.challenge.region) return false;
    const STR_CARDS = ["Rally", "Volcan's Breath", "Rage du Diable"];
    return !this.challenge.regionCards.some(c => STR_CARDS.includes(c));
  }

  _isScalingFloor() {
    const SCALING_CARDS = ["Rally", "Fortify", "Volcan's Breath", "Gallic Resolve", "Rage du Diable"];
    const floor = this.level;
    // Base: floors 5, 8, 11, 14... (every 3 starting at 5)
    let isScaling = floor >= 5 && (floor - 5) % 3 === 0;
    // Legacy: Warrior's Path rank 1 = also floor 2, rank 2 = also floor 1
    const wpRank = this.meta.rank("scaling_floor");
    if (wpRank >= 1 && floor === 2) isScaling = true;
    if (wpRank >= 2 && floor === 1) isScaling = true;
    return isScaling ? SCALING_CARDS : null;
  }

  _cardReward(goldGain) {
    this.rewardType = "card";

    let pool;
    let regionLabel;

    if (this.challenge && this.challenge.region) {
      // Region-only challenge: only cards from that region
      // (optionally augmented with a few staple neutrals)
      pool = [...this.challenge.regionCards];
      if (this.allowChallengeNeutrals) pool.push(...CHALLENGE_NEUTRAL_CARDS);
      regionLabel = this.challenge.region;
    } else {
      const regionKeys = Object.keys(REGIONS);
      const region = regionKeys[Math.floor(Math.random() * regionKeys.length)];
      pool = [...REGIONS[region]];
      pool.push("Lunge", "Expose", "Focus", "Hamper", "Fortify", "Rally",
        "Cleave", "Blood Pact", "Perfect Guard", "Body Slam", "Second Wind",
        "Gallic Resolve", "Armure aux Lions", "Jeanne's Pyre",
        "Botte de Nevers", "Enchaînement", "Rempart de Vauban", "Ruse de Renart");
      if (this.level >= 3) pool.push("Whirlwind", "Rampage", "Shockwave", "Fureur de Woinic");
      if (this.level >= 5) pool.push("Vendetta Strike", "Adrenaline Rush", "Offering", "Rage du Diable");
      regionLabel = region;
    }

    // Remove scaling cards from main pool so we control their placement
    const scalingPool = this._isScalingFloor();
    if (scalingPool) {
      // For region-only, only inject scaling cards that belong to this region
      // (and possibly the neutral pool, if allowed)
      const effectiveScaling = (this.challenge && this.challenge.region)
        ? scalingPool.filter(n => this.challenge.regionCards.includes(n)
            || (this.allowChallengeNeutrals && CHALLENGE_NEUTRAL_CARDS.includes(n)))
        : scalingPool;
      pool = pool.filter(n => !scalingPool.includes(n));

      const unique = [...new Set(pool)];
      const choices = this._sample(unique, effectiveScaling.length > 0 ? 2 : 3);

      if (effectiveScaling.length > 0) {
        const pick = effectiveScaling[Math.floor(Math.random() * effectiveScaling.length)];
        choices.push(pick);
        for (let i = choices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [choices[i], choices[j]] = [choices[j], choices[i]];
        }
      }

      this.rewardChoices = choices.filter(n => CARD_DB[n]).map(n => ({ ...CARD_DB[n] }));
    } else {
      const unique = [...new Set(pool)];
      const choices = this._sample(unique, 3);
      this.rewardChoices = choices.filter(n => CARD_DB[n]).map(n => ({ ...CARD_DB[n] }));
    }

    this.log = `Victory! +${goldGain} gold. Choose a card (${regionLabel}).`;
  }

  takeReward(i) {
    if (!this.inReward) return;
    if (i !== null && i >= 0 && i < this.rewardChoices.length) {
      const choice = this.rewardChoices[i];
      if (this.rewardType === "card") {
        if (this.challenge && this.challenge.id === "deck_limit_15" && this.deck.length >= 15) {
          this.log = "Deck is at maximum size (15 cards)!";
          return;
        }
        this.deck.push({ ...choice });
        this.log = `Added: ${choice.name}.`;
      } else if (this.rewardType === "relic") {
        this.relics.push({ ...choice });
        if (choice.effect === "strength") this.player.strength += choice.value;
        this.log = `Relic: ${choice.name} — ${choice.desc}`;
      } else if (this.rewardType === "potion") {
        if (this.challenge && this.challenge.id === "no_potion") {
          this.log = "Potions are forbidden in this challenge!";
          return;
        }
        if (this.potions.length < this.maxPotions) {
          this.potions.push({ ...choice });
          this.log = `Potion: ${choice.name}.`;
        } else {
          this.log = "Potion inventory full!";
          return;
        }
      }
    } else {
      this.log = "Pass.";
    }
    this.rewardChoices = [];

    if (this.level % 3 === 0 && this.level > 0) {
      this.openShop();
      return;
    }

    this._reshuffleAndNext();
  }

  _reshuffleAndNext() {
    this.hand = [];
    this.discard = [];
    this.exhaust = [];
    this.drawPile = this.deck.map(c => ({ ...c }));
    this.shuffle(this.drawPile);
    this.nextEnemy();
  }

  // ---- Shop ----
  openShop() {
    this.inShop = true;
    this.inReward = false;
    this.rewardChoices = [];
    this.shopItems = [];

    const SCALING_CARDS = ["Rally", "Fortify", "Volcan's Breath", "Gallic Resolve", "Rage du Diable"];

    let cardPool;
    if (this.challenge && this.challenge.region) {
      // Region-only: shop cards from that region (optionally + staple neutrals)
      cardPool = [...this.challenge.regionCards];
      if (this.allowChallengeNeutrals) cardPool.push(...CHALLENGE_NEUTRAL_CARDS);
    } else {
      cardPool = Object.keys(CARD_DB);
    }

    const shopCardNames = this._sample(cardPool.filter(n => !SCALING_CARDS.includes(n)), 4);
    // Guarantee 1 scaling card in every shop (region-filtered if needed)
    const availableScaling = (this.challenge && this.challenge.region)
      ? SCALING_CARDS.filter(n => this.challenge.regionCards.includes(n)
          || (this.allowChallengeNeutrals && CHALLENGE_NEUTRAL_CARDS.includes(n)))
      : SCALING_CARDS;
    if (availableScaling.length > 0) {
      const scalingPick = availableScaling[Math.floor(Math.random() * availableScaling.length)];
      shopCardNames.push(scalingPick);
    }
    this.shuffle(shopCardNames);
    for (const name of shopCardNames) {
      const card = CARD_DB[name];
      const rarity = card.rarity || "common";
      let price = { common: 30, uncommon: 55, rare: 85 }[rarity] || 40;
      price += this.randInt(-5, 5);
      this.shopItems.push({ item: { ...card }, price, type: "card", sold: false });
    }

    if (!(this.challenge && this.challenge.id === "no_potion")) {
      const pot = POTIONS[Math.floor(Math.random() * POTIONS.length)];
      this.shopItems.push({ item: { ...pot }, price: this.randInt(20, 35), type: "potion", sold: false });
    }

    const availableRelics = RELICS.filter(r => !this.hasRelic(r.name));
    if (availableRelics.length > 0) {
      const rel = availableRelics[Math.floor(Math.random() * availableRelics.length)];
      this.shopItems.push({ item: { ...rel }, price: this.randInt(80, 120), type: "relic", sold: false });
    }

    this.shopItems.push({
      item: { name: "Remove a card", desc: "Remove a card from your deck." },
      price: Math.min(100, 50 + this.level * 5), type: "remove", sold: false
    });

    this.log = `Welcome to the shop! Gold: ${this.gold}`;
  }

  buyShopItem(idx) {
    if (!this.inShop || idx < 0 || idx >= this.shopItems.length) return;
    const item = this.shopItems[idx];
    if (item.sold) { this.log = "Already bought."; return; }
    if (this.gold < item.price) { this.log = "Not enough gold!"; return; }

    this.gold -= item.price;
    item.sold = true;

    if (item.type === "card") {
      if (this.challenge && this.challenge.id === "deck_limit_15" && this.deck.length >= 15) {
        this.gold += item.price; item.sold = false;
        this.log = "Deck is at maximum size (15 cards)!"; return;
      }
      this.deck.push({ ...item.item });
      this.log = `Bought: ${item.item.name} for ${item.price} gold.`;
    } else if (item.type === "potion") {
      if (this.potions.length < this.maxPotions) {
        this.potions.push({ ...item.item });
        this.log = `Potion bought: ${item.item.name}.`;
      } else {
        this.gold += item.price;
        item.sold = false;
        this.log = "Potion inventory full!";
      }
    } else if (item.type === "relic") {
      this.relics.push({ ...item.item });
      if (item.item.effect === "strength") this.player.strength += item.item.value;
      this.log = `Relic bought: ${item.item.name}.`;
    } else if (item.type === "remove") {
      this._showingRemoval = true;
      return;
    }
  }

  removeCardFromDeck(idx) {
    if (idx < 0 || idx >= this.deck.length) return;
    const removed = this.deck.splice(idx, 1)[0];
    for (const si of this.shopItems) {
      if (si.type === "remove") si.sold = true;
    }
    this._showingRemoval = false;
    this.log = `Removed: ${removed.name} from deck.`;
  }

  leaveShop() {
    this.inShop = false;
    this._showingRemoval = false;
    this.shopItems = [];
    this._reshuffleAndNext();
  }

  // ---- Save / Load ----
  saveRun() {
    const cardNames = cards => cards.map(c => c.name);
    const data = {
      level: this.level, kills: this.kills,
      player: { ...this.player },
      energy: this.energy, nextEnergy: this.nextEnergy,
      gold: this.gold, handsize: this.handsize,
      maxPotions: this.maxPotions, healOnWinBonus: this.healOnWinBonus,
      attacksPlayed: this.attacksPlayed, rampageBonus: this.rampageBonus,
      challenge: this.challenge ? this.challenge.id : null,
      strongestEnemy: this.strongestEnemy,
      deck: cardNames(this.deck), drawPile: cardNames(this.drawPile),
      discard: cardNames(this.discard), hand: cardNames(this.hand),
      relics: this.relics.map(r => ({ name: r.name })),
      potions: this.potions.map(p => ({ name: p.name })),
      enemy: {
        name: this.enemy.name, hp: this.enemy.hp, max_hp: this.enemy.max_hp,
        block: this.enemy.block, vuln: this.enemy.vuln, weak: this.enemy.weak,
        atk_min: this.enemy.atk_min, atk_max: this.enemy.atk_max,
        block_chance: this.enemy.block_chance, special: this.enemy.special,
        tier: this.enemy.tier || 1, enrage_stacks: this.enemy.enrage_stacks || 0,
        isFinalBoss: this.enemy.isFinalBoss || false,
        lore: this.enemy.lore || null,
      },
      enemyIntent: this.enemyIntent,
      turnNumber: this.turnNumber,
      inReward: this.inReward, inShop: this.inShop,
    };
    localStorage.setItem("legendes_save", JSON.stringify(data));
  }

  static loadRun(meta) {
    try {
      const raw = localStorage.getItem("legendes_save");
      if (!raw) return null;
      const data = JSON.parse(raw);
      const cardsFromNames = names => names.filter(n => CARD_DB[n]).map(n => ({ ...CARD_DB[n] }));

      const g = new Game(meta);
      // Overwrite defaults with saved state
      g.level = data.level;
      g.kills = data.kills || 0;
      g.player = data.player;
      g.energy = data.energy;
      g.nextEnergy = data.nextEnergy || 0;
      g.gold = data.gold;
      g.handsize = data.handsize || 5;
      g.maxPotions = data.maxPotions || 3;
      g.healOnWinBonus = data.healOnWinBonus || 0;
      g.attacksPlayed = data.attacksPlayed || 0;
      g.rampageBonus = data.rampageBonus || {};
      g.challenge = data.challenge ? (CHALLENGES.find(c => c.id === data.challenge) || null) : null;
      g.strongestEnemy = data.strongestEnemy || { max_hp: 0, atk_min: 0, atk_max: 0 };
      g.won = false;
      g.damageTakenThisCombat = 0;
      g.revealedIntents = [];
      g.turnNumber = data.turnNumber || 0;
      g.exhaust = [];
      g.log = "Game loaded!";
      g.inReward = data.inReward || false;
      g.inShop = data.inShop || false;
      g.shopItems = [];
      g.rewardChoices = [];
      g.rewardType = "card";
      g.deck = cardsFromNames(data.deck);
      g.drawPile = cardsFromNames(data.drawPile);
      g.discard = cardsFromNames(data.discard);
      g.hand = cardsFromNames(data.hand);
      g.relics = [];
      for (const rd of (data.relics || [])) {
        const r = RELICS.find(r => r.name === rd.name);
        if (r) g.relics.push({ ...r });
      }
      g.potions = [];
      for (const pd of (data.potions || [])) {
        const p = POTIONS.find(p => p.name === pd.name);
        if (p) g.potions.push({ ...p });
      }
      const ed = data.enemy;
      g.enemy = {
        name: ed.name, hp: ed.hp, max_hp: ed.max_hp,
        block: ed.block, vuln: ed.vuln, weak: ed.weak,
        atk_min: ed.atk_min, atk_max: ed.atk_max,
        block_chance: ed.block_chance, special: ed.special,
        tier: ed.tier || 1, enrage_stacks: ed.enrage_stacks || 0,
        isFinalBoss: ed.isFinalBoss || false,
        lore: ed.lore || null,
      };
      g.enemyIntent = data.enemyIntent || { type: "attack", value: 6 };
      return g;
    } catch (e) { return null; }
  }

  deleteRunSave() { localStorage.removeItem("legendes_save"); }

  _winGame() {
    this.won = true;
    this.inReward = false;
    this.inShop = false;

    // Set firstClear on first victory
    if (!this.meta.firstClear) {
      this.meta.setFirstClear();
    }

    // Complete challenge if one was active
    if (this.challenge) {
      this.meta.completeChallenge(this.challenge.id);
    }

    // Award legacy points with victory bonus
    const points = this.meta.recordRun(this.level, this.kills, true);
    this.log = `VICTORY! The Sovereign Shadow is vanquished! +${points} legacy points!`;
    this.deleteRunSave();
  }

  loseGame() {
    this.dead = true;
    this.inReward = false;
    this.inShop = false;
    const points = this.meta.recordRun(this.level, this.kills);
    this.log = `You fell at floor ${this.level}... +${points} legacy points!`;
    this.deleteRunSave();
  }
}
