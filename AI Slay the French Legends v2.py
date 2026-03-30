#!/usr/bin/env python3
# Légendes de France v2 — a deck-builder in Tkinter
# Single file, no assets. Click cards to play. End Turn button.

import tkinter as tk
import random
import math
import json
import os

# ---------------------- Save Path ----------------------
SAVE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "saves")
SAVE_FILE = os.path.join(SAVE_DIR, "run_save.json")
META_FILE = os.path.join(SAVE_DIR, "meta_progress.json")

# ---------------------- Theming & Data ----------------------
REGIONS = {
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
}

# Card rarity: common, uncommon, rare
RARITY_COLORS = {"common": "#9cc1ff", "uncommon": "#5aff8a", "rare": "#ff9e44"}

def make_card_db():
    db = {}

    def atk(n):
        return lambda g: g.deal_damage(n, source="You")

    def block(n):
        return lambda g: g.gain_block(n)

    def draw(n):
        def f(g):
            g.draw(n)
            return f"Drew {n}."
        return f

    def vuln(n):
        def f(g):
            g.enemy["vuln"] += n
            return f"Enemy is Vulnerable for {n} turn(s)."
        return f

    def weaken(n):
        def f(g):
            g.enemy["weak"] += n
            return f"Enemy is Weakened for {n} turn(s)."
        return f

    def power_up(kind, n):
        def f(g):
            g.player[kind] += n
            return f"+{n} {kind} (persists)."
        return f

    def add(name, c, t, txt, e, rarity="common"):
        db.setdefault(name, {"name": name, "cost": c, "type": t, "text": txt, "effect": e, "rarity": rarity})

    # ---- Core neutral set ----
    add("Strike", 1, "Attack", "Deal 6 damage.", atk(6))
    add("Defend", 1, "Skill", "Gain 5 block.", block(5))
    add("Lunge", 1, "Attack", "Deal 4 damage. Draw 1.",
        (lambda g: (g.deal_damage(4, "You"), g.draw(1), "Hit 4, drew 1.")[-1]))
    add("Focus", 1, "Skill", "Draw 2.", draw(2))
    add("Expose", 1, "Skill", "Apply 1 Vulnerable.", vuln(1))
    add("Hamper", 1, "Skill", "Apply 1 Weak.", weaken(1))
    add("Fortify", 2, "Power", "+1 armor permanently (adds to all block gains).", power_up("armor", 1), "uncommon")
    add("Rally", 2, "Power", "Gain +1 strength (adds to attacks).", power_up("strength", 1), "uncommon")

    # ---- New neutral uncommon/rare cards ----
    add("Adrenaline Rush", 0, "Skill", "Gain 2 energy. Draw 1. Exhaust.",
        (lambda g: (g.change_energy(2), g.draw(1), "+2 energy, drew 1. Exhausted.")[-1]), "rare")
    add("Whirlwind", 0, "Attack", "Deal 4 damage X times (X = energy). Spend all energy.",
        None, "rare")  # special
    add("Second Wind", 1, "Skill", "Gain 3 block for each card in hand.",
        None, "uncommon")  # special
    add("Blood Pact", 0, "Attack", "Lose 3 HP. Deal 12 damage.",
        (lambda g: (g.self_damage(3), g.deal_damage(12, "You"), "Blood for power: 12 dmg!")[-1]), "uncommon")
    add("Perfect Guard", 2, "Skill", "Gain 16 block.",
        block(16), "uncommon")
    add("Rampage", 1, "Attack", "Deal 8 damage. +4 per play this combat.",
        None, "uncommon")  # special
    add("Offering", 0, "Skill", "Lose 6 HP. Gain 2 energy, draw 3. Exhaust.",
        (lambda g: (g.self_damage(6), g.change_energy(2), g.draw(3), "Sacrifice: +2 energy, drew 3. Exhausted.")[-1]), "rare")
    add("Shockwave", 2, "Skill", "Apply 3 Weak and 3 Vulnerable.",
        (lambda g: (g.apply_weak(3), g.apply_vuln(3), "Shockwave: 3 Weak + 3 Vuln!")[-1]), "rare")
    add("Body Slam", 1, "Attack", "Deal damage equal to your Block.",
        None, "uncommon")  # special
    add("Cleave", 1, "Attack", "Deal 9 damage.",
        atk(9))

    # ---- Bretagne ----
    add("Ankou's Scythe", 2, "Attack", "Deal 10. Apply 1 Vulnerable.",
        (lambda g: (g.deal_damage(10, "You"),
                    g.enemy.__setitem__("vuln", g.enemy["vuln"] + 1),
                    "Scythe: 10 + 1 Vuln")[-1]), "uncommon")
    add("Korrigan Trick", 0, "Skill", "Draw 1. Gain 1 energy.",
        (lambda g: (g.draw(1), g.change_energy(1), "Drew 1, +1 energy.")[-1]), "uncommon")
    add("Washerwomen's Omen", 1, "Skill", "Apply 2 Weak.", weaken(2))

    # ---- Provence ----
    add("Tarasque Roar", 2, "Skill", "Apply 2 Vulnerable. Draw 1.",
        (lambda g: (g.apply_vuln(2), g.draw(1), "Roar: 2 Vuln, drew 1.")[-1]), "uncommon")
    add("Drac of Camargue", 1, "Attack", "Deal 7. If enemy Vulnerable, +4.",
        (lambda g: (g.deal_damage(7 + (4 if g.enemy['vuln'] > 0 else 0), "You"),
                    f"Drac bites for {7 + (4 if g.enemy['vuln'] > 0 else 0)}.")[-1]))
    add("Santons' Blessing", 1, "Skill", "Gain 6 block. Heal 2.",
        (lambda g: (g.gain_block(6), g.heal(2), "Blessed: +6 block, heal 2.")[-1]))

    # ---- Normandie ----
    add("Dame Blanche", 1, "Skill", "Scry 2: discard up to 2 from draw top.", None, "uncommon")
    add("Mauvais Pas", 1, "Attack", "Deal 5. Apply 1 Weak.",
        (lambda g: (g.deal_damage(5, "You"),
                    g.enemy.__setitem__("weak", g.enemy["weak"] + 1),
                    "Slip: 5 + 1 Weak")[-1]))
    add("Mont-Saint-Michel Tide", 2, "Skill", "Gain 12 block.", block(12), "uncommon")

    # ---- Alpes ----
    add("Dahu Sidestep", 1, "Skill", "Gain 4 block. Draw 1.",
        (lambda g: (g.gain_block(4), g.draw(1), "Sidestep +4 block, drew 1.")[-1]))
    add("Avalanche Chant", 2, "Skill", "Negate 8 from enemy attack.",
        (lambda g: (g.negate_enemy_attack(8), "Snow muffles claws.")[-1]), "uncommon")
    add("Loup des Alpes", 1, "Attack", "Deal 6. If enemy Weak, +3.",
        (lambda g: (g.deal_damage(6 + (3 if g.enemy['weak'] > 0 else 0), "You"),
                    f"Wolf tears for {6 + (3 if g.enemy['weak'] > 0 else 0)}.")[-1]))

    # ---- Auvergne ----
    add("Bête du Gévaudan", 2, "Attack", "Deal 14.", atk(14), "uncommon")
    add("Volcan's Breath", 1, "Power", "+1 strength. Apply 1 Vulnerable.",
        (lambda g: (g.player.__setitem__("strength", g.player["strength"] + 1),
                    g.enemy.__setitem__("vuln", g.enemy["vuln"] + 1),
                    "+1 STR, +1 Vuln")[-1]), "uncommon")
    add("Cantal Shield", 1, "Skill", "Gain 7 block.", block(7))

    # ---- Val de Loire ----
    add("Mélusine's Veil", 1, "Skill", "Gain 5 block. +1 energy next turn.",
        (lambda g: (g.gain_block(5), g.add_next_energy(1), "Veil: +5 block, +1 energy next turn.")[-1]), "uncommon")
    add("Gargantua's Step", 2, "Attack", "Deal 9. Draw 1.",
        (lambda g: (g.deal_damage(9, "You"), g.draw(1), "Stomp for 9; drew 1.")[-1]))
    add("Château Ruse", 1, "Skill", "Apply 1 Weak and 1 Vulnerable.",
        (lambda g: (g.apply_weak(1), g.apply_vuln(1), "Cunning: 1 Weak + 1 Vuln.")[-1]))

    # ---- Ardennes ----
    add("Bayard's Hoofbeat", 1, "Attack", "Deal 4 twice.",
        (lambda g: (g.deal_damage(4, "You"), g.deal_damage(4, "You"), "Hoofbeat 4x2.")[-1]))
    add("Forest Ambush", 0, "Skill", "If enemy intends Attack, gain 8 block.", None)
    add("Smugglers' Wile", 1, "Skill", "Draw 2. Discard 1.", None)

    # ---- Occitanie ----
    add("Lou Pastre Ballad", 1, "Power", "At end of turn, gain 2 block.",
        (lambda g: (g.player.__setitem__("song_block", g.player["song_block"] + 2),
                    "Ballad: +2 end-of-turn block.")[-1]), "uncommon")
    add("Fées de l'Orb", 1, "Skill", "Heal 3. Draw 1.",
        (lambda g: (g.heal(3), g.draw(1), "Fairies: heal 3, drew 1.")[-1]))
    add("Cathar Resolve", 2, "Skill", "Gain 9 block. Remove Weak from you.",
        (lambda g: (g.gain_block(9),
                    g.player.__setitem__("weak", max(0, g.player['weak'] - 1)),
                    "Resolve: +9 block; cleansed 1 Weak.")[-1]), "uncommon")

    # ---- Corse (NEW) ----
    add("Mazzeru's Vision", 1, "Skill", "Look at enemy's next 2 intents. Draw 1.",
        (lambda g: (g.reveal_intents(2), g.draw(1), "The mazzeru sees what comes...")[-1]), "uncommon")
    add("Vendetta Strike", 1, "Attack", "Deal 5 + 2 per damage taken this fight.",
        None, "rare")  # special
    add("Maquis Ambush", 0, "Attack", "Deal 3. If enemy intends Attack, deal 8 instead.",
        None)  # special

    # ---- Alsace (NEW) ----
    add("Stork's Blessing", 1, "Skill", "Heal 4. Gain 4 block.",
        (lambda g: (g.heal(4), g.gain_block(4), "Stork brings good fortune: heal 4, +4 block.")[-1]))
    add("Hans Trapp's Fury", 2, "Attack", "Deal 8. Apply 2 Weak.",
        (lambda g: (g.deal_damage(8, "You"), g.apply_weak(2), "Hans Trapp rages: 8 dmg + 2 Weak!")[-1]), "uncommon")
    add("Rhine Gold", 0, "Skill", "Gain 1 energy. Gain 3 block.",
        (lambda g: (g.change_energy(1), g.gain_block(3), "Golden light: +1 energy, +3 block.")[-1]), "uncommon")

    return db


