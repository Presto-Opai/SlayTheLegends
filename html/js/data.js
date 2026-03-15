// ===================== DATA =====================
// Cards, Relics, Potions, Enemies, Meta Upgrades

const REGIONS = {
  "Bretagne": ["Ankou's Scythe", "Korrigan Trick", "Washerwomen's Omen"],
  "Provence": ["Tarasque Roar", "Drac of Camargue", "Santons' Blessing"],
  "Normandie": ["Dame Blanche", "Mauvais Pas", "Mont-Saint-Michel Tide"],
  "Alpes": ["Dahu Sidestep", "Avalanche Chant", "Loup des Alpes"],
  "Auvergne": ["Bête du Gévaudan", "Volcan's Breath", "Cantal Shield"],
  "Val de Loire": ["Mélusine's Veil", "Gargantua's Step", "Château Ruse"],
  "Ardennes": ["Bayard's Hoofbeat", "Forest Ambush", "Smugglers' Wile"],
  "Occitanie": ["Lou Pastre Ballad", "Fées de l'Orb", "Cathar Resolve"],
  "Corse": ["Mazzeru's Vision", "Vendetta Strike", "Maquis Ambush"],
  "Alsace": ["Stork's Blessing", "Hans Trapp's Fury", "Rhine Gold"],
};

const RARITY_COLORS = { common: "#9cc1ff", uncommon: "#5aff8a", rare: "#ff9e44" };

