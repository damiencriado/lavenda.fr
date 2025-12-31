import { CONFIG } from "../config.js";
import { sleep } from "../core/time.js";
import { bumpSession } from "../core/runtime.js";
import { applyDotColor, syncDotForExpectedWord } from "../ui/dom.js";
import { cancelPulse, setPulseColor } from "../ui/dotPulse.js";
import { lockLettersRandom, unlockToScramble } from "../core/scramble.js";
import { finalProgram } from "./final.js";

export async function wordsProgram() {
  bumpSession();

  const sequence = CONFIG.items.filter((w) => w.toLowerCase() !== CONFIG.target.toLowerCase());
  sequence.push(CONFIG.target);

  applyDotColor("gray");

  for (const word of sequence) {
    const isTarget = word.toLowerCase() === CONFIG.target.toLowerCase();
    setPulseColor(isTarget ? "red" : "white");

    await lockLettersRandom(word, {
      durationMs: isTarget ? CONFIG.timing.settleEaseMs : CONFIG.timing.wordLockMs,
      frameMs: CONFIG.timing.scrambleFrameMs,
    });

    cancelPulse();

    if (isTarget) {
      // Words vient de verrouiller la target: on passe la main à Final
      bumpSession();
      await finalProgram({ alreadyLocked: true });
      return;
    }

    syncDotForExpectedWord(word, { matchedColor: "white" });

    await sleep(CONFIG.timing.holdWordMs);

    applyDotColor("gray");
    await unlockToScramble(word, {
      durationMs: Math.max(
        CONFIG.timing.betweenUnlockMinMs,
        Math.round(CONFIG.timing.wordLockMs * CONFIG.timing.betweenUnlockFactor)
      ),
      frameMs: CONFIG.timing.scrambleFrameMs,
    });
  }
}
