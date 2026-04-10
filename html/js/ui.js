// ===================== UI =====================
let game, meta, showingLegacy = false, showingChallengeSelect = false;

function init() {
  meta = new MetaProgress();
  const loaded = Game.loadRun(meta);
  game = loaded || new Game(meta);
  bindEvents();
  redraw();
}

function bindEvents() {
  document.getElementById("btn-end-turn").addEventListener("click", endTurn);
  document.getElementById("btn-skip").addEventListener("click", () => { game.takeReward(null); redraw(); });
  document.getElementById("btn-leave-shop").addEventListener("click", () => { game.leaveShop(); redraw(); });
  document.getElementById("btn-save").addEventListener("click", saveGame);
  document.getElementById("btn-load").addEventListener("click", loadGame);
  document.getElementById("btn-legacy").addEventListener("click", toggleLegacy);
  document.getElementById("btn-restart").addEventListener("click", restart);
  document.getElementById("btn-reset-game").addEventListener("click", resetGame);

  document.addEventListener("keydown", e => {
    if (e.key === "r" || e.key === "R") restart();
    if (e.key === "l" || e.key === "L") toggleLegacy();
    if (e.key === "s" || e.key === "S") saveGame();
    if (e.key === "1") { game.usePotion(0); redraw(); }
    if (e.key === "2") { game.usePotion(1); redraw(); }
    if (e.key === "3") { game.usePotion(2); redraw(); }
  });
}

function restart() {
  showingLegacy = false;
  if (meta.firstClear) {
    showingChallengeSelect = true;
    redraw();
  } else {
    game = new Game(meta);
    redraw();
  }
}

function startRun(challenge, options = {}) {
  showingChallengeSelect = false;
  game = new Game(meta, challenge, options);
  redraw();
}

let pendingReset = false;

function resetGame() {
  pendingReset = true;
  redraw();
}

function confirmReset() {
  localStorage.removeItem("legendes_meta");
  localStorage.removeItem("legendes_save");
  meta = new MetaProgress();
  showingLegacy = false;
  showingChallengeSelect = false;
  pendingReset = false;
  game = new Game(meta);
  redraw();
}

function cancelReset() {
  pendingReset = false;
  redraw();
}

function saveGame() {
  if (game.player.hp <= 0) return;
  game.saveRun();
  game.log = "Game saved!";
  redraw();
}

function loadGame() {
  const loaded = Game.loadRun(meta);
  if (loaded) { game = loaded; showingLegacy = false; redraw(); }
  else { game.log = "No save found."; redraw(); }
}

function toggleLegacy() {
  showingLegacy = !showingLegacy;
  redraw();
}

function endTurn() {
  if (game.inReward || game.inShop || game.dead) return;
  game.endPlayerTurn();
  redraw();
}