CARD_DB = make_card_db()

# ---------------------- Relics ----------------------
RELICS = [
    {"name": "Burning Blood", "desc": "Heal 8 HP after each combat.", "effect": "heal_after_combat", "value": 8},
    {"name": "Orichalcum", "desc": "Gain 6 block if you end turn with 0 block.", "effect": "end_turn_block", "value": 6},
    {"name": "Vajra", "desc": "+1 Strength permanently.", "effect": "strength", "value": 1},
    {"name": "Anchor", "desc": "Start each combat with 10 block.", "effect": "start_block", "value": 10},
    {"name": "Horn Cleat", "desc": "Start 2nd turn with +1 energy.", "effect": "second_turn_energy", "value": 1},
    {"name": "Bag of Marbles", "desc": "Enemies start with 1 Vulnerable.", "effect": "start_vuln", "value": 1},
    {"name": "Red Skull", "desc": "+3 Strength when HP below 50%.", "effect": "low_hp_strength", "value": 3},
    {"name": "Pen Nib", "desc": "Every 10th attack deals double damage.", "effect": "pen_nib", "value": 10},
    {"name": "Torii", "desc": "If you take 5 or less damage, reduce to 1.", "effect": "torii", "value": 5},
    {"name": "Meat on Bone", "desc": "Heal 12 HP after combat if below 50% HP.", "effect": "conditional_heal", "value": 12},
]

# ---------------------- Potions ----------------------
POTIONS = [
    {"name": "Fire Potion", "desc": "Deal 20 damage.", "action": "damage", "value": 20},
    {"name": "Block Potion", "desc": "Gain 12 block.", "action": "block", "value": 12},
    {"name": "Strength Potion", "desc": "+3 Strength this combat.", "action": "strength", "value": 3},
    {"name": "Swift Potion", "desc": "Draw 3 cards.", "action": "draw", "value": 3},
    {"name": "Fear Potion", "desc": "Apply 3 Vulnerable.", "action": "vuln", "value": 3},
    {"name": "Weak Potion", "desc": "Apply 3 Weak.", "action": "weak", "value": 3},
    {"name": "Regen Potion", "desc": "Heal 10 HP.", "action": "heal", "value": 10},
    {"name": "Energy Potion", "desc": "+2 Energy this turn.", "action": "energy", "value": 2},
]

# ---------------------- Enemies ----------------------
ENEMIES = [
    # Tier 1 — Common creatures of French folklore
    {"name": "Loup-Garou", "max_hp": 42, "atk_min": 6, "atk_max": 9, "block_chance": 0.20,
     "special": None, "tier": 1,
     "lore": "A cursed soul doomed to prowl the countryside under the full moon."},
    {"name": "Bête du Gévaudan", "max_hp": 48, "atk_min": 7, "atk_max": 11, "block_chance": 0.25,
     "special": None, "tier": 1,
     "lore": "The infamous beast that terrorized Gévaudan from 1764 to 1767, killing over 100 victims."},
    {"name": "Korrigan", "max_hp": 35, "atk_min": 5, "atk_max": 8, "block_chance": 0.15,
     "special": "steal_energy", "tier": 1,
     "lore": "Mischievous Breton dwarf-spirits who dance around dolmens at night and punish the rude."},
    {"name": "Maître Renard", "max_hp": 38, "atk_min": 5, "atk_max": 9, "block_chance": 0.20,
     "special": "trickster", "tier": 1,
     "lore": "The cunning fox from the Roman de Renart, who outwits every beast in the kingdom."},

    # Tier 2 — Regional legends
    {"name": "Tarasque", "max_hp": 60, "atk_min": 6, "atk_max": 9, "block_chance": 0.35,
     "special": "thorns", "tier": 2,
     "lore": "Dragon-turtle of the Rhône, tamed only by Saint Martha of Tarascon."},
    {"name": "Ankou", "max_hp": 55, "atk_min": 8, "atk_max": 12, "block_chance": 0.30,
     "special": "life_drain", "tier": 2,
     "lore": "Breton personification of Death, driving a creaking cart to collect the departed."},
    {"name": "Drac", "max_hp": 52, "atk_min": 9, "atk_max": 13, "block_chance": 0.20,
     "special": "multi_hit", "tier": 2,
     "lore": "Shape-shifting water dragon of the Rhône who lures victims beneath the current."},
    {"name": "Dame Blanche", "max_hp": 45, "atk_min": 5, "atk_max": 7, "block_chance": 0.40,
     "special": "weaken_player", "tier": 2,
     "lore": "Spectral lady haunting bridges and castles, demanding a dance — or cursing those who refuse."},
    {"name": "Jean de l'Ours", "max_hp": 62, "atk_min": 7, "atk_max": 10, "block_chance": 0.30,
     "special": "auto_block", "tier": 2,
     "lore": "Half-man, half-bear of the Pyrenees — born of a woman stolen by a bear, strong as iron."},

    # Tier 3 — Legendary terrors
    {"name": "Gargantua", "max_hp": 75, "atk_min": 10, "atk_max": 14, "block_chance": 0.25,
     "special": "crush", "tier": 3,
     "lore": "Rabelais' giant king whose appetite shaped the very landscape of France."},
    {"name": "Mélusine", "max_hp": 68, "atk_min": 8, "atk_max": 11, "block_chance": 0.30,
     "special": "regen", "tier": 3,
     "lore": "Serpent-fairy of Lusignan, cursed to transform each Saturday — ancestress of royal bloodlines."},
    {"name": "Le Diable de Laval", "max_hp": 85, "atk_min": 11, "atk_max": 16, "block_chance": 0.20,
     "special": "enrage", "tier": 3,
     "lore": "The Devil himself appeared in Laval in 1453, setting fire to the town in a single night."},
    {"name": "La Vouivre", "max_hp": 72, "atk_min": 9, "atk_max": 13, "block_chance": 0.25,
     "special": "venom", "tier": 3,
     "lore": "Winged serpent of Franche-Comté, guarding treasure with a blazing ruby on its brow."},

    # Tier 4 — Bosses
    {"name": "Grand Veneur", "max_hp": 100, "atk_min": 12, "atk_max": 18, "block_chance": 0.30,
     "special": "summon_hounds", "tier": 4,
     "lore": "Phantom huntsman of Fontainebleau forest, whose spectral pack was witnessed by Henri IV himself."},
    {"name": "Fée Morgane", "max_hp": 90, "atk_min": 9, "atk_max": 13, "block_chance": 0.35,
     "special": "mirror", "tier": 4,
     "lore": "Enchantress of Brocéliande, half-sister of King Arthur, mistress of illusions and fate."},
]

# ---------------------- Meta Progression ----------------------
META_UPGRADES = [
    {"id": "max_hp", "name": "Vitality", "desc": "+5 max HP per rank",
     "max_rank": 6, "base_cost": 15, "cost_inc": 10},
    {"id": "start_gold", "name": "Golden Heritage", "desc": "+15 starting gold per rank",
     "max_rank": 5, "base_cost": 10, "cost_inc": 8},
    {"id": "start_str", "name": "Ancestral Strength", "desc": "+1 starting Strength per rank",
     "max_rank": 3, "base_cost": 30, "cost_inc": 25},
    {"id": "potion_slot", "name": "Satchel", "desc": "+1 potion slot",
     "max_rank": 2, "base_cost": 25, "cost_inc": 30},
    {"id": "start_potion", "name": "Preparation", "desc": "Start with a random potion",
     "max_rank": 1, "base_cost": 20, "cost_inc": 0},
    {"id": "card_draw", "name": "Insight", "desc": "+1 card drawn per turn",
     "max_rank": 2, "base_cost": 40, "cost_inc": 35},
    {"id": "start_armor", "name": "Tough Skin", "desc": "+1 passive armor per rank",
     "max_rank": 3, "base_cost": 20, "cost_inc": 15},
    {"id": "heal_on_win", "name": "Second Breath", "desc": "+3 heal after each combat per rank",
     "max_rank": 4, "base_cost": 12, "cost_inc": 10},
]


