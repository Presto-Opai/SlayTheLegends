// ===================== UI =====================
let game, meta, showingLegacy = false;

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
  game = new Game(meta);
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

  if (showingLegacy) { renderLegacy(main); return; }
  if (game.dead) { renderDeath(main); return; }
  if (game._scryCards) { renderScry(main); return; }
  if (game._showingRemoval) { renderRemoval(main); return; }

  // Enemy section
  const enemySec = el("div", "enemy-section");
  const enemyLabel = (game.enemy.elite ? "ELITE " : "") + game.enemy.name + " HP";
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
  pileInfo.appendChild(document.createTextNode(`  Floor: ${game.level}  Gold: ${game.gold}`));
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

  // Meta stats
  document.getElementById("meta-stats").textContent =
    `Legacy: ${meta.legacyPoints}  Runs: ${meta.totalRuns}  Best: ${meta.bestFloor}`;
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
  hint.textContent = "R = restart    L = legacy (upgrades)";
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

  const hint = el("div", "legacy-hint");
  hint.textContent = "Click to buy — L to close";
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