// ===================== RENDERING =====================
function redraw() {
  const main = document.getElementById("game-area");
  main.innerHTML = "";

  if (pendingReset) { renderResetConfirm(main); return; }
  if (showingChallengeSelect) { renderChallengeSelect(main); return; }
  if (showingLegacy) { renderLegacy(main); return; }
  if (game.won) { renderVictory(main); return; }
  if (game.dead) { renderDeath(main); return; }
  if (game._scryCards) { renderScry(main); return; }
  if (game._showingRemoval) { renderRemoval(main); return; }

  // Enemy section
  const enemySec = el("div", "enemy-section");
  const enemyPrefix = game.enemy.isFinalBoss ? "FINAL BOSS " : (game.enemy.elite ? "ELITE " : "");
  const enemyLabel = enemyPrefix + game.enemy.name + " HP";
  enemySec.appendChild(makeBar(enemyLabel, game.enemy.hp, game.enemy.max_hp, "enemy-bar"));
  const enemyStats = el("div", "enemy-stats");
  enemyStats.textContent = `Block: ${game.enemy.block}  Vuln: ${game.enemy.vuln}  Weak: ${game.enemy.weak}`;
  enemySec.appendChild(enemyStats);

  if (game.enemy.special) {
    const specials = {
      thorns: "Thorns (2 dmg on hit)", life_drain: "Life Drain", multi_hit: "Multi-Hit",
      steal_energy: "Energy Thief", weaken_player: "Enfeebler", crush: "Crushing Blows",
      regen: "Regeneration", enrage: `Enrage (+${game.enemy.enrage_stacks || 0})`,
      summon_hounds: "Hound Master", mirror: "Mirror Shield",
      auto_block: "Bear Hide (auto-block)", trickster: "Trickster",
      venom: "Venomous",
      nightmare: "Nightmare (draw penalty)", pack_hunter: "Pack Hunter (+3 if unblocked)",
      petrify: "Petrifying Gaze", stone_skin: "Stone Skin (resists weak hits)",
      soul_drain: "Soul Drain (-2 max HP/turn)",
      sovereign: "Sovereign (Life Drain, Enrage, Soul Crush, Shadow Hounds)",
    };
    const sp = el("div", "enemy-special");
    sp.textContent = `Ability: ${specials[game.enemy.special] || game.enemy.special}`;
    enemySec.appendChild(sp);
  }

  if (game.enemy.lore) {
    const loreEl = el("div", "enemy-lore");
    loreEl.textContent = game.enemy.lore;
    enemySec.appendChild(loreEl);
  }

  // Intent
  if (game.enemyIntent.type !== "none") {
    const intent = el("div", "enemy-intent");
    if (game.enemyIntent.type === "attack") {
      const hits = game.enemyIntent.hits || 1;
      const ht = hits > 1 ? ` x${hits}` : "";
      intent.textContent = `Intent: Attack ${game.enemyIntent.value}${ht}`;
      intent.classList.add("intent-attack");
    } else {
      intent.textContent = `Intent: Block ${game.enemyIntent.value}`;
      intent.classList.add("intent-block");
    }
    enemySec.appendChild(intent);
  }

  if (game.revealedIntents.length > 0) {
    const ri = el("div", "revealed-intents");
    ri.textContent = "Future: " + game.revealedIntents.map(r =>
      `${r.type === "attack" ? "Atk" : "Blk"} ${r.value}`).join(", ");
    enemySec.appendChild(ri);
  }
  main.appendChild(enemySec);

  // Player section
  const playerSec = el("div", "player-section");
  playerSec.appendChild(makeBar("Your HP", game.player.hp, game.player.max_hp, "player-bar"));
  const pStats = el("div", "player-stats");
  pStats.textContent = `Block: ${game.player.block}  STR: ${game.player.strength}  Armor: ${game.player.armor}`;
  if (game.player.weak > 0) pStats.textContent += `  Weak: ${game.player.weak}`;
  if (game.player.vuln > 0) pStats.textContent += `  Vuln: ${game.player.vuln}`;
  playerSec.appendChild(pStats);

  // Energy
  const energyOrb = el("div", "energy-orb");
  energyOrb.textContent = game.energy;
  playerSec.appendChild(energyOrb);

  const pileInfo = el("div", "pile-info");
  const drawBtn = document.createElement("span");
  drawBtn.className = "pile-btn";
  drawBtn.textContent = `Draw: ${game.drawPile.length}`;
  drawBtn.title = "Click to view draw pile";
  drawBtn.addEventListener("click", () => { showPileOverlay("Draw Pile", game.drawPile); });
  const discardBtn = document.createElement("span");
  discardBtn.className = "pile-btn";
  discardBtn.textContent = `Discard: ${game.discard.length}`;
  discardBtn.title = "Click to view discard pile";
  discardBtn.addEventListener("click", () => { showPileOverlay("Discard Pile", game.discard); });
  pileInfo.appendChild(drawBtn);
  pileInfo.appendChild(document.createTextNode("  "));
  pileInfo.appendChild(discardBtn);
  const floorText = game.level === 40 ? `  Floor: ${game.level} (FINAL)  Gold: ${game.gold}` : `  Floor: ${game.level}  Gold: ${game.gold}`;
  pileInfo.appendChild(document.createTextNode(floorText));
  playerSec.appendChild(pileInfo);
  main.appendChild(playerSec);

  // Reward choices
  if (game.inReward && game.rewardChoices.length > 0) {
    const rewardSec = el("div", "reward-section");
    const labels = { card: "Choose a card", relic: "Choose a relic", potion: "Choose a potion" };
    const rTitle = el("div", "reward-title");
    rTitle.textContent = `Reward: ${labels[game.rewardType] || "Choose"}`;
    rewardSec.appendChild(rTitle);

    const rRow = el("div", "reward-row");
    game.rewardChoices.forEach((choice, i) => {
      if (game.rewardType === "card") {
        rRow.appendChild(makeCard(choice, () => { game.takeReward(i); redraw(); }));
      } else if (game.rewardType === "relic") {
        rRow.appendChild(makeRelicChoice(choice, () => { game.takeReward(i); redraw(); }));
      } else {
        rRow.appendChild(makePotionChoice(choice, () => { game.takeReward(i); redraw(); }));
      }
    });
    rewardSec.appendChild(rRow);
    main.appendChild(rewardSec);
  }

  // Shop
  if (game.inShop && game.shopItems.length > 0) {
    main.appendChild(renderShop());
  }

  // Hand
  if (!game.inShop) {
    const handSec = el("div", "hand-section");
    const handTitle = el("div", "hand-title");
    handTitle.textContent = `Hand (${game.hand.length})`;
    handSec.appendChild(handTitle);
    const handRow = el("div", "hand-row");
    game.hand.forEach((card, i) => {
      const cardEl = makeCard(card, () => { game.playCard(i); redraw(); });
      if (card.cost > game.energy) cardEl.classList.add("unplayable");
      handRow.appendChild(cardEl);
    });
    handSec.appendChild(handRow);
    main.appendChild(handSec);
  }

  // Update sidebar
  updateSidebar();
}

