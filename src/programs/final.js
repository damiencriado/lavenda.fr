import { CONFIG } from "../config.js";
import { bumpSession } from "../core/runtime.js";
import { applyDotColor, syncDotForExpectedWord } from "../ui/dom.js";
import { cancelPulse } from "../ui/dotPulse.js";
import { lockLettersRandom, renderFullWidthScrambleLikeTarget } from "../core/scramble.js";
import {
  resetFinalGlitchState,
  startFinalGlitchMode,
  stopFinalGlitchMode,
  triggerFinalGlitchNow,
} from "../features/finalGlitch.js";
import { isFailureActive, registerClickGlitchAndCheckFailure, runFailureSequence } from "../features/failure.js";

let finalInteractionsWired = false;
let finalGlitchActive = false;

function wireFinalInteractions() {
  window.addEventListener(
    "pointerdown",
    async () => {
      if (!finalGlitchActive) return;
      if (isFailureActive()) return;

      const now = performance.now();
      if (registerClickGlitchAndCheckFailure(now)) {
        await runFailureSequence({
          stopFinal: stopFinalGlitchMode,
          restartFinalFromScratch: startFinalPhaseFromScratch,
        });
        return;
      }

      triggerFinalGlitchNow();
    },
    { passive: true }
  );
}

function initFinalProgram() {
  if (finalInteractionsWired) return;
  finalInteractionsWired = true;
  wireFinalInteractions();
}

function startFinalWhenAlreadyLocked() {
  initFinalProgram();

  bumpSession();

  stopFinalGlitchMode();
  resetFinalGlitchState();

  finalGlitchActive = true;
  syncDotForExpectedWord(CONFIG.target, { matchedColor: "red" });
  startFinalGlitchMode(CONFIG.target);
}

async function startFinalPhaseFromScratch() {
  initFinalProgram();

  bumpSession();

  finalGlitchActive = false;
  stopFinalGlitchMode();
  resetFinalGlitchState();
  cancelPulse();

  renderFullWidthScrambleLikeTarget(CONFIG.target);
  applyDotColor("gray");
  await new Promise((r) => requestAnimationFrame(() => r()));

  await lockLettersRandom(CONFIG.target, {
    durationMs: CONFIG.timing.settleEaseMs,
    frameMs: CONFIG.timing.scrambleFrameMs,
  });

  cancelPulse();

  finalGlitchActive = true;

  syncDotForExpectedWord(CONFIG.target, { matchedColor: "red" });
  startFinalGlitchMode(CONFIG.target);
}

export async function finalProgram({ alreadyLocked } = {}) {
  if (alreadyLocked) {
    startFinalWhenAlreadyLocked();
    return;
  }

  await startFinalPhaseFromScratch();
}