function makeCardDB() {
  const db = {};
  function add(name, cost, type, text, effectKey, rarity = "common") {
    db[name] = { name, cost, type, text, effectKey, rarity };
  }

  // Core neutral set
  add("Strike", 1, "Attack", "Deal 6 damage.", "atk6");
  add("Defend", 1, "Skill", "Gain 5 block.", "block5");
  add("Lunge", 1, "Attack", "Deal 4 damage. Draw 1.", "lunge");
  add("Focus", 1, "Skill", "Draw 2.", "draw2");
  add("Expose", 1, "Skill", "Apply 1 Vulnerable.", "vuln1");
  add("Hamper", 1, "Skill", "Apply 1 Weak.", "weak1");
  add("Fortify", 2, "Power", "+1 armor permanently.", "fortify", "uncommon");
  add("Rally", 2, "Power", "+1 strength permanently.", "rally", "uncommon");

  // Neutral uncommon/rare
  add("Adrenaline Rush", 0, "Skill", "Gain 2 energy. Draw 1. Exhaust.", "adrenalineRush", "rare");
  add("Whirlwind", 0, "Attack", "Deal 4 damage X times (X = energy). Spend all energy.", "whirlwind", "rare");
  add("Second Wind", 1, "Skill", "Gain 5 block for each card in hand.", "secondWind", "uncommon");
  add("Blood Pact", 0, "Attack", "Lose 3 HP. Deal 12 damage.", "bloodPact", "uncommon");
  add("Perfect Guard", 2, "Skill", "Gain 16 block.", "block16", "uncommon");
  add("Rampage", 1, "Attack", "Deal 8 damage. +4 per play this combat.", "rampage", "uncommon");
  add("Offering", 0, "Skill", "Lose 6 HP. Gain 2 energy, draw 3. Exhaust.", "offering", "rare");
  add("Shockwave", 2, "Skill", "Apply 3 Weak and 3 Vulnerable.", "shockwave", "rare");
  add("Body Slam", 1, "Attack", "Deal damage equal to your Block.", "bodySlam", "uncommon");
  add("Cleave", 1, "Attack", "Deal 9 damage.", "atk9");

  // Bretagne
  add("Ankou's Scythe", 2, "Attack", "Deal 10. Apply 1 Vulnerable.", "ankouScythe", "uncommon");
  add("Korrigan Trick", 0, "Skill", "Draw 1. Gain 1 energy.", "korriganTrick", "uncommon");
  add("Washerwomen's Omen", 1, "Skill", "Apply 2 Weak.", "weak2");

  // Provence
  add("Tarasque Roar", 2, "Skill", "Apply 2 Vulnerable. Draw 1.", "tarasqueRoar", "uncommon");
  add("Drac of Camargue", 1, "Attack", "Deal 7. If enemy Vulnerable, +4.", "dracCamargue");
  add("Santons' Blessing", 1, "Skill", "Gain 6 block. Heal 2.", "santonsBlessing");

  // Normandie
  add("Dame Blanche", 1, "Skill", "Scry 2: discard up to 2 from draw top.", "dameBlanche", "uncommon");
  add("Mauvais Pas", 1, "Attack", "Deal 5. Apply 1 Weak.", "mauvaisPas");
  add("Mont-Saint-Michel Tide", 2, "Skill", "Gain 12 block.", "block12", "uncommon");

  // Alpes
  add("Dahu Sidestep", 1, "Skill", "Gain 4 block. Draw 1.", "dahuSidestep");
  add("Avalanche Chant", 2, "Skill", "Negate 8 from enemy attack.", "avalancheChant", "uncommon");
  add("Loup des Alpes", 1, "Attack", "Deal 6. If enemy Weak, +3.", "loupAlpes");

  // Auvergne
  add("Bête du Gévaudan", 2, "Attack", "Deal 14.", "atk14", "uncommon");
  add("Volcan's Breath", 1, "Power", "+1 strength. Apply 1 Vulnerable.", "volcanBreath", "uncommon");
  add("Cantal Shield", 1, "Skill", "Gain 7 block.", "block7");

  // Val de Loire
  add("Mélusine's Veil", 1, "Skill", "Gain 5 block. +1 energy next turn.", "melusineVeil", "uncommon");
  add("Gargantua's Step", 2, "Attack", "Deal 9. Draw 1.", "gargantuaStep");
  add("Château Ruse", 1, "Skill", "Apply 1 Weak and 1 Vulnerable.", "chateauRuse");

  // Ardennes
  add("Bayard's Hoofbeat", 1, "Attack", "Deal 4 twice.", "bayardHoofbeat");
  add("Forest Ambush", 0, "Skill", "If enemy intends Attack, gain 8 block.", "forestAmbush");
  add("Smugglers' Wile", 1, "Skill", "Draw 2. Discard 1.", "smugglersWile");

  // Occitanie
  add("Lou Pastre Ballad", 1, "Power", "At end of turn, gain 2 block.", "louPastreBallad", "uncommon");
  add("Fées de l'Orb", 1, "Skill", "Heal 3. Draw 1.", "feesOrb");
  add("Cathar Resolve", 2, "Skill", "Gain 9 block. Remove Weak from you.", "catharResolve", "uncommon");

  // Corse
  add("Mazzeru's Vision", 1, "Skill", "Look at enemy's next 2 intents. Draw 1.", "mazzeruVision", "uncommon");
  add("Vendetta Strike", 1, "Attack", "Deal 5 + 2 per damage taken this fight.", "vendettaStrike", "rare");
  add("Maquis Ambush", 0, "Attack", "Deal 3. If enemy intends Attack, deal 8 instead.", "maquisAmbush");

  // Alsace
  add("Stork's Blessing", 1, "Skill", "Heal 4. Gain 4 block.", "storkBlessing");
  add("Hans Trapp's Fury", 2, "Attack", "Deal 8. Apply 2 Weak.", "hansTrapFury", "uncommon");
  add("Rhine Gold", 0, "Skill", "Gain 1 energy. Gain 3 block.", "rhineGold", "uncommon");

  return db;
}

const CARD_DB = makeCardDB();

const RELICS = [
  { name: "Burning Blood", desc: "Heal 8 HP after each combat.", effect: "heal_after_combat", value: 8 },
  { name: "Orichalcum", desc: "Gain 6 block if you end turn with 0 block.", effect: "end_turn_block", value: 6 },
  { name: "Vajra", desc: "+1 Strength permanently.", effect: "strength", value: 1 },
  { name: "Anchor", desc: "Start each combat with 10 block.", effect: "start_block", value: 10 },
  { name: "Horn Cleat", desc: "Start 2nd turn with +1 energy.", effect: "second_turn_energy", value: 1 },
  { name: "Bag of Marbles", desc: "Enemies start with 1 Vulnerable.", effect: "start_vuln", value: 1 },
  { name: "Red Skull", desc: "+3 Strength when HP below 50%.", effect: "low_hp_strength", value: 3 },
  { name: "Pen Nib", desc: "Every 10th attack deals double damage.", effect: "pen_nib", value: 10 },
  { name: "Torii", desc: "If you take 5 or less damage, reduce to 1.", effect: "torii", value: 5 },
  { name: "Meat on Bone", desc: "Heal 12 HP after combat if below 50% HP.", effect: "conditional_heal", value: 12 },
];