function updateSidebar() {
  document.getElementById("log-text").textContent = game.log;

  const inAction = game.inReward || game.inShop || game.dead;
  document.getElementById("btn-end-turn").disabled = inAction;
  document.getElementById("btn-skip").disabled = !game.inReward;
  document.getElementById("btn-leave-shop").style.display = game.inShop ? "inline-block" : "none";

  // Potions
  const potDiv = document.getElementById("potion-list");
  potDiv.innerHTML = "";
  game.potions.forEach((p, i) => {
    const btn = document.createElement("button");
    btn.className = "potion-btn";
    const potionScale = 1.0 + 0.1 * game.level;
    const sv = (v) => Math.floor(v * potionScale);
    let scaledDesc = p.desc;
    if (["damage", "block", "heal"].includes(p.action)) {
      scaledDesc = p.desc.replace(/\d+/, sv(p.value));
    } else if (["strength", "vuln", "weak"].includes(p.action)) {
      scaledDesc = p.desc.replace(/\d+/, Math.max(p.value, sv(p.value)));
    }
    btn.textContent = `[${i + 1}] ${p.name}`;
    btn.title = scaledDesc;
    btn.addEventListener("click", () => { game.usePotion(i); redraw(); });
    potDiv.appendChild(btn);
  });

  // Relics
  const relDiv = document.getElementById("relic-list");
  relDiv.textContent = game.relics.length > 0 ? "Relics: " + game.relics.map(r => r.name).join(", ") : "";

  // Active challenge indicator
  const challengeDiv = document.getElementById("challenge-indicator");
  if (game.challenge) {
    challengeDiv.textContent = `Challenge: ${game.challenge.name}`;
    challengeDiv.style.display = "block";
  } else {
    challengeDiv.style.display = "none";
  }

  // Meta stats
  const completed = CHALLENGES.filter(c => meta.isChallengeComplete(c.id)).length;
  document.getElementById("meta-stats").textContent =
    `Legacy: ${meta.legacyPoints}  Runs: ${meta.totalRuns}  Best: ${meta.bestFloor}` +
    (meta.firstClear ? `  Challenges: ${completed}/${CHALLENGES.length}` : "");
}

// ===================== COMPONENTS =====================
function el(tag, cls) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

function makeBar(label, now, max, cls) {
  const wrap = el("div", "bar-wrap " + cls);
  const lbl = el("div", "bar-label");
  lbl.textContent = label;
  wrap.appendChild(lbl);
  const outer = el("div", "bar-outer");
  const inner = el("div", "bar-inner");
  inner.style.width = Math.max(0, (now / Math.max(1, max)) * 100) + "%";
  outer.appendChild(inner);
  const txt = el("div", "bar-text");
  txt.textContent = `${now}/${max}`;
  outer.appendChild(txt);
  wrap.appendChild(outer);
  return wrap;
}

function makeCard(card, onClick) {
  const rarity = card.rarity || "common";
  const div = el("div", `card card-${rarity}`);
  div.addEventListener("click", onClick);

  const costOrb = el("span", "card-cost");
  costOrb.textContent = card.cost;
  div.appendChild(costOrb);

  const name = el("div", "card-name");
  name.textContent = card.name;
  div.appendChild(name);

  const type = el("div", `card-type card-type-${card.type.toLowerCase()}`);
  type.textContent = card.type;
  div.appendChild(type);

  const text = el("div", "card-text");
  text.textContent = card.text;
  div.appendChild(text);

  return div;
}