class MetaProgress:
    """Persistent progression that survives death."""

    def __init__(self):
        self.legacy_points = 0
        self.total_runs = 0
        self.best_floor = 0
        self.total_kills = 0
        self.upgrades = {}  # id -> rank
        self.load()

    def load(self):
        if not os.path.exists(META_FILE):
            return
        try:
            with open(META_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            self.legacy_points = data.get("legacy_points", 0)
            self.total_runs = data.get("total_runs", 0)
            self.best_floor = data.get("best_floor", 0)
            self.total_kills = data.get("total_kills", 0)
            self.upgrades = data.get("upgrades", {})
        except (json.JSONDecodeError, IOError):
            pass

    def save(self):
        os.makedirs(SAVE_DIR, exist_ok=True)
        data = {
            "legacy_points": self.legacy_points,
            "total_runs": self.total_runs,
            "best_floor": self.best_floor,
            "total_kills": self.total_kills,
            "upgrades": self.upgrades,
        }
        with open(META_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    def rank(self, upgrade_id):
        return self.upgrades.get(upgrade_id, 0)

    def cost(self, upgrade_id):
        for u in META_UPGRADES:
            if u["id"] == upgrade_id:
                return u["base_cost"] + u["cost_inc"] * self.rank(upgrade_id)
        return 999

    def can_buy(self, upgrade_id):
        for u in META_UPGRADES:
            if u["id"] == upgrade_id:
                return self.rank(upgrade_id) < u["max_rank"] and self.legacy_points >= self.cost(upgrade_id)
        return False

    def buy(self, upgrade_id):
        if not self.can_buy(upgrade_id):
            return False
        self.legacy_points -= self.cost(upgrade_id)
        self.upgrades[upgrade_id] = self.rank(upgrade_id) + 1
        self.save()
        return True

    def record_run(self, floor, kills):
        """Called on death: award legacy points based on performance."""
        self.total_runs += 1
        self.total_kills += kills
        if floor > self.best_floor:
            self.best_floor = floor
        # Legacy points formula: floor reached + bonus for milestones
        points = floor * 3 + kills
        if floor >= 5:
            points += 10
        if floor >= 10:
            points += 20
        if floor >= 15:
            points += 30
        self.legacy_points += points
        self.save()
        return points


# ---------------------- Game State ----------------------
class Game:
    def __init__(self, app, meta=None):
        self.app = app
        self.meta = meta or MetaProgress()
        self.level = 0
        self.kills = 0

        # Apply meta upgrades to base stats
        bonus_hp = self.meta.rank("max_hp") * 5
        base_hp = 65 + bonus_hp
        self.player = {
            "max_hp": base_hp, "hp": base_hp, "block": 0,
            "armor": self.meta.rank("start_armor"),
            "strength": self.meta.rank("start_str"),
            "weak": 0, "song_block": 0
        }
        self.energy = 3
        self.next_energy = 0
        self.draw_pile = []
        self.discard = []
        self.hand = []
        self.exhaust = []
        self.log = "Welcome, hero!"
        self.enemy = None
        self.enemy_intent = {"type": "attack", "value": 6}
        self.handsize = 5 + self.meta.rank("card_draw")
        self.in_reward = False
        self.reward_choices = []
        self.reward_type = "card"  # card, relic, potion, shop
        self.gold = self.meta.rank("start_gold") * 15
        self.in_shop = False
        self.shop_items = []
        self.relics = []
        self.potions = []
        self.max_potions = 3 + self.meta.rank("potion_slot")
        self.heal_on_win_bonus = self.meta.rank("heal_on_win") * 3
        self.damage_taken_this_combat = 0
        self.attacks_played = 0
        self.turn_number = 0
        self.rampage_bonus = {}
        self.revealed_intents = []

        # Starting potion from meta
        if self.meta.rank("start_potion") > 0:
            self.potions.append(random.choice(POTIONS).copy())

        # starting deck
        start = ["Strike"] * 5 + ["Defend"] * 4 + ["Lunge", "Expose", "Focus"]
        self.deck = [CARD_DB[n].copy() for n in start]
        random.shuffle(self.deck)
        self.draw_pile = self.deck[:]
        self.discard.clear()
        self.exhaust.clear()
        self.next_enemy()

    # ---------- Utilities ----------
    def defer_win(self):
        if self.in_reward:
            return
        self.in_reward = True
        self.app.root.after_idle(self.win_battle)

    def clamp(self):
        self.player["hp"] = max(0, min(self.player["hp"], self.player["max_hp"]))

    def change_energy(self, d):
        self.energy = max(0, self.energy + d)

    def add_next_energy(self, n):
        self.next_energy += n

    def self_damage(self, n):
        self.player["hp"] -= n
        self.damage_taken_this_combat += n
        self.clamp()

    def deal_damage(self, amount, source="You"):
        if source == "You":
            amount += self.player["strength"]
            # low HP strength from Red Skull relic
            if self.has_relic("Red Skull") and self.player["hp"] < self.player["max_hp"] * 0.5:
                amount += 3
            if self.player["weak"] > 0:
                amount = int(amount * 0.75)
            # Pen Nib relic
            if self.has_relic("Pen Nib") and self.attacks_played > 0 and self.attacks_played % 10 == 0:
                amount *= 2
        if self.enemy["vuln"] > 0 and source == "You":
            amount = int(amount * 1.5)
        amount = max(0, amount)
        # enemy block
        if self.enemy["block"] > 0:
            absorb = min(self.enemy["block"], amount)
            self.enemy["block"] -= absorb
            amount -= absorb
        self.enemy["hp"] -= amount
        # Thorns special
        if source == "You" and self.enemy.get("special") == "thorns":
            thorn_dmg = 2
            self.player["hp"] -= thorn_dmg
            self.clamp()
        return f"{source} deals {amount}."

    def gain_block(self, n):
        n += self.player["armor"]
        self.player["block"] += n

    def heal(self, n):
        self.player["hp"] += n
        self.clamp()

    def draw(self, n):
        for _ in range(n):
            if not self.draw_pile:
                if not self.discard:
                    break
                random.shuffle(self.discard)
                self.draw_pile = self.discard
                self.discard = []
            self.hand.append(self.draw_pile.pop())

    def apply_vuln(self, n):
        self.enemy["vuln"] += n

    def apply_weak(self, n):
        self.enemy["weak"] += n

    def discard_or_exhaust(self, card):
        """Send card to exhaust if it has Exhaust keyword, otherwise discard."""
        if "Exhaust." in card.get("text", ""):
            self.exhaust.append(card)
        else:
            self.discard.append(card)

    def negate_enemy_attack(self, n):
        if self.enemy_intent["type"] == "attack":
            self.enemy_intent["value"] = max(0, self.enemy_intent["value"] - n)

    def has_relic(self, name):
        return any(r["name"] == name for r in self.relics)

    def reveal_intents(self, n):
        self.revealed_intents = []
        for _ in range(n):
            if random.random() < self.enemy["block_chance"]:
                self.revealed_intents.append({"type": "block", "value": random.randint(6, 10)})
            else:
                self.revealed_intents.append({"type": "attack",
                                              "value": random.randint(self.enemy["atk_min"], self.enemy["atk_max"])})

    def use_potion(self, idx):
        if idx < 0 or idx >= len(self.potions):
            return
        if self.in_reward:
            return
        p = self.potions.pop(idx)
        if p["action"] == "damage":
            self.deal_damage(p["value"], "You")
            self.log = f"Used {p['name']}: {p['value']} damage!"
        elif p["action"] == "block":
            self.gain_block(p["value"])
            self.log = f"Used {p['name']}: +{p['value']} block!"
        elif p["action"] == "strength":
            self.player["strength"] += p["value"]
            self.log = f"Used {p['name']}: +{p['value']} STR!"
        elif p["action"] == "draw":
            self.draw(p["value"])
            self.log = f"Used {p['name']}: drew {p['value']}!"
        elif p["action"] == "vuln":
            self.apply_vuln(p["value"])
            self.log = f"Used {p['name']}: {p['value']} Vulnerable!"
        elif p["action"] == "weak":
            self.apply_weak(p["value"])
            self.log = f"Used {p['name']}: {p['value']} Weak!"
        elif p["action"] == "heal":
            self.heal(p["value"])
            self.log = f"Used {p['name']}: healed {p['value']}!"
        elif p["action"] == "energy":
            self.change_energy(p["value"])
            self.log = f"Used {p['name']}: +{p['value']} energy!"
        if self.enemy and self.enemy["hp"] <= 0:
            self.app.root.after_idle(self.win_battle)
            return
        self.app.redraw()

    # ---------- Turn Flow ----------
    def next_enemy(self):
        # Pick enemy based on level tier
        tier = 1
        if self.level >= 3:
            tier = 2
        if self.level >= 6:
            tier = 3
        if self.level >= 9:
            tier = 4

        candidates = [e for e in ENEMIES if e["tier"] <= tier]
        # Prefer higher-tier enemies at higher levels
        weights = [e["tier"] ** 2 for e in candidates]
        template = random.choices(candidates, weights=weights, k=1)[0].copy()

        # Scaling: steep early, punishing after floor 20
        lvl = self.level
        if lvl <= 20:
            scale = 1.0 + 0.18 * lvl
        else:
            over = lvl - 20
            scale = 4.6 + 0.35 * over + 0.02 * over * over
        template["max_hp"] = int(template["max_hp"] * scale)
        template["atk_min"] = int(template["atk_min"] * scale)
        template["atk_max"] = int(template["atk_max"] * scale)
        self.enemy = {**template, "hp": template["max_hp"], "block": 0, "vuln": 0, "weak": 0,
                      "enrage_stacks": 0, "lore": template.get("lore", "")}
        self.damage_taken_this_combat = 0
        self.turn_number = 0
        self.revealed_intents = []
        self.rampage_bonus = {}

        # Relic: Bag of Marbles
        if self.has_relic("Bag of Marbles"):
            self.enemy["vuln"] += 1

        # Relic: Anchor
        if self.has_relic("Anchor"):
            self.player["block"] += 10

        self.in_reward = False
        self.start_player_turn()
        self.pick_enemy_intent()
        self.log = f"A {self.enemy['name']} appears!"

    def start_player_turn(self):
        self.turn_number += 1
        self.energy = 3 + self.next_energy
        self.next_energy = 0
        self.player["block"] = 0

        # Relic: Horn Cleat
        if self.has_relic("Horn Cleat") and self.turn_number == 2:
            self.energy += 1

        self.draw(self.handsize)

    def end_player_turn(self):
        # End-of-turn effects
        if self.player["song_block"] > 0:
            self.player["block"] += self.player["song_block"]

        # Relic: Orichalcum
        if self.has_relic("Orichalcum") and self.player["block"] == 0:
            self.player["block"] += 6

        # Enemy acts
        self.enemy_act()
        # Decay statuses
        self.tick_status()
        # Discard hand
        self.discard.extend(self.hand)
        self.hand = []
        if self.enemy["hp"] <= 0:
            self.defer_win()
            return
        if self.player["hp"] <= 0:
            self.lose_game()
            return
        self.start_player_turn()
        self.pick_enemy_intent()
        self.app.redraw()

    def tick_status(self):
        if self.enemy["vuln"] > 0:
            self.enemy["vuln"] -= 1
        if self.enemy["weak"] > 0:
            self.enemy["weak"] -= 1
        if self.player["weak"] > 0:
            self.player["weak"] -= 1

    def pick_enemy_intent(self):
        if random.random() < self.enemy["block_chance"]:
            self.enemy_intent = {"type": "block", "value": random.randint(6, 10)}
        else:
            val = random.randint(self.enemy["atk_min"], self.enemy["atk_max"])
            special = self.enemy.get("special")
            if special == "multi_hit":
                self.enemy_intent = {"type": "attack", "value": val // 2, "hits": 2}
            elif special == "crush" and random.random() < 0.3:
                self.enemy_intent = {"type": "attack", "value": int(val * 1.5), "hits": 1}
            else:
                self.enemy_intent = {"type": "attack", "value": val, "hits": 1}

    def enemy_act(self):
        special = self.enemy.get("special")
        # Auto-block: Jean de l'Ours gains cycling block each turn
        if special == "auto_block":
            cycle = [3, 4, 5, 6]
            ab = cycle[(self.turn_number - 1) % len(cycle)]
            self.enemy["block"] += ab
            self.log = f"{self.enemy['name']} braces with bear-strength (+{ab} block). "
        if self.enemy_intent["type"] == "attack":
            hits = self.enemy_intent.get("hits", 1)
            total = 0
            for _ in range(hits):
                dmg = self.enemy_intent["value"]
                if self.enemy["weak"] > 0:
                    dmg = int(dmg * 0.75)
                # Enrage bonus
                dmg += self.enemy.get("enrage_stacks", 0)
                # Relic: Torii
                if self.has_relic("Torii") and dmg <= 5 and dmg > 0:
                    dmg = 1
                # player's block absorbs
                if self.player["block"] > 0:
                    ab = min(self.player["block"], dmg)
                    self.player["block"] -= ab
                    dmg -= ab
                actual = max(0, dmg)
                self.player["hp"] -= actual
                self.damage_taken_this_combat += actual
                total += actual
                # Life drain
                if special == "life_drain":
                    self.enemy["hp"] = min(self.enemy["max_hp"], self.enemy["hp"] + actual // 2)
            self.clamp()
            hit_text = f" x{hits}" if hits > 1 else ""
            self.log = f"{self.enemy['name']} strikes for {self.enemy_intent['value']}{hit_text}."
        else:
            self.enemy["block"] += self.enemy_intent["value"]
            self.log = f"{self.enemy['name']} braces (+{self.enemy_intent['value']} block)."

        # Post-attack specials
        if special == "steal_energy" and random.random() < 0.3:
            self.next_energy -= 1
            self.log += " Drains your energy! (-1 energy next turn)"

        if special == "weaken_player" and random.random() < 0.4:
            self.player["weak"] += 1
            self.log += " Applied 1 Weak!"

        if special == "regen":
            regen_amt = max(2, int(self.enemy["max_hp"] * 0.04))
            self.enemy["hp"] = min(self.enemy["max_hp"], self.enemy["hp"] + regen_amt)
            self.log += f" Regenerated {regen_amt}."

        if special == "enrage":
            self.enemy["enrage_stacks"] = self.enemy.get("enrage_stacks", 0) + 1
            self.log += f" Enraged! (+{self.enemy['enrage_stacks']} dmg)"

        if special == "summon_hounds" and self.turn_number % 3 == 0:
            # Hounds deal flat damage
            hound_dmg = 4
            self.player["hp"] -= max(0, hound_dmg)
            self.clamp()
            self.log += f" Hounds bite for {hound_dmg}!"

        if special == "mirror" and random.random() < 0.25:
            self.enemy["block"] += 8
            self.log += " Mirror: +8 block!"

        if special == "trickster" and random.random() < 0.35:
            trick = random.randint(0, 2)
            if trick == 0:
                self.player["weak"] += 1
                self.log += " Renard's trick: 1 Weak!"
            elif trick == 1:
                self.enemy["block"] += 6
                self.log += " Renard dodges behind cover (+6 block)!"
            else:
                if self.draw_pile:
                    idx = random.randint(0, len(self.draw_pile) - 1)
                    stolen = self.draw_pile.pop(idx)
                    self.exhaust.append(stolen)
                    self.log += f" Renard snatches {stolen['name']} from your deck!"

        if special == "venom":
            vdmg = 3 + self.turn_number
            self.player["hp"] -= vdmg
            self.clamp()
            self.log += f" Vouivre's venom burns for {vdmg}!"

    def play_card(self, idx):
        if self.in_reward:
            return
        if idx < 0 or idx >= len(self.hand):
            return

        card = self.hand[idx]

        if card["cost"] > self.energy:
            self.log = "Not enough energy."
            self.app.redraw()
            return

        played = self.hand.pop(idx)
        self.energy -= played["cost"]

        if played["type"] == "Attack":
            self.attacks_played += 1

        # ---- Special cards ----
        if played["name"] == "Dame Blanche":
            if self.enemy["hp"] <= 0:
                self.app.root.after_idle(self.win_battle)
                return
            top = self.peek_draw(2)
            self.show_scry(top)
            self.discard_or_exhaust(played)
            self.app.redraw()
            return

        if played["name"] == "Forest Ambush":
            if self.enemy_intent["type"] == "attack":
                self.gain_block(8)
                self.log = "Ambush: +8 block."
            else:
                self.log = "Ambush fizzles."
            self.discard_or_exhaust(played)
            self.app.redraw()
            return

        if played["name"] == "Smugglers' Wile":
            self.draw(2)
            if self.hand:
                thrown = self.hand.pop(-1)
                self.discard.append(thrown)
            self.discard_or_exhaust(played)
            self.log = "Wile: drew 2, discarded last."
            self.app.redraw()
            return

        if played["name"] == "Whirlwind":
            times = max(1, self.energy)
            self.energy = 0
            for _ in range(times):
                self.deal_damage(4, "You")
            self.discard_or_exhaust(played)
            self.log = f"Whirlwind: 4 damage x{times}!"
            if self.enemy["hp"] <= 0:
                self.app.root.after_idle(self.win_battle)
                return
            self.app.redraw()
            return

        if played["name"] == "Second Wind":
            cards_in_hand = len(self.hand)
            self.gain_block(3 * cards_in_hand)
            self.discard_or_exhaust(played)
            self.log = f"Second Wind: +{3 * cards_in_hand} block ({cards_in_hand} cards)!"
            self.app.redraw()
            return

        if played["name"] == "Rampage":
            # Global dict, reset each combat in next_enemy()
            bonus = self.rampage_bonus.get("Rampage", 0)
            base_dmg = 8 + bonus
            self.deal_damage(base_dmg, "You")
            self.rampage_bonus["Rampage"] = bonus + 4
            next_dmg = 8 + bonus + 4
            played["text"] = f"Deal {next_dmg} damage. +4 per play this combat."
            self.discard_or_exhaust(played)
            self.log = f"Rampage: {base_dmg} damage."
            if self.enemy["hp"] <= 0:
                self.app.root.after_idle(self.win_battle)
                return
            self.app.redraw()
            return

        if played["name"] == "Body Slam":
            dmg = self.player["block"]
            self.deal_damage(dmg, "You")
            self.discard_or_exhaust(played)
            self.log = f"Body Slam: {dmg} damage (from block)!"
            if self.enemy["hp"] <= 0:
                self.app.root.after_idle(self.win_battle)
                return
            self.app.redraw()
            return

        if played["name"] == "Vendetta Strike":
            bonus = self.damage_taken_this_combat * 2
            self.deal_damage(5 + bonus, "You")
            self.discard_or_exhaust(played)
            self.log = f"Vendetta: {5 + bonus} damage ({self.damage_taken_this_combat} dmg taken)!"
            if self.enemy["hp"] <= 0:
                self.app.root.after_idle(self.win_battle)
                return
            self.app.redraw()
            return

        if played["name"] == "Maquis Ambush":
            if self.enemy_intent["type"] == "attack":
                self.deal_damage(8, "You")
                self.log = "Maquis Ambush: 8 damage!"
            else:
                self.deal_damage(3, "You")
                self.log = "Maquis Ambush: 3 damage."
            self.discard_or_exhaust(played)
            if self.enemy["hp"] <= 0:
                self.app.root.after_idle(self.win_battle)
                return
            self.app.redraw()
            return

        # Normal effect path
        try:
            if played["effect"] is not None:
                msg = played["effect"](self)
            else:
                msg = played["text"]
        except Exception as e:
            self.discard_or_exhaust(played)
            self.log = f"Card error: {e}"
            self.app.redraw()
            return

        self.discard_or_exhaust(played)
        self.log = msg or played["text"]

        if self.enemy["hp"] <= 0:
            self.app.root.after_idle(self.win_battle)
            return

        self.app.redraw()

    def peek_draw(self, n):
        return self.draw_pile[-n:][::-1] if self.draw_pile else []

    def show_scry(self, cards):
        if not cards:
            self.log = "Nothing to scry."
            return

        def discard_all():
            for _ in range(len(cards)):
                if self.draw_pile:
                    self.discard.append(self.draw_pile.pop())
            top.destroy()
            self.log = "Discarded scryed cards."
            self.app.redraw()

        def keep_all():
            top.destroy()
            self.log = "Kept scryed cards."
            self.app.redraw()

        def discard_first():
            if self.draw_pile:
                self.discard.append(self.draw_pile.pop())
            top.destroy()
            self.log = "Discarded first."
            self.app.redraw()

        top = tk.Toplevel(self.app.root)
        top.title("Dame Blanche — Scry 2")
        top.configure(bg="#101418")
        tk.Label(top, text="\nScry 2: choose what to discard from the top of the draw pile.\n",
                 fg="#e6f0ff", bg="#101418").pack()
        tk.Label(top, text="\n".join([c["name"] for c in cards]) or "(vide)",
                 fg="#cfe0ff", bg="#101418").pack(pady=6)
        bar = tk.Frame(top, bg="#101418")
        bar.pack(pady=10)
        tk.Button(bar, text="Discard both", command=discard_all).pack(side="left", padx=6)
        tk.Button(bar, text="Keep both", command=keep_all).pack(side="left", padx=6)
        tk.Button(bar, text="Discard first", command=discard_first).pack(side="left", padx=6)

    def win_battle(self):
        self.in_reward = True
        self.level += 1
        self.kills += 1
        self.player["block"] = 0
        self.enemy_intent = {"type": "none", "value": 0}

        # Relic heals + meta heal bonus
        heal_amt = 6 + self.heal_on_win_bonus
        if self.has_relic("Burning Blood"):
            heal_amt += 8
        if self.has_relic("Meat on Bone") and self.player["hp"] < self.player["max_hp"] * 0.5:
            heal_amt += 12
        self.heal(heal_amt)

        # Auto-save after each victory
        self.save_run()

        # Gold reward
        gold_gain = random.randint(10, 25) + self.level * 2
        self.gold += gold_gain

        # Decide reward type
        roll = random.random()
        if roll < 0.15 and len(self.potions) < self.max_potions:
            self.reward_type = "potion"
            self.reward_choices = random.sample(POTIONS, k=min(3, len(POTIONS)))
            self.log = f"Victory! +{gold_gain} gold. Choose a potion."
        elif roll < 0.25 and self.level % 3 == 0:
            self.reward_type = "relic"
            available = [r for r in RELICS if not self.has_relic(r["name"])]
            if available:
                self.reward_choices = random.sample(available, k=min(3, len(available)))
                self.log = f"Victory! +{gold_gain} gold. Choose a relic!"
            else:
                self._card_reward(gold_gain)
        else:
            self._card_reward(gold_gain)

        self.app.redraw()

    def _card_reward(self, gold_gain):
        self.reward_type = "card"
        region = random.choice(list(REGIONS.keys()))
        themed = REGIONS[region]
        pool = list(themed)
        # Always include power cards so they show up regularly
        pool += ["Lunge", "Expose", "Focus", "Hamper", "Fortify", "Rally",
                 "Cleave", "Blood Pact", "Perfect Guard", "Body Slam", "Second Wind"]
        # Chance for rare cards at higher levels
        if self.level >= 3:
            pool += ["Whirlwind", "Rampage", "Shockwave"]
        if self.level >= 5:
            pool += ["Vendetta Strike", "Adrenaline Rush", "Offering"]
        # Remove basic Strike/Defend from rewards — they dilute the pool
        unique_pool = list(set(pool))
        choices = random.sample(unique_pool, k=min(3, len(unique_pool)))
        self.reward_choices = [CARD_DB[n].copy() for n in choices if n in CARD_DB]
        self.log = f"Victory! +{gold_gain} gold. Choose a card ({region})."

    def take_reward(self, i):
        if not self.in_reward:
            return
        if i is not None and 0 <= i < len(self.reward_choices):
            choice = self.reward_choices[i]
            if self.reward_type == "card":
                self.deck.append(choice.copy())
                self.log = f"Added: {choice['name']}."
            elif self.reward_type == "relic":
                self.relics.append(choice.copy())
                # Apply immediate relic effects
                if choice["effect"] == "strength":
                    self.player["strength"] += choice["value"]
                self.log = f"Relic: {choice['name']} — {choice['desc']}"
            elif self.reward_type == "potion":
                if len(self.potions) < self.max_potions:
                    self.potions.append(choice.copy())
                    self.log = f"Potion: {choice['name']}."
                else:
                    self.log = "Potion inventory full!"
                    return
        else:
            self.log = "Pass."
        self.reward_choices = []

        # Every 3 floors, open shop before next combat
        if self.level % 3 == 0 and self.level > 0:
            self.open_shop()
            return

        # reshuffle
        self.discard.extend(self.hand)
        self.hand = []
        self.draw_pile = self.deck[:] + self.discard
        self.discard = []
        random.shuffle(self.draw_pile)
        self.next_enemy()
        self.app.redraw()

    # ---------- Shop ----------
    def open_shop(self):
        """Generate shop inventory and enter shop mode."""
        self.in_shop = True
        self.in_reward = False
        self.reward_choices = []
        self.shop_items = []

        # 5 cards for sale
        all_cards = list(CARD_DB.keys())
        shop_cards = random.sample(all_cards, k=min(5, len(all_cards)))
        for name in shop_cards:
            card = CARD_DB[name]
            rarity = card.get("rarity", "common")
            price = {"common": 30, "uncommon": 55, "rare": 85}.get(rarity, 40)
            price += random.randint(-5, 5)
            self.shop_items.append({"item": card.copy(), "price": price, "type": "card", "sold": False})

        # 1 potion
        pot = random.choice(POTIONS)
        self.shop_items.append({"item": pot.copy(), "price": random.randint(20, 35), "type": "potion", "sold": False})

        # 1 relic (if available)
        available_relics = [r for r in RELICS if not self.has_relic(r["name"])]
        if available_relics:
            rel = random.choice(available_relics)
            self.shop_items.append({"item": rel.copy(), "price": random.randint(80, 120), "type": "relic", "sold": False})

        # Card removal option
        self.shop_items.append({"item": {"name": "Remove a card", "desc": "Remove a card from your deck."},
                                "price": 50 + self.level * 5, "type": "remove", "sold": False})

        self.log = f"Welcome to the shop! Gold: {self.gold}"
        self.app.redraw()

    def buy_shop_item(self, idx):
        if not self.in_shop:
            return
        if idx < 0 or idx >= len(self.shop_items):
            return
        item = self.shop_items[idx]
        if item["sold"]:
            self.log = "Already bought."
            self.app.redraw()
            return
        if self.gold < item["price"]:
            self.log = "Not enough gold!"
            self.app.redraw()
            return

        self.gold -= item["price"]
        item["sold"] = True

        if item["type"] == "card":
            self.deck.append(item["item"].copy())
            self.log = f"Bought: {item['item']['name']} for {item['price']} gold."
        elif item["type"] == "potion":
            if len(self.potions) < self.max_potions:
                self.potions.append(item["item"].copy())
                self.log = f"Potion bought: {item['item']['name']}."
            else:
                self.gold += item["price"]
                item["sold"] = False
                self.log = "Potion inventory full!"
        elif item["type"] == "relic":
            self.relics.append(item["item"].copy())
            if item["item"].get("effect") == "strength":
                self.player["strength"] += item["item"]["value"]
            self.log = f"Relic bought: {item['item']['name']}."
        elif item["type"] == "remove":
            self.show_card_removal()
            return

        self.app.redraw()

    def show_card_removal(self):
        """Show a dialog to pick which card to remove from deck."""
        top = tk.Toplevel(self.app.root)
        top.title("Remove a card")
        top.configure(bg="#101418")
        top.geometry("400x500")
        tk.Label(top, text="Choose a card to remove from your deck:",
                 fg="#e6f0ff", bg="#101418", font=("Segoe UI", 11, "bold")).pack(pady=10)

        frame = tk.Frame(top, bg="#101418")
        frame.pack(fill="both", expand=True, padx=10, pady=5)

        scrollbar = tk.Scrollbar(frame)
        scrollbar.pack(side="right", fill="y")
        listbox = tk.Listbox(frame, bg="#1a2330", fg="#cfe0ff", font=("Segoe UI", 10),
                             selectmode="single", yscrollcommand=scrollbar.set)
        listbox.pack(fill="both", expand=True)
        scrollbar.config(command=listbox.yview)

        for i, card in enumerate(self.deck):
            rarity = card.get("rarity", "common")
            listbox.insert(tk.END, f"[{rarity[0].upper()}] {card['name']} ({card['type']}, cost {card['cost']})")

        def do_remove():
            sel = listbox.curselection()
            if not sel:
                return
            idx = sel[0]
            removed = self.deck.pop(idx)
            # Mark the remove option as sold
            for si in self.shop_items:
                if si["type"] == "remove":
                    si["sold"] = True
            self.log = f"Removed: {removed['name']} from deck."
            top.destroy()
            self.app.redraw()

        tk.Button(top, text="Remove", command=do_remove,
                  bg="#4a1a1a", fg="#ff8393", relief="flat", padx=12, pady=4).pack(pady=10)

    def leave_shop(self):
        self.in_shop = False
        self.shop_items = []
        # reshuffle and next enemy
        self.discard.extend(self.hand)
        self.hand = []
        self.draw_pile = self.deck[:] + self.discard
        self.discard = []
        random.shuffle(self.draw_pile)
        self.next_enemy()
        self.app.redraw()

    # ---------- Save / Load ----------
    def save_run(self):
        """Save current run state to JSON."""
        os.makedirs(SAVE_DIR, exist_ok=True)
        # Serialize cards by name (effects are lambdas, can't serialize)
        def card_names(cards):
            return [c["name"] for c in cards]

        data = {
            "level": self.level,
            "kills": self.kills,
            "player": self.player.copy(),
            "energy": self.energy,
            "next_energy": self.next_energy,
            "gold": self.gold,
            "handsize": self.handsize,
            "max_potions": self.max_potions,
            "heal_on_win_bonus": self.heal_on_win_bonus,
            "attacks_played": self.attacks_played,
            "rampage_bonus": self.rampage_bonus,
            "deck": card_names(self.deck),
            "draw_pile": card_names(self.draw_pile),
            "discard": card_names(self.discard),
            "hand": card_names(self.hand),
            "relics": [{"name": r["name"]} for r in self.relics],
            "potions": [{"name": p["name"]} for p in self.potions],
            "enemy": {
                "name": self.enemy["name"],
                "hp": self.enemy["hp"],
                "max_hp": self.enemy["max_hp"],
                "block": self.enemy["block"],
                "vuln": self.enemy["vuln"],
                "weak": self.enemy["weak"],
                "atk_min": self.enemy["atk_min"],
                "atk_max": self.enemy["atk_max"],
                "block_chance": self.enemy["block_chance"],
                "special": self.enemy.get("special"),
                "tier": self.enemy.get("tier", 1),
                "enrage_stacks": self.enemy.get("enrage_stacks", 0),
            },
            "enemy_intent": self.enemy_intent,
            "turn_number": self.turn_number,
            "in_reward": self.in_reward,
            "in_shop": self.in_shop,
        }
        with open(SAVE_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    @staticmethod
    def load_run(app, meta):
        """Load a saved run. Returns a Game instance or None."""
        if not os.path.exists(SAVE_FILE):
            return None
        try:
            with open(SAVE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (json.JSONDecodeError, IOError):
            return None

        def cards_from_names(names):
            return [CARD_DB[n].copy() for n in names if n in CARD_DB]

        g = object.__new__(Game)
        g.app = app
        g.meta = meta
        g.level = data["level"]
        g.kills = data.get("kills", 0)
        g.player = data["player"]
        g.energy = data["energy"]
        g.next_energy = data.get("next_energy", 0)
        g.gold = data["gold"]
        g.handsize = data.get("handsize", 5)
        g.max_potions = data.get("max_potions", 3)
        g.heal_on_win_bonus = data.get("heal_on_win_bonus", 0)
        g.attacks_played = data.get("attacks_played", 0)
        g.rampage_bonus = data.get("rampage_bonus", {})
        g.damage_taken_this_combat = 0
        g.revealed_intents = []
        g.turn_number = data.get("turn_number", 0)
        g.exhaust = []
        g.log = "Game loaded!"
        g.in_reward = data.get("in_reward", False)
        g.in_shop = data.get("in_shop", False)
        g.shop_items = []
        g.reward_choices = []
        g.reward_type = "card"

        g.deck = cards_from_names(data["deck"])
        g.draw_pile = cards_from_names(data["draw_pile"])
        g.discard = cards_from_names(data["discard"])
        g.hand = cards_from_names(data["hand"])

        # Restore relics
        g.relics = []
        for r_data in data.get("relics", []):
            for r in RELICS:
                if r["name"] == r_data["name"]:
                    g.relics.append(r.copy())
                    break

        # Restore potions
        g.potions = []
        for p_data in data.get("potions", []):
            for p in POTIONS:
                if p["name"] == p_data["name"]:
                    g.potions.append(p.copy())
                    break

        # Restore enemy
        ed = data["enemy"]
        g.enemy = {
            "name": ed["name"], "hp": ed["hp"], "max_hp": ed["max_hp"],
            "block": ed["block"], "vuln": ed["vuln"], "weak": ed["weak"],
            "atk_min": ed["atk_min"], "atk_max": ed["atk_max"],
            "block_chance": ed["block_chance"],
            "special": ed.get("special"), "tier": ed.get("tier", 1),
            "enrage_stacks": ed.get("enrage_stacks", 0),
        }
        g.enemy_intent = data.get("enemy_intent", {"type": "attack", "value": 6})

        return g

    def delete_run_save(self):
        try:
            if os.path.exists(SAVE_FILE):
                os.remove(SAVE_FILE)
        except IOError:
            pass

    def lose_game(self):
        self.in_reward = False
        self.in_shop = False
        # Record meta-progression on death
        points = self.meta.record_run(self.level, self.kills)
        self.log = (f"You fell at floor {self.level}... +{points} legacy points!"
                    f"\n(R = restart, L = legacy)")
        # Delete run save on death
        self.delete_run_save()
        self.app.redraw()


# ---------------------- UI ----------------------
CARD_W, CARD_H = 140, 88
GAP = 10

class App:
    def __init__(self, root):
        self.root = root
        root.title("Legends of France v2 — Deck-Builder")
        root.configure(bg="#0d1117")

        # Make window resizable and adapt
        root.geometry("1100x700")
        root.minsize(900, 600)

        # Main layout
        main_frame = tk.Frame(root, bg="#0d1117")
        main_frame.pack(fill="both", expand=True)

        # Canvas on left (expandable)
        self.c = tk.Canvas(main_frame, bg="#0d1117", highlightthickness=0)
        self.c.pack(side="left", fill="both", expand=True)

        # Panel on right (fixed width)
        self.panel = tk.Frame(main_frame, width=280, bg="#0d1117")
        self.panel.pack(side="right", fill="y")
        self.panel.pack_propagate(False)

        self.lbl = tk.Label(self.panel, text="LEGENDS OF FRANCE", fg="#e6f0ff", bg="#0d1117",
                            font=("Segoe UI", 14, "bold"))
        self.lbl.pack(pady=(10, 2))

        self.sublbl = tk.Label(self.panel, text="v2", fg="#5a7a9a", bg="#0d1117",
                               font=("Segoe UI", 9))
        self.sublbl.pack(pady=(0, 6))

        self.log = tk.Label(self.panel, text="", fg="#cfe0ff", bg="#0d1117",
                            font=("Segoe UI", 10), wraplength=260, justify="left")
        self.log.pack(pady=(4, 6))

        btn_frame = tk.Frame(self.panel, bg="#0d1117")
        btn_frame.pack(pady=4)
        self.btn_end = tk.Button(btn_frame, text="End Turn", command=self.end_turn,
                                 bg="#1b2533", fg="#e6f0ff", activebackground="#2a3a4f",
                                 relief="flat", padx=12, pady=4)
        self.btn_end.pack(side="left", padx=4)
        self.btn_pass = tk.Button(btn_frame, text="Skip Reward", command=lambda: self.game.take_reward(None),
                                  bg="#1b2533", fg="#e6f0ff", activebackground="#2a3a4f",
                                  relief="flat", padx=12, pady=4)
        self.btn_pass.pack(side="left", padx=4)

        btn_frame2 = tk.Frame(self.panel, bg="#0d1117")
        btn_frame2.pack(pady=2)
        self.btn_leave_shop = tk.Button(btn_frame2, text="Leave Shop", command=lambda: self.game.leave_shop(),
                                        bg="#2a331b", fg="#a0ff8a", activebackground="#3a4f2a",
                                        relief="flat", padx=12, pady=4)
        self.btn_leave_shop.pack(side="left", padx=4)

        # Potions frame
        self.potion_frame = tk.Frame(self.panel, bg="#0d1117")
        self.potion_frame.pack(pady=(6, 2), fill="x", padx=8)
        tk.Label(self.potion_frame, text="Potions:", fg="#9cc1ff", bg="#0d1117",
                 font=("Segoe UI", 9, "bold")).pack(anchor="w")
        self.potion_buttons = []

        # Relics display
        self.relic_lbl = tk.Label(self.panel, text="", fg="#ff9e44", bg="#0d1117",
                                  font=("Segoe UI", 9), wraplength=260, justify="left")
        self.relic_lbl.pack(pady=(4, 2))

        self.info = tk.Label(self.panel, text="", fg="#9cc1ff", bg="#0d1117",
                             font=("Consolas", 10), justify="left")
        self.info.pack(pady=(6, 6))

        # Save / Load / Legacy buttons
        save_frame = tk.Frame(self.panel, bg="#0d1117")
        save_frame.pack(pady=4, fill="x", padx=8)
        tk.Button(save_frame, text="Save", command=self.save_game,
                  bg="#1b3322", fg="#8affb0", relief="flat", font=("Segoe UI", 8),
                  padx=6, pady=2).pack(side="left", padx=2)
        tk.Button(save_frame, text="Load", command=self.load_game,
                  bg="#1b2533", fg="#8ab8ff", relief="flat", font=("Segoe UI", 8),
                  padx=6, pady=2).pack(side="left", padx=2)
        self.btn_legacy = tk.Button(save_frame, text="Legs", command=self.show_legacy,
                                     bg="#331b1b", fg="#ffaa8a", relief="flat", font=("Segoe UI", 8),
                                     padx=6, pady=2)
        self.btn_legacy.pack(side="left", padx=2)

        # Meta stats label
        self.meta_lbl = tk.Label(self.panel, text="", fg="#5a7a5a", bg="#0d1117",
                                  font=("Segoe UI", 8), wraplength=260, justify="left")
        self.meta_lbl.pack(pady=(2, 4))

        self.meta = MetaProgress()
        self.showing_legacy = False

        # Try to load existing save, otherwise new game
        loaded = Game.load_run(self, self.meta)
        if loaded:
            self.game = loaded
        else:
            self.game = Game(self, self.meta)

        self.c.bind("<Button-1>", self.on_click)
        self.c.bind("<Configure>", lambda e: self.redraw())
        root.bind("r", lambda e: self.restart())
        root.bind("R", lambda e: self.restart())
        root.bind("l", lambda e: self.show_legacy())
        root.bind("L", lambda e: self.show_legacy())
        root.bind("s", lambda e: self.save_game())
        root.bind("S", lambda e: self.save_game())
        # Potion hotkeys
        root.bind("1", lambda e: self.game.use_potion(0))
        root.bind("2", lambda e: self.game.use_potion(1))
        root.bind("3", lambda e: self.game.use_potion(2))
        self.redraw()

    def restart(self):
        self.showing_legacy = False
        self.game = Game(self, self.meta)
        self.redraw()

    def save_game(self):
        if self.game.player["hp"] <= 0:
            return
        self.game.save_run()
        self.game.log = "Game saved!"
        self.redraw()

    def load_game(self):
        loaded = Game.load_run(self, self.meta)
        if loaded:
            self.game = loaded
            self.showing_legacy = False
            self.redraw()
        else:
            self.game.log = "No save found."
            self.redraw()

    def show_legacy(self):
        """Toggle the legacy/meta-progression screen."""
        self.showing_legacy = not self.showing_legacy
        self.redraw()

    # ----- Rendering -----
    def redraw(self):
        g = self.game
        self.c.delete("all")
        cw = self.c.winfo_width()
        ch = self.c.winfo_height()
        if cw < 10:
            cw = 780
        if ch < 10:
            ch = 660

        margin = 40

        # Enemy area
        bar_w = min(500, cw - 2 * margin)
        self.draw_bar(margin, 40, bar_w, 20, g.enemy["hp"], g.enemy["max_hp"],
                      label=f"{g.enemy['name']} HP")
        self.c.create_text(margin, 80, anchor="w", fill="#9cc1ff",
                           text=f"Block: {g.enemy['block']}  Vuln: {g.enemy['vuln']}  Weak: {g.enemy['weak']}")

        # Enemy special indicator
        special = g.enemy.get("special")
        if special:
            special_names = {
                "thorns": "Thorns (2 dmg on hit)",
                "life_drain": "Life Drain",
                "multi_hit": "Multi-Hit",
                "steal_energy": "Energy Thief",
                "weaken_player": "Enfeebler",
                "crush": "Crushing Blows",
                "regen": "Regeneration",
                "enrage": f"Enrage (+{g.enemy.get('enrage_stacks', 0)})",
                "summon_hounds": "Hound Master",
                "mirror": "Mirror Shield",
                "auto_block": "Bear Hide (auto-block)",
                "trickster": "Trickster",
                "venom": "Venomous",
            }
            sname = special_names.get(special, special)
            self.c.create_text(margin, 100, anchor="w", fill="#ff6b6b",
                               font=("Segoe UI", 9, "italic"), text=f"Ability: {sname}")

        # Lore
        lore = g.enemy.get("lore", "")
        if lore:
            self.c.create_text(margin, 115, anchor="w", fill="#7a8a9a",
                               font=("Segoe UI", 8, "italic"), text=lore, width=bar_w)

        # Intent
        if g.enemy_intent["type"] != "none":
            it = g.enemy_intent
            if it["type"] == "attack":
                hits = it.get("hits", 1)
                hit_text = f" x{hits}" if hits > 1 else ""
                text = f"Intent: Attack {it['value']}{hit_text}"
                col = "#ff8393"
            else:
                text = f"Intent: Block {it['value']}"
                col = "#8affdb"
            self.c.create_text(margin, 120, anchor="w", fill=col,
                               font=("Segoe UI", 10, "bold"), text=text)

        # Revealed future intents
        if g.revealed_intents:
            y_ri = 140
            self.c.create_text(margin, y_ri, anchor="w", fill="#7a6aff",
                               font=("Segoe UI", 9), text="Future: " +
                               ", ".join(f"{'Atk' if r['type'] == 'attack' else 'Blk'} {r['value']}"
                                         for r in g.revealed_intents))

        # Player area
        py = 180
        self.draw_bar(margin, py, 250, 20, g.player["hp"], g.player["max_hp"],
                      label="Your HP", col="#4adc8f")
        self.c.create_text(margin, py + 38, anchor="w", fill="#9cc1ff",
                           text=f"Block: {g.player['block']}  STR: {g.player['strength']}  Armor: {g.player['armor']}")

        # Energy display (bigger) — offset right to avoid overlapping HP bar
        energy_x = margin + 290
        self.c.create_oval(energy_x, py, energy_x + 40, py + 40,
                           fill="#1b3555", outline="#4a9eff", width=2)
        self.c.create_text(energy_x + 20, py + 20, text=str(g.energy),
                           fill="#4a9eff", font=("Segoe UI", 16, "bold"))
        self.c.create_text(energy_x + 20, py + 50, text="Energy",
                           fill="#5a7a9a", font=("Segoe UI", 8))

        self.c.create_text(margin, py + 58, anchor="w", fill="#5a7a9a",
                           text=f"Draw: {len(g.draw_pile)}  Discard: {len(g.discard)}  Floor: {g.level}  Gold: {g.gold}")

        # Hand — dynamically fit all cards
        hand_y = ch - CARD_H - 30
        self.draw_hand(cw, hand_y)

        # Reward choices
        if g.in_reward and g.reward_choices:
            ry = 300
            reward_label = {"card": "Choose a card", "relic": "Choose a relic", "potion": "Choose a potion"}
            self.c.create_text(margin, ry - 10, anchor="w", fill="#e6f0ff",
                               font=("Segoe UI", 11, "bold"),
                               text=f"Reward: {reward_label.get(g.reward_type, 'Choose')}")

            total_w = len(g.reward_choices) * (CARD_W + GAP) - GAP
            start_x = max(margin, (cw - total_w) // 2)
            for i, choice in enumerate(g.reward_choices):
                x = start_x + i * (CARD_W + GAP)
                if g.reward_type == "card":
                    self.draw_card(x, ry + 10, choice, tag=f"reward_{i}")
                elif g.reward_type == "relic":
                    self.draw_relic_choice(x, ry + 10, choice, tag=f"reward_{i}")
                elif g.reward_type == "potion":
                    self.draw_potion_choice(x, ry + 10, choice, tag=f"reward_{i}")

        # Shop display
        if g.in_shop and g.shop_items:
            self.draw_shop(cw, ch, margin)

        # Log + info
        self.log.config(text=g.log)
        weak_text = f"  Weak: {g.player['weak']}" if g.player['weak'] > 0 else ""
        status = f"Hand: {len(g.hand)}{weak_text}"
        if g.in_shop:
            status = f"Gold: {g.gold}"
        self.info.config(text=status)

        in_action = g.in_reward or g.in_shop
        self.btn_end.config(state=("disabled" if in_action else "normal"))
        self.btn_pass.config(state=("normal" if g.in_reward else "disabled"))
        self.btn_leave_shop.config(state=("normal" if g.in_shop else "disabled"))

        # Update potions display
        for btn in self.potion_buttons:
            btn.destroy()
        self.potion_buttons = []
        for i, p in enumerate(g.potions):
            btn = tk.Button(self.potion_frame, text=f"[{i + 1}] {p['name']}",
                            command=lambda idx=i: g.use_potion(idx),
                            bg="#2a1a33", fg="#dda0ff", relief="flat",
                            font=("Segoe UI", 8), padx=4, pady=1)
            btn.pack(anchor="w", pady=1)
            self.potion_buttons.append(btn)

        # Update relics display
        if g.relics:
            relic_text = "Relics: " + ", ".join(r["name"] for r in g.relics)
            self.relic_lbl.config(text=relic_text)
        else:
            self.relic_lbl.config(text="")

        # Meta stats
        m = self.meta
        self.meta_lbl.config(text=f"Legs: {m.legacy_points}  Runs: {m.total_runs}  Best: {m.best_floor}")

        # Legacy screen overlay
        if self.showing_legacy:
            self.draw_legacy_screen(cw, ch)
            return

        # Lose screen overlay
        if g.player["hp"] <= 0:
            self.c.create_rectangle(0, 0, cw, ch, fill="#000000", stipple="gray50", outline="")
            self.c.create_text(cw // 2, ch // 2 - 40,
                               text="DEFEAT",
                               fill="#ff8393", font=("Segoe UI", 22, "bold"))
            self.c.create_text(cw // 2, ch // 2,
                               text=f"Floor reached: {g.level}  —  Enemies: {g.kills}  —  Gold: {g.gold}",
                               fill="#cfe0ff", font=("Segoe UI", 12))
            self.c.create_text(cw // 2, ch // 2 + 30,
                               text=f"Legacy points earned: +{g.level * 3 + g.kills + (10 if g.level >= 5 else 0) + (20 if g.level >= 10 else 0)}",
                               fill="#ffaa8a", font=("Segoe UI", 11))
            self.c.create_text(cw // 2, ch // 2 + 65,
                               text="R = restart    L = legacy (upgrades)",
                               fill="#9cc1ff", font=("Segoe UI", 11))

    def draw_bar(self, x, y, w, h, now, mx, label="", col="#e95f67"):
        self.c.create_text(x, y - 10, anchor="w", fill="#bcd3ff",
                           font=("Segoe UI", 9), text=label)
        self.c.create_rectangle(x, y, x + w, y + h, fill="#1a2330", outline="#2a3a4f")
        fillw = int(w * max(0, now) / max(1, mx))
        self.c.create_rectangle(x, y, x + fillw, y + h, fill=col, outline="")
        self.c.create_text(x + w - 4, y + h / 2, anchor="e", fill="#e6f0ff",
                           text=f"{now}/{mx}", font=("Consolas", 10))

    def draw_hand(self, canvas_w, y):
        """Draw hand cards, dynamically scaling spacing to fit all cards."""
        g = self.game
        n = len(g.hand)
        if n == 0:
            return

        margin = 40
        available_w = canvas_w - 2 * margin

        # Calculate spacing: overlap cards if too many
        if n == 1:
            spacing = 0
        else:
            ideal_spacing = CARD_W + GAP
            max_spacing = (available_w - CARD_W) / (n - 1)
            spacing = min(ideal_spacing, max_spacing)

        total_w = CARD_W + spacing * (n - 1)
        start_x = max(margin, (canvas_w - total_w) / 2)

        for i, card in enumerate(g.hand):
            x = start_x + i * spacing
            self.draw_card(x, y, card, tag=f"hand_{i}")

    def draw_card(self, x, y, card, tag):
        rarity = card.get("rarity", "common")
        border_col = RARITY_COLORS.get(rarity, "#4a5d7a")
        bg_col = "#1b2533"
        if rarity == "rare":
            bg_col = "#2a1f10"
        elif rarity == "uncommon":
            bg_col = "#0f2a1a"

        self.c.create_rectangle(x, y, x + CARD_W, y + CARD_H,
                                fill=bg_col, outline=border_col, width=2, tags=(tag,))
        # cost orb
        self.c.create_oval(x + 4, y + 4, x + 24, y + 24,
                           fill="#243245", outline="#7fb2ff", width=1, tags=(tag,))
        self.c.create_text(x + 14, y + 14, text=str(card["cost"]),
                           fill="#e6f0ff", font=("Segoe UI", 10, "bold"), tags=(tag,))
        # title
        self.c.create_text(x + CARD_W / 2, y + 14, text=card["name"],
                           fill="#e6f0ff", font=("Segoe UI", 9, "bold"), tags=(tag,))
        # type line
        type_col = "#ff9e9e" if card["type"] == "Attack" else "#9effce" if card["type"] == "Skill" else "#ffd68a"
        self.c.create_text(x + CARD_W / 2, y + 30, text=card["type"],
                           fill=type_col, font=("Segoe UI", 8), tags=(tag,))
        # text
        txt = self.wrap_text(card["text"], 22)
        self.c.create_text(x + 6, y + 44, anchor="nw", text=txt,
                           fill="#cfe0ff", font=("Segoe UI", 8), width=CARD_W - 12, tags=(tag,))

    def draw_relic_choice(self, x, y, relic, tag):
        self.c.create_rectangle(x, y, x + CARD_W, y + CARD_H,
                                fill="#2a1a10", outline="#ff9e44", width=2, tags=(tag,))
        self.c.create_text(x + CARD_W / 2, y + 14, text=relic["name"],
                           fill="#ff9e44", font=("Segoe UI", 10, "bold"), tags=(tag,))
        txt = self.wrap_text(relic["desc"], 22)
        self.c.create_text(x + 6, y + 34, anchor="nw", text=txt,
                           fill="#cfe0ff", font=("Segoe UI", 8), width=CARD_W - 12, tags=(tag,))

    def draw_potion_choice(self, x, y, potion, tag):
        self.c.create_rectangle(x, y, x + CARD_W, y + CARD_H,
                                fill="#1a1a2a", outline="#dda0ff", width=2, tags=(tag,))
        self.c.create_text(x + CARD_W / 2, y + 14, text=potion["name"],
                           fill="#dda0ff", font=("Segoe UI", 10, "bold"), tags=(tag,))
        txt = self.wrap_text(potion["desc"], 22)
        self.c.create_text(x + 6, y + 34, anchor="nw", text=txt,
                           fill="#cfe0ff", font=("Segoe UI", 8), width=CARD_W - 12, tags=(tag,))

    def draw_shop(self, cw, ch, margin):
        """Draw the shop interface on the canvas."""
        g = self.game

        # Title
        self.c.create_text(cw // 2, 50, text="SHOP",
                           fill="#ffd68a", font=("Segoe UI", 16, "bold"))
        self.c.create_text(cw // 2, 75, text=f"Available gold: {g.gold}",
                           fill="#ffd68a", font=("Segoe UI", 11))

        # Layout shop items in a grid
        item_w = CARD_W + 20
        item_h = CARD_H + 30
        cols = min(4, len(g.shop_items))
        rows = math.ceil(len(g.shop_items) / cols)

        total_grid_w = cols * (item_w + GAP) - GAP
        start_x = max(margin, (cw - total_grid_w) // 2)
        start_y = 110

        for idx, si in enumerate(g.shop_items):
            col = idx % cols
            row = idx // cols
            x = start_x + col * (item_w + GAP)
            y = start_y + row * (item_h + GAP)
            tag = f"shop_{idx}"

            if si["sold"]:
                # Sold overlay
                self.c.create_rectangle(x, y, x + item_w, y + item_h,
                                        fill="#1a1a1a", outline="#333", width=1, tags=(tag,))
                self.c.create_text(x + item_w / 2, y + item_h / 2,
                                   text="SOLD", fill="#555",
                                   font=("Segoe UI", 10, "bold"), tags=(tag,))
                continue

            item = si["item"]
            price = si["price"]
            affordable = g.gold >= price

            if si["type"] == "card":
                rarity = item.get("rarity", "common")
                border = RARITY_COLORS.get(rarity, "#4a5d7a") if affordable else "#333"
                bg = "#1b2533" if affordable else "#111"
                self.c.create_rectangle(x, y, x + item_w, y + item_h - 20,
                                        fill=bg, outline=border, width=2, tags=(tag,))
                self.c.create_text(x + item_w / 2, y + 12, text=item["name"],
                                   fill="#e6f0ff" if affordable else "#555",
                                   font=("Segoe UI", 9, "bold"), tags=(tag,))
                type_col = "#ff9e9e" if item["type"] == "Attack" else "#9effce" if item["type"] == "Skill" else "#ffd68a"
                self.c.create_text(x + item_w / 2, y + 26, text=f"{item['type']} (cost {item['cost']})",
                                   fill=type_col if affordable else "#444",
                                   font=("Segoe UI", 8), tags=(tag,))
                txt = self.wrap_text(item["text"], 24)
                self.c.create_text(x + 4, y + 38, anchor="nw", text=txt,
                                   fill="#cfe0ff" if affordable else "#444",
                                   font=("Segoe UI", 8), width=item_w - 8, tags=(tag,))

            elif si["type"] == "potion":
                border = "#dda0ff" if affordable else "#333"
                self.c.create_rectangle(x, y, x + item_w, y + item_h - 20,
                                        fill="#1a1a2a" if affordable else "#111",
                                        outline=border, width=2, tags=(tag,))
                self.c.create_text(x + item_w / 2, y + 14, text=item["name"],
                                   fill="#dda0ff" if affordable else "#555",
                                   font=("Segoe UI", 9, "bold"), tags=(tag,))
                self.c.create_text(x + 4, y + 34, anchor="nw",
                                   text=item["desc"],
                                   fill="#cfe0ff" if affordable else "#444",
                                   font=("Segoe UI", 8), width=item_w - 8, tags=(tag,))

            elif si["type"] == "relic":
                border = "#ff9e44" if affordable else "#333"
                self.c.create_rectangle(x, y, x + item_w, y + item_h - 20,
                                        fill="#2a1a10" if affordable else "#111",
                                        outline=border, width=2, tags=(tag,))
                self.c.create_text(x + item_w / 2, y + 14, text=item["name"],
                                   fill="#ff9e44" if affordable else "#555",
                                   font=("Segoe UI", 9, "bold"), tags=(tag,))
                self.c.create_text(x + 4, y + 34, anchor="nw",
                                   text=item["desc"],
                                   fill="#cfe0ff" if affordable else "#444",
                                   font=("Segoe UI", 8), width=item_w - 8, tags=(tag,))

            elif si["type"] == "remove":
                border = "#ff6b6b" if affordable else "#333"
                self.c.create_rectangle(x, y, x + item_w, y + item_h - 20,
                                        fill="#2a1010" if affordable else "#111",
                                        outline=border, width=2, tags=(tag,))
                self.c.create_text(x + item_w / 2, y + 20, text="Remove a card",
                                   fill="#ff6b6b" if affordable else "#555",
                                   font=("Segoe UI", 9, "bold"), tags=(tag,))
                self.c.create_text(x + item_w / 2, y + 40, text="Thin your deck!",
                                   fill="#cfe0ff" if affordable else "#444",
                                   font=("Segoe UI", 8), tags=(tag,))

            # Price tag
            price_col = "#ffd68a" if affordable else "#553a1a"
            self.c.create_text(x + item_w / 2, y + item_h - 10,
                               text=f"{price} gold", fill=price_col,
                               font=("Segoe UI", 9, "bold"), tags=(tag,))

    def draw_legacy_screen(self, cw, ch):
        """Draw the meta-progression upgrade screen."""
        self.c.create_rectangle(0, 0, cw, ch, fill="#0a0e14", outline="")

        m = self.meta
        self.c.create_text(cw // 2, 30, text="LEGACY — Permanent Upgrades",
                           fill="#ffaa8a", font=("Segoe UI", 16, "bold"))
        self.c.create_text(cw // 2, 55,
                           text=f"Points: {m.legacy_points}    |    Runs: {m.total_runs}    |    Best: floor {m.best_floor}    |    Kills: {m.total_kills}",
                           fill="#9cc1ff", font=("Segoe UI", 10))

        # Draw upgrades in a grid
        cols = 2
        item_w = 300
        item_h = 60
        gap = 12
        total_w = cols * item_w + (cols - 1) * gap
        start_x = (cw - total_w) // 2
        start_y = 90

        for i, u in enumerate(META_UPGRADES):
            col = i % cols
            row = i // cols
            x = start_x + col * (item_w + gap)
            y = start_y + row * (item_h + gap)
            tag = f"legacy_{i}"

            rank = m.rank(u["id"])
            maxed = rank >= u["max_rank"]
            cost = m.cost(u["id"]) if not maxed else 0
            can_buy = m.can_buy(u["id"])

            # Background
            if maxed:
                bg = "#1a2a1a"
                border = "#4adc8f"
            elif can_buy:
                bg = "#1a1a2a"
                border = "#8ab8ff"
            else:
                bg = "#111"
                border = "#333"

            self.c.create_rectangle(x, y, x + item_w, y + item_h,
                                    fill=bg, outline=border, width=2, tags=(tag,))

            # Name + rank
            rank_text = f" [{rank}/{u['max_rank']}]"
            if maxed:
                rank_text += " MAX"
            self.c.create_text(x + 8, y + 14, anchor="w",
                               text=u["name"] + rank_text,
                               fill="#e6f0ff" if not maxed else "#4adc8f",
                               font=("Segoe UI", 10, "bold"), tags=(tag,))

            # Description
            self.c.create_text(x + 8, y + 34, anchor="w",
                               text=u["desc"],
                               fill="#9cc1ff" if can_buy else "#555",
                               font=("Segoe UI", 9), tags=(tag,))

            # Cost
            if not maxed:
                cost_col = "#ffd68a" if can_buy else "#553a1a"
                self.c.create_text(x + item_w - 8, y + 14, anchor="e",
                                   text=f"{cost} pts",
                                   fill=cost_col, font=("Segoe UI", 9, "bold"), tags=(tag,))

        # Instructions
        bottom_y = start_y + (math.ceil(len(META_UPGRADES) / cols)) * (item_h + gap) + 20
        self.c.create_text(cw // 2, bottom_y,
                           text="Click to buy  —  L to close",
                           fill="#5a7a9a", font=("Segoe UI", 10))

    def wrap_text(self, s, n):
        words = s.split()
        out, cur = [], []
        for w in words:
            cur.append(w)
            if len(" ".join(cur)) > n:
                out.append(" ".join(cur))
                cur = []
        if cur:
            out.append(" ".join(cur))
        return "\n".join(out)

    # ----- Input -----
    def on_click(self, e):
        items = self.c.find_withtag("current")
        if not items:
            return
        tags = self.c.gettags(items[0])
        for t in tags:
            if t.startswith("hand_"):
                idx = int(t.split("_")[1])
                self.game.play_card(idx)
                return
            if t.startswith("reward_"):
                idx = int(t.split("_")[1])
                self.game.take_reward(idx)
                return
            if t.startswith("shop_"):
                idx = int(t.split("_")[1])
                self.game.buy_shop_item(idx)
                return
            if t.startswith("legacy_"):
                idx = int(t.split("_")[1])
                u = META_UPGRADES[idx]
                if self.meta.buy(u["id"]):
                    self.game.log = f"Upgrade: {u['name']} rank {self.meta.rank(u['id'])}!"
                self.redraw()
                return

    def end_turn(self):
        if self.game.in_reward:
            return
        self.game.end_player_turn()
        if self.game.player["hp"] > 0:
            self.redraw()


# ---------------------- Main ----------------------
if __name__ == "__main__":
    random.seed()
    root = tk.Tk()
    App(root)
    root.mainloop()
