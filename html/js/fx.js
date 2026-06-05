// ===================== FX (combat juice) =====================
// game.js pushes effect events during resolution via FX.emit(...).
// ui.js calls FX.flush(layer) after each redraw; we read the freshly-rendered
// sprite/bar positions and spawn transient, self-removing effect nodes.

const FX = {
  queue: [],

  emit(e) { this.queue.push(e); },
  clear() { this.queue.length = 0; },

  _reduced() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  },

  flush(layer) {
    const q = this.queue;
    this.queue = [];
    if (!layer) return;

    const enemyEl = document.getElementById("enemy-sprite");
    const playerEl = document.querySelector(".player-bar") || document.querySelector(".arena-player");
    const stage = document.getElementById("game-area");
    const reduced = this._reduced();
    let bigHit = false;

    for (const e of q) {
      const targetEl = e.target === "enemy" ? enemyEl : playerEl;
      const rect = targetEl ? targetEl.getBoundingClientRect() : null;

      switch (e.type) {
        case "damage":
          if (e.amount > 0) {
            this._number(layer, rect, "-" + e.amount, "fx-dmg");
            this._flash(targetEl, "fx-hit");
            if (e.amount >= 12) bigHit = true;
          } else {
            this._number(layer, rect, "Blocked", "fx-blocked");
          }
          break;
        case "block":
          if (e.amount > 0) this._number(layer, rect, "+" + e.amount, "fx-block");
          break;
        case "heal":
          if (e.amount > 0) this._number(layer, rect, "+" + e.amount, "fx-heal");
          break;
        case "status":
          this._number(layer, rect, e.text || "", "fx-status");
          break;
        case "death":
          if (enemyEl && !reduced) enemyEl.classList.add("fx-dissolve");
          break;
      }
    }

    if (bigHit && !reduced && stage) {
      stage.classList.remove("fx-shake");
      void stage.offsetWidth; // restart animation
      stage.classList.add("fx-shake");
      setTimeout(() => stage.classList.remove("fx-shake"), 420);
    }
  },

  _number(layer, rect, text, cls) {
    if (!rect || !text) return;
    const n = document.createElement("div");
    n.className = "fx-num " + cls;
    n.textContent = text;
    const jitter = Math.random() * 44 - 22;
    n.style.left = (rect.left + rect.width / 2 + jitter) + "px";
    n.style.top = (rect.top + rect.height * 0.25) + "px";
    layer.appendChild(n);
    n.addEventListener("animationend", () => n.remove());
    setTimeout(() => n.remove(), 1300);
  },

  _flash(elm, cls) {
    if (!elm) return;
    elm.classList.remove(cls);
    void elm.offsetWidth;
    elm.classList.add(cls);
    setTimeout(() => elm.classList.remove(cls), 320);
  },
};