function makeRelicChoice(relic, onClick) {
  const div = el("div", "card relic-choice");
  div.addEventListener("click", onClick);
  const name = el("div", "card-name relic-name");
  name.textContent = relic.name;
  div.appendChild(name);
  const desc = el("div", "card-text");
  desc.textContent = relic.desc;
  div.appendChild(desc);
  return div;
}

function makePotionChoice(potion, onClick) {
  const div = el("div", "card potion-choice");
  div.addEventListener("click", onClick);
  const name = el("div", "card-name potion-name");
  name.textContent = potion.name;
  div.appendChild(name);
  const desc = el("div", "card-text");
  desc.textContent = potion.desc;
  div.appendChild(desc);
  return div;
}

function renderShop() {
  const sec = el("div", "shop-section");
  const title = el("div", "shop-title");
  title.textContent = `SHOP — Gold: ${game.gold}`;
  sec.appendChild(title);

  const grid = el("div", "shop-grid");
  game.shopItems.forEach((si, idx) => {
    const item = el("div", "shop-item");
    if (si.sold) {
      item.classList.add("sold");
      item.innerHTML = "<div class='sold-text'>SOLD</div>";
      grid.appendChild(item);
      return;
    }

    const affordable = game.gold >= si.price;
    if (!affordable) item.classList.add("unaffordable");

    item.classList.add(`shop-${si.type}`);

    const nameEl = el("div", "shop-item-name");
    nameEl.textContent = si.item.name;
    item.appendChild(nameEl);

    if (si.type === "card") {
      const typeEl = el("div", "shop-item-type");
      typeEl.textContent = `${si.item.type} (cost ${si.item.cost})`;
      item.appendChild(typeEl);
      const textEl = el("div", "shop-item-text");
      textEl.textContent = si.item.text;
      item.appendChild(textEl);
    } else if (si.type !== "remove") {
      const descEl = el("div", "shop-item-text");
      descEl.textContent = si.item.desc;
      item.appendChild(descEl);
    } else {
      const descEl = el("div", "shop-item-text");
      descEl.textContent = "Thin your deck!";
      item.appendChild(descEl);
    }

    const priceEl = el("div", "shop-item-price");
    priceEl.textContent = `${si.price} gold`;
    item.appendChild(priceEl);

    item.addEventListener("click", () => {
      game.buyShopItem(idx);
      redraw();
    });
    grid.appendChild(item);
  });
  sec.appendChild(grid);
  return sec;
}

function renderScry(main) {
  const sec = el("div", "scry-section");
  const title = el("div", "scry-title");
  title.textContent = "Dame Blanche — Scry 2";
  sec.appendChild(title);

  const cards = el("div", "scry-cards");
  cards.textContent = game._scryCards.map(c => c.name).join(", ") || "(empty)";
  sec.appendChild(cards);

  const btns = el("div", "scry-buttons");
  const b1 = document.createElement("button");
  b1.textContent = "Discard both";
  b1.className = "btn";
  b1.addEventListener("click", () => { game.scryDiscardAll(); redraw(); });
  btns.appendChild(b1);

  const b2 = document.createElement("button");
  b2.textContent = "Keep both";
  b2.className = "btn";
  b2.addEventListener("click", () => { game.scryKeepAll(); redraw(); });
  btns.appendChild(b2);

  const b3 = document.createElement("button");
  b3.textContent = "Discard first";
  b3.className = "btn";
  b3.addEventListener("click", () => { game.scryDiscardFirst(); redraw(); });
  btns.appendChild(b3);

  sec.appendChild(btns);
  main.appendChild(sec);
  updateSidebar();
}

function renderRemoval(main) {
  const sec = el("div", "removal-section");
  const title = el("div", "removal-title");
  title.textContent = "Choose a card to remove from your deck:";
  sec.appendChild(title);

  const list = el("div", "removal-list");
  game.deck.forEach((card, i) => {
    const item = el("div", "removal-item");
    const rarity = card.rarity || "common";
    item.textContent = `[${rarity[0].toUpperCase()}] ${card.name} (${card.type}, cost ${card.cost})`;
    item.classList.add(`removal-${rarity}`);
    item.addEventListener("click", () => {
      game.removeCardFromDeck(i);
      redraw();
    });
    list.appendChild(item);
  });
  sec.appendChild(list);

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  cancelBtn.className = "btn btn-cancel";
  cancelBtn.addEventListener("click", () => {
    game._showingRemoval = false;
    // refund
    for (const si of game.shopItems) {
      if (si.type === "remove" && si.sold) {
        game.gold += si.price;
        si.sold = false;
      }
    }
    redraw();
  });
  sec.appendChild(cancelBtn);
  main.appendChild(sec);
  updateSidebar();
}

