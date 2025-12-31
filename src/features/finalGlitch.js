import { CONFIG } from "../config.js";
import { pickRandom } from "../core/rng.js";
import { randomChar, randomCharExcept, textIndices, charClassFor } from "../core/text.js";
import { applyDotColor, renderFixedCells, syncDotForExpectedWord } from "../ui/dom.js";

let finalGlitchTimer = null;
let activeFinalGlitches = null; // Map(index -> { wrongUntil, reacquireUntil, wrongChar })
let finalGlitchTarget = null; // { t, idx }
let lastFinalGlitchScheduledAt = 0;

let finalRepaintRaf = null;

export function resetFinalGlitchState() {
  lastFinalGlitchScheduledAt = 0;
  activeFinalGlitches = null;
  finalGlitchTarget = null;
}

function renderFinalGlitchFrame() {
  if (!finalGlitchTarget || !activeFinalGlitches) return;

  const now = performance.now();
  const { t, idx } = finalGlitchTarget;

  for (const [i, info] of [...activeFinalGlitches.entries()]) {
    if (!info) {
      activeFinalGlitches.delete(i);
      continue;
    }
    if (now >= info.reacquireUntil) activeFinalGlitches.delete(i);
  }

  const out = t.split("");
  for (const i of idx) {
    const info = activeFinalGlitches.get(i);
    if (!info) {
      out[i] = t[i];
      continue;
    }

    if (now < info.wrongUntil) {
      out[i] = info.wrongChar;
      continue;
    }

    if (now < info.reacquireUntil) {
      out[i] = randomCharExcept(t[i]);
      continue;
    }

    out[i] = t[i];
  }

  renderFixedCells(out, (i, ch) => {
    if (i >= t.length) return "char--transparent";
    if (ch === " ") return "";
    return charClassFor(t, i, ch);
  });

  // LED dérivée de l'état réel du texte affiché
  syncDotForExpectedWord(CONFIG.target, { matchedColor: "red", unmatchedColor: "gray" });
}

function stopFinalRepaintLoop() {
  if (finalRepaintRaf) {
    cancelAnimationFrame(finalRepaintRaf);
    finalRepaintRaf = null;
  }
}

function startFinalRepaintLoop() {
  if (finalRepaintRaf) return;

  const tick = () => {
    finalRepaintRaf = null;

    if (!activeFinalGlitches) return;

    renderFinalGlitchFrame();

    if (activeFinalGlitches.size === 0) {
      scheduleNextFinalGlitch();
      return;
    }

    finalRepaintRaf = requestAnimationFrame(tick);
  };

  finalRepaintRaf = requestAnimationFrame(tick);
}

function scheduleNextFinalGlitch() {
  if (!CONFIG.finalGlitch?.enabled) return;
  if (!finalGlitchTarget || !activeFinalGlitches) return;

  const cfg = CONFIG.finalGlitch;
  const minDelay = Math.max(0, cfg.minOneGlitchEveryMs ?? 0);
  const windowMs = Math.max(minDelay, cfg.maxOneGlitchEveryMs ?? minDelay);

  const now = performance.now();
  const earliest = Math.max(
    now + minDelay,
    lastFinalGlitchScheduledAt > 0 ? lastFinalGlitchScheduledAt + windowMs : now + minDelay
  );

  const slack = Math.max(0, windowMs - minDelay);
  const jitter = slack > 0 ? Math.floor(Math.random() * slack) : 0; // non-seeded OK ici (timing)

  const fireAt = earliest + jitter;
  const delay = Math.max(0, fireAt - now);

  if (finalGlitchTimer) clearTimeout(finalGlitchTimer);
  finalGlitchTimer = setTimeout(() => {
    finalGlitchTimer = null;

    if (!finalGlitchTarget || !activeFinalGlitches) return;

    if (activeFinalGlitches.size > 0) {
      scheduleNextFinalGlitch();
      return;
    }

    lastFinalGlitchScheduledAt = performance.now();

    const { idx, t } = finalGlitchTarget;
    const candidates = idx.filter((i) => !activeFinalGlitches.has(i));
    if (candidates.length === 0) {
      scheduleNextFinalGlitch();
      return;
    }

    const maxN = Math.max(1, Math.min(cfg.maxConcurrent ?? 1, candidates.length));
    const howMany = 1 + Math.floor(Math.random() * maxN);

    const now2 = performance.now();
    const wrongMs = Math.max(80, cfg.glitchMs ?? 400);
    const reacquireMs = Math.max(120, cfg.reacquireMs ?? 280);

    const pool = [...candidates];

    for (let k = 0; k < howMany; k += 1) {
      if (pool.length === 0) break;

      const chosen = pickRandom(pool);
      if (chosen === undefined) break;

      const pos = pool.indexOf(chosen);
      if (pos >= 0) pool.splice(pos, 1);

      let wrong = randomChar();
      const correct = t[chosen];
      let guard = 0;
      while (wrong === correct && guard < 10) {
        wrong = randomChar();
        guard += 1;
      }

      activeFinalGlitches.set(chosen, {
        wrongUntil: now2 + wrongMs,
        reacquireUntil: now2 + wrongMs + reacquireMs,
        wrongChar: wrong,
      });
    }

    renderFinalGlitchFrame();

    const repaint = () => {
      if (!activeFinalGlitches) return;

      renderFinalGlitchFrame();

      if (activeFinalGlitches.size === 0) {
        scheduleNextFinalGlitch();
        return;
      }
      requestAnimationFrame(repaint);
    };

    requestAnimationFrame(repaint);
  }, delay);
}

export function startFinalGlitchMode(targetWord) {
  if (!CONFIG.finalGlitch?.enabled) return;

  const { t, idx } = textIndices(targetWord);
  finalGlitchTarget = { t, idx };
  activeFinalGlitches = new Map();

  renderFinalGlitchFrame();
  scheduleNextFinalGlitch();
}

export function stopFinalGlitchMode() {
  if (finalGlitchTimer) {
    clearTimeout(finalGlitchTimer);
    finalGlitchTimer = null;
  }
  stopFinalRepaintLoop();
  activeFinalGlitches = null;
  finalGlitchTarget = null;
}

export function triggerFinalGlitchNow() {
  if (!CONFIG.finalGlitch?.enabled) return false;
  if (!finalGlitchTarget || !activeFinalGlitches) return false;

  const cfg = CONFIG.finalGlitch;
  const { idx, t } = finalGlitchTarget;

  const notGlitched = idx.filter((i) => !activeFinalGlitches.has(i));
  const chosen = pickRandom(notGlitched.length > 0 ? notGlitched : idx);
  if (chosen === undefined) return false;

  const now = performance.now();
  const wrongMs = Math.max(80, cfg.glitchMs ?? 400);
  const reacquireMs = Math.max(120, cfg.reacquireMs ?? 280);

  activeFinalGlitches.set(chosen, {
    wrongUntil: now + wrongMs,
    reacquireUntil: now + wrongMs + reacquireMs,
    wrongChar: randomCharExcept(t[chosen]),
  });

  lastFinalGlitchScheduledAt = now;

  renderFinalGlitchFrame();
  startFinalRepaintLoop();
  return true;
}

export function setDotGrayNow() {
  applyDotColor("gray");
}
