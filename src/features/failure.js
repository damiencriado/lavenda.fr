import { CONFIG } from "../config.js";
import { sleep } from "../core/time.js";
import { bumpSession } from "../core/runtime.js";
import { applyDotColor, renderFixedCells } from "../ui/dom.js";
import { unlockToScramble } from "../core/scramble.js";

let clickGlitchTimes = [];
let isFailureRunning = false;

export function isFailureActive() {
  return isFailureRunning;
}

export function resetFailureWindow() {
  clickGlitchTimes = [];
}

export function registerClickGlitchAndCheckFailure(now = performance.now()) {
  clickGlitchTimes.push(now);
  const cutoff = now - CONFIG.failure.windowMs;
  clickGlitchTimes = clickGlitchTimes.filter((t) => t >= cutoff);
  return clickGlitchTimes.length > CONFIG.failure.maxClicks;
}

export async function runFailureSequence({ stopFinal, restartFinalFromScratch }) {
  if (isFailureRunning) return;
  isFailureRunning = true;

  bumpSession();

  // stoppe toutes les boucles/timers qui peuvent réécrire le label pendant FAILURE
  stopFinal?.();

  const toggles = CONFIG.failure.blinkCount * 2;
  const failureWord = "ERREUR";

  let on = false;
  for (let step = 0; step < toggles; step += 1) {
    on = !on;

    renderFixedCells(failureWord.split(""), (i, ch) => (ch === " " ? "" : on ? "char--lit" : "char--dim"));
    applyDotColor(on ? "orange" : "gray");

    await sleep(CONFIG.failure.blinkMs);
  }

  // Après le dernier blink: maintenir FAILURE 1s (dot orange allumé)
  renderFixedCells(failureWord.split(""), (i, ch) => (ch === " " ? "" : "char--lit"));
  applyDotColor("orange");
  await sleep(CONFIG.failure.holdAfterMs);

  // Disparition progressive (comme les autres mots)
  applyDotColor("gray");
  const unlockMs = Math.max(0, CONFIG.failure.unlockOutMs ?? 0);
  if (unlockMs > 0) {
    await unlockToScramble(failureWord, {
      durationMs: unlockMs,
      frameMs: CONFIG.timing.scrambleFrameMs,
    });
  }

  applyDotColor("gray");

  resetFailureWindow();
  isFailureRunning = false;

  await restartFinalFromScratch?.();
}