function renderResetConfirm(main) {
  const sec = el("div", "death-section");
  const title = el("div", "death-title");
  title.textContent = "RESET GAME";
  sec.appendChild(title);

  const info = el("div", "death-info");
  info.textContent = "This will restart the game from scratch, removing all progress, stats and legacy points. Are you sure?";
  sec.appendChild(info);

  const row = el("div", "btn-row");
  row.style.justifyContent = "center";
  row.style.marginTop = "20px";
  const okBtn = el("button", "btn btn-cancel");
  okBtn.textContent = "OK";
  okBtn.addEventListener("click", confirmReset);
  const cancelBtn = el("button", "btn btn-shop");
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", cancelReset);
  row.appendChild(okBtn);
  row.appendChild(cancelBtn);
  sec.appendChild(row);

  main.appendChild(sec);
}

function renderDeath(main) {
  const sec = el("div", "death-section");
  const title = el("div", "death-title");
  title.textContent = "DEFEAT";
  sec.appendChild(title);

  const info = el("div", "death-info");
  info.textContent = `Floor reached: ${game.level}  —  Enemies: ${game.kills}  —  Gold: ${game.gold}`;
  sec.appendChild(info);

  const pts = el("div", "death-points");
  const p = game.level * 3 + game.kills + (game.level >= 5 ? 10 : 0) + (game.level >= 10 ? 20 : 0) + (game.level >= 15 ? 30 : 0);
  pts.textContent = `Legacy points earned: +${p}`;
  sec.appendChild(pts);

  const hint = el("div", "death-hint");
  hint.textContent = "R = restart run    L = legacy (upgrades)";
  sec.appendChild(hint);

  main.appendChild(sec);
  updateSidebar();
}

function renderLegacy(main) {
  const sec = el("div", "legacy-section");
  const title = el("div", "legacy-title");
  title.textContent = "LEGACY — Permanent Upgrades";
  sec.appendChild(title);

  const stats = el("div", "legacy-stats");
  stats.textContent = `Points: ${meta.legacyPoints}  |  Runs: ${meta.totalRuns}  |  Best: floor ${meta.bestFloor}  |  Kills: ${meta.totalKills}`;
  sec.appendChild(stats);

  const grid = el("div", "legacy-grid");
  META_UPGRADES.forEach((u, i) => {
    const rank = meta.rank(u.id);
    const maxed = rank >= u.max_rank;
    const canBuy = meta.canBuy(u.id);
    const cost = maxed ? 0 : meta.cost(u.id);

    const item = el("div", "legacy-item");
    if (maxed) item.classList.add("maxed");
    else if (canBuy) item.classList.add("buyable");
    else item.classList.add("locked");

    const nameEl = el("div", "legacy-name");
    nameEl.textContent = `${u.name} [${rank}/${u.max_rank}]${maxed ? " MAX" : ""}`;
    item.appendChild(nameEl);

    const descEl = el("div", "legacy-desc");
    descEl.textContent = u.desc;
    item.appendChild(descEl);

    if (!maxed) {
      const costEl = el("div", "legacy-cost");
      costEl.textContent = `${cost} pts`;
      item.appendChild(costEl);
    }

    item.addEventListener("click", () => {
      if (meta.buy(u.id)) {
        game.log = `Upgrade: ${u.name} rank ${meta.rank(u.id)}!`;
      }
      redraw();
    });

    grid.appendChild(item);
  });
  sec.appendChild(grid);

  // Challenge progress (only show after first clear)
  if (meta.firstClear) {
    const chTitle = el("div", "legacy-challenge-title");
    const completed = CHALLENGES.filter(c => meta.isChallengeComplete(c.id)).length;
    chTitle.textContent = `Challenges (${completed}/${CHALLENGES.length})`;
    sec.appendChild(chTitle);

    const chGrid = el("div", "legacy-challenge-grid");
    for (const ch of CHALLENGES) {
      const done = meta.isChallengeComplete(ch.id);
      const item = el("div", `legacy-challenge-item${done ? " legacy-challenge-done" : ""}`);
      item.textContent = (done ? "\u2713 " : "\u2022 ") + ch.name;
      item.title = ch.desc;
      chGrid.appendChild(item);
    }
    sec.appendChild(chGrid);
  }

  const hint = el("div", "legacy-hint");
  hint.textContent = "Click to buy — L to close";
  sec.appendChild(hint);

  main.appendChild(sec);
  updateSidebar();
}