const POTIONS = [
  { name: "Fire Potion", desc: "Deal 20 damage.", action: "damage", value: 20 },
  { name: "Block Potion", desc: "Gain 12 block.", action: "block", value: 12 },
  { name: "Strength Potion", desc: "+3 Strength this combat.", action: "strength", value: 3 },
  { name: "Swift Potion", desc: "Draw 3 cards.", action: "draw", value: 3 },
  { name: "Fear Potion", desc: "Apply 3 Vulnerable.", action: "vuln", value: 3 },
  { name: "Weak Potion", desc: "Apply 3 Weak.", action: "weak", value: 3 },
  { name: "Regen Potion", desc: "Heal 10 HP.", action: "heal", value: 10 },
  { name: "Energy Potion", desc: "+2 Energy this turn.", action: "energy", value: 2 },
];

const ENEMIES = [
  { name: "Loup-Garou", max_hp: 42, atk_min: 6, atk_max: 9, block_chance: 0.20, special: null, tier: 1 },
  { name: "Bête du Gévaudan", max_hp: 48, atk_min: 7, atk_max: 11, block_chance: 0.25, special: null, tier: 1 },
  { name: "Korrigan", max_hp: 35, atk_min: 5, atk_max: 8, block_chance: 0.15, special: "steal_energy", tier: 1 },
  { name: "Tarasque", max_hp: 60, atk_min: 6, atk_max: 9, block_chance: 0.35, special: "thorns", tier: 2 },
  { name: "Ankou", max_hp: 55, atk_min: 8, atk_max: 12, block_chance: 0.30, special: "life_drain", tier: 2 },
  { name: "Drac", max_hp: 52, atk_min: 9, atk_max: 13, block_chance: 0.20, special: "multi_hit", tier: 2 },
  { name: "Dame Blanche", max_hp: 45, atk_min: 5, atk_max: 7, block_chance: 0.40, special: "weaken_player", tier: 2 },
  { name: "Gargantua (shade)", max_hp: 75, atk_min: 10, atk_max: 14, block_chance: 0.25, special: "crush", tier: 3 },
  { name: "Mélusine", max_hp: 68, atk_min: 8, atk_max: 11, block_chance: 0.30, special: "regen", tier: 3 },
  { name: "Le Diable de Laval", max_hp: 85, atk_min: 11, atk_max: 16, block_chance: 0.20, special: "enrage", tier: 3 },
  { name: "Grand Veneur", max_hp: 100, atk_min: 12, atk_max: 18, block_chance: 0.30, special: "summon_hounds", tier: 4 },
  { name: "Fée Morgane", max_hp: 90, atk_min: 9, atk_max: 13, block_chance: 0.35, special: "mirror", tier: 4 },
];

const META_UPGRADES = [
  { id: "max_hp", name: "Vitalité", desc: "+5 PV max par rang", max_rank: 6, base_cost: 15, cost_inc: 10 },
  { id: "start_gold", name: "Héritage d'Or", desc: "+15 or de départ par rang", max_rank: 5, base_cost: 10, cost_inc: 8 },
  { id: "start_str", name: "Force Ancestrale", desc: "+1 Force de départ par rang", max_rank: 3, base_cost: 30, cost_inc: 25 },
  { id: "potion_slot", name: "Sacoche", desc: "+1 emplacement de potion", max_rank: 2, base_cost: 25, cost_inc: 30 },
  { id: "start_potion", name: "Préparation", desc: "Commence avec une potion aléatoire", max_rank: 1, base_cost: 20, cost_inc: 0 },
  { id: "card_draw", name: "Perspicacité", desc: "+1 carte piochée par tour", max_rank: 2, base_cost: 40, cost_inc: 35 },
  { id: "start_armor", name: "Peau Dure", desc: "+1 armure passive par rang", max_rank: 3, base_cost: 20, cost_inc: 15 },
  { id: "heal_on_win", name: "Second Souffle", desc: "+3 soin après chaque combat par rang", max_rank: 4, base_cost: 12, cost_inc: 10 },
];