// ===================== CHALLENGE SELECT =====================
function renderChallengeSelect(main) {
  const sec = el("div", "challenge-select-section");
  const title = el("div", "challenge-select-title");
  title.textContent = "CHOOSE A CHALLENGE";
  sec.appendChild(title);

  const sub = el("div", "challenge-select-sub");
  const completed = CHALLENGES.filter(c => meta.isChallengeComplete(c.id)).length;
  sub.textContent = `Defeat L'Ombre Souveraine on Floor 40 to complete each challenge. (${completed}/${CHALLENGES.length} completed)`;
  sec.appendChild(sub);

  // Optional toggle: add Gallic Resolve to starter deck in region-only challenges
  const grRow = el("div", "challenge-select-option");
  const grLabel = document.createElement("label");
  grLabel.className = "challenge-select-option-label";
  const grCheckbox = document.createElement("input");
  grCheckbox.type = "checkbox";
  grCheckbox.id = "challenge-starter-gallic-resolve";
  grLabel.appendChild(grCheckbox);
  const grText = document.createElement("span");
  grText.textContent = " Add Gallic Resolve to starter deck";
  grLabel.appendChild(grText);
  grRow.appendChild(grLabel);
  sec.appendChild(grRow);

  const grid = el("div", "challenge-grid");

  // No Challenge option
  const freeCard = el("div", "challenge-card challenge-free");
  const freeName = el("div", "challenge-card-name");
  freeName.textContent = "No Challenge";
  freeCard.appendChild(freeName);
  const freeDesc = el("div", "challenge-card-desc");
  freeDesc.textContent = "Play a normal run to Floor 40.";
  freeCard.appendChild(freeDesc);
  freeCard.addEventListener("click", () => startRun(null));
  grid.appendChild(freeCard);

  for (const ch of CHALLENGES) {
    const done = meta.isChallengeComplete(ch.id);
    const card = el("div", `challenge-card${done ? " challenge-done" : ""}`);

    const name = el("div", "challenge-card-name");
    name.textContent = (done ? "\u2713 " : "") + ch.name;
    card.appendChild(name);

    const desc = el("div", "challenge-card-desc");
    desc.textContent = ch.desc;
    card.appendChild(desc);

    // Show region card list for region challenges
    if (ch.regionCards) {
      const cardList = el("div", "challenge-card-list");
      ch.regionCards.forEach(cardName => {
        const cdb = CARD_DB[cardName];
        if (!cdb) return;
        const row = el("div", "challenge-card-list-item");
        const rarity = cdb.rarity || "common";
        row.classList.add(`pile-rarity-${rarity}`);
        row.textContent = `${cardName} (${cdb.type}, ${cdb.cost})`;
        row.title = cdb.text;
        cardList.appendChild(row);
      });
      card.appendChild(cardList);
    }

    card.addEventListener("click", () => {
      const starterGR = !!(ch.region && grCheckbox.checked);
      startRun(ch, { starterGallicResolve: starterGR });
    });
    grid.appendChild(card);
  }

  sec.appendChild(grid);
  main.appendChild(sec);
  updateSidebar();
}

// ===================== VICTORY SCREEN =====================
function renderVictory(main) {
  if (meta.allChallengesComplete()) { renderFinalVictory(main); return; }

  const sec = el("div", "victory-section");

  // Particle container
  const particles = el("div", "victory-particles");
  for (let i = 0; i < 30; i++) {
    const p = el("div", "victory-particle");
    p.style.left = Math.random() * 100 + "%";
    p.style.animationDelay = Math.random() * 4 + "s";
    p.style.animationDuration = (3 + Math.random() * 4) + "s";
    particles.appendChild(p);
  }
  sec.appendChild(particles);

  // Light burst
  const burst = el("div", "victory-burst");
  sec.appendChild(burst);

  // Shadow dissolve text
  const dissolve = el("div", "victory-dissolve anim-stagger-1");
  dissolve.textContent = "L'Ombre Souveraine";
  sec.appendChild(dissolve);

  // Main title
  const title = el("div", "victory-title anim-stagger-2");
  title.textContent = "VICTOIRE";
  sec.appendChild(title);

  // Lore line
  const lore = el("div", "victory-lore anim-stagger-3");
  lore.textContent = "The shadow recedes. The legends of France endure.";
  sec.appendChild(lore);

  // Divider
  const divider = el("div", "victory-divider anim-stagger-3");
  sec.appendChild(divider);

  // Challenge badge
  if (game.challenge) {
    const chBadge = el("div", "victory-challenge anim-stagger-4");
    chBadge.innerHTML = `<span class="victory-challenge-label">Challenge conquered</span><span class="victory-challenge-name">${game.challenge.name}</span>`;
    sec.appendChild(chBadge);
  }

  // Animated stats
  const statsData = [
    { label: "Floors conquered", value: game.level },
    { label: "Legends defeated", value: game.kills },
    { label: "Deck forged", value: game.deck.length + " cards" },
    { label: "Relics claimed", value: game.relics.length },
    { label: "Gold amassed", value: game.gold },
  ];
  const statsGrid = el("div", "victory-stats-grid");
  statsData.forEach((s, i) => {
    const item = el("div", `victory-stat-item anim-stagger-${4 + i}`);
    const val = el("div", "victory-stat-value");
    val.textContent = s.value;
    const lbl = el("div", "victory-stat-label");
    lbl.textContent = s.label;
    item.appendChild(val);
    item.appendChild(lbl);
    statsGrid.appendChild(item);
  });
  sec.appendChild(statsGrid);

  // Points earned
  const pts = game.level * 3 + game.kills + (game.level >= 5 ? 10 : 0) + (game.level >= 10 ? 20 : 0) + (game.level >= 15 ? 30 : 0) + 100;
  const pointsEl = el("div", "victory-points anim-stagger-9");
  pointsEl.innerHTML = `<span class="victory-points-num">+${pts}</span> legacy points earned`;
  sec.appendChild(pointsEl);

  // Challenge progress
  const completed = CHALLENGES.filter(c => meta.isChallengeComplete(c.id)).length;
  if (meta.firstClear) {
    const progress = el("div", "victory-progress anim-stagger-10");
    const bar = el("div", "victory-progress-bar");
    const fill = el("div", "victory-progress-fill");
    fill.style.width = Math.round(completed / CHALLENGES.length * 100) + "%";
    bar.appendChild(fill);
    progress.appendChild(bar);
    const txt = el("div", "victory-progress-text");
    txt.textContent = `${completed} / ${CHALLENGES.length} challenges`;
    progress.appendChild(txt);
    sec.appendChild(progress);
  }

  // Hint
  const hint = el("div", "victory-hint anim-stagger-11");
  hint.textContent = "R = new run \u00a0\u00a0 L = legacy";
  sec.appendChild(hint);

  main.appendChild(sec);
  updateSidebar();
}

function renderFinalVictory(main) {
  const sec = el("div", "fv-section");

  // Particle storm (more particles, golden)
  const particles = el("div", "fv-particles");
  for (let i = 0; i < 50; i++) {
    const p = el("div", "fv-particle");
    p.style.left = Math.random() * 100 + "%";
    p.style.animationDelay = Math.random() * 5 + "s";
    p.style.animationDuration = (4 + Math.random() * 5) + "s";
    particles.appendChild(p);
  }
  sec.appendChild(particles);

  // Aurora light
  const aurora = el("div", "fv-aurora");
  sec.appendChild(aurora);

  // Crown / emblem
  const crown = el("div", "fv-crown anim-stagger-1");
  crown.innerHTML = "\u2726 \u2726 \u2726";
  sec.appendChild(crown);

  // Title
  const title = el("div", "fv-title anim-stagger-2");
  title.textContent = "TOUTES LES L\u00c9GENDES CONQUISES";
  sec.appendChild(title);

  const sub = el("div", "fv-subtitle anim-stagger-3");
  sub.textContent = "Every shadow has been lifted. Every legend, mastered. France remembers your name.";
  sec.appendChild(sub);

  // Legendary tapestry: creatures appearing in procession
  const LEGENDS = [
    { name: "Loup-Garou", region: "Bretagne", symbol: "\ud83d\udc3a" },
    { name: "Tarasque", region: "Provence", symbol: "\ud83d\udc09" },
    { name: "Ankou", region: "Bretagne", symbol: "\u2620" },
    { name: "M\u00e9lusine", region: "Val de Loire", symbol: "\ud83d\udc0d" },
    { name: "Gargantua", region: "Val de Loire", symbol: "\ud83d\uddfb" },
    { name: "La Vouivre", region: "Alpes", symbol: "\ud83d\udc8e" },
    { name: "Le Diable de Laval", region: "Auvergne", symbol: "\ud83d\udd25" },
    { name: "F\u00e9e Morgane", region: "Bretagne", symbol: "\u2728" },
    { name: "Grand Veneur", region: "Normandie", symbol: "\ud83c\udff9" },
    { name: "Roi des Aulnes", region: "Alsace", symbol: "\ud83c\udf43" },
    { name: "Gargouille", region: "Normandie", symbol: "\ud83c\udfdb" },
    { name: "L'Ombre Souveraine", region: "", symbol: "\ud83d\udc51" },
  ];
  const tapestry = el("div", "fv-tapestry");
  LEGENDS.forEach((leg, i) => {
    const fig = el("div", `fv-legend anim-stagger-${4 + Math.floor(i / 2)}`);
    const sym = el("div", "fv-legend-symbol");
    sym.textContent = leg.symbol;
    fig.appendChild(sym);
    const nm = el("div", "fv-legend-name");
    nm.textContent = leg.name;
    fig.appendChild(nm);
    if (leg.region) {
      const rg = el("div", "fv-legend-region");
      rg.textContent = leg.region;
      fig.appendChild(rg);
    }
    tapestry.appendChild(fig);
  });
  sec.appendChild(tapestry);

  // Divider
  const divider = el("div", "fv-divider anim-stagger-10");
  sec.appendChild(divider);

  // All challenges
  const chTitle = el("div", "fv-ch-title anim-stagger-10");
  chTitle.textContent = `${CHALLENGES.length} challenges mastered`;
  sec.appendChild(chTitle);

  const chList = el("div", "fv-ch-list");
  CHALLENGES.forEach((ch, i) => {
    const item = el("div", `fv-ch-item anim-stagger-${10 + Math.floor(i / 3)}`);
    item.textContent = `\u2713 ${ch.name}`;
    chList.appendChild(item);
  });
  sec.appendChild(chList);

  // Lifetime stats
  const statsGrid = el("div", "fv-stats anim-stagger-14");
  const statPairs = [
    ["Runs", meta.totalRuns], ["Legends slain", meta.totalKills],
    ["Highest floor", meta.bestFloor], ["Legacy", meta.legacyPoints],
  ];
  statPairs.forEach(([lbl, val]) => {
    const item = el("div", "fv-stat");
    const v = el("div", "fv-stat-value"); v.textContent = val;
    const l = el("div", "fv-stat-label"); l.textContent = lbl;
    item.appendChild(v); item.appendChild(l);
    statsGrid.appendChild(item);
  });
  sec.appendChild(statsGrid);

  // Closing lore
  const closing = el("div", "fv-closing anim-stagger-15");
  closing.innerHTML = "&laquo; Il \u00e9tait une fois, et pour toujours. &raquo;<br><span class='fv-closing-en'>Once upon a time, and forevermore.</span>";
  sec.appendChild(closing);

  const hint = el("div", "fv-hint anim-stagger-16");
  hint.textContent = "R = new run \u00a0\u00a0 L = legacy";
  sec.appendChild(hint);

  main.appendChild(sec);
  updateSidebar();
}

function showPileOverlay(title, pile) {
  const existing = document.getElementById("pile-overlay");
  if (existing) existing.remove();

  const overlay = el("div", "pile-overlay");
  overlay.id = "pile-overlay";
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

  const panel = el("div", "pile-panel");
  const heading = el("div", "pile-panel-title");
  heading.textContent = `${title} (${pile.length} cards)`;
  panel.appendChild(heading);

  // Count cards by name
  const counts = {};
  pile.forEach(c => { counts[c.name] = (counts[c.name] || 0) + 1; });
  const sorted = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));

  const list = el("div", "pile-panel-list");
  for (const [name, count] of sorted) {
    const card = CARD_DB[name];
    const row = el("div", "pile-panel-row");
    const rarity = card ? (card.rarity || "common") : "common";
    row.classList.add(`pile-rarity-${rarity}`);
    row.textContent = count > 1 ? `${name} x${count}` : name;
    if (card) row.title = card.text;
    list.appendChild(row);
  }
  panel.appendChild(list);

  const closeBtn = document.createElement("button");
  closeBtn.className = "btn pile-close-btn";
  closeBtn.textContent = "Close";
  closeBtn.addEventListener("click", () => overlay.remove());
  panel.appendChild(closeBtn);

  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}

// Init on load
document.addEventListener("DOMContentLoaded", init);
