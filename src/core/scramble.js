import { CONFIG } from "../config.js";
import { animateTimed } from "./anim.js";
import { getSession } from "./runtime.js";
import { charClassFor, randomCharExcept, shuffleInPlace, textIndices } from "./text.js";
import { maxLen, renderFixedCells, setWord } from "../ui/dom.js";
import { pulseDot, setPulseColor } from "../ui/dotPulse.js";

async function scrambleStep(text, { mode, durationMs, frameMs, onLockDelta, onDone }) {
  // snapshot session pour éviter qu'une ancienne anim écrive après un changement de programme
  const sid = getSession();

  const { t, idx } = textIndices(text);
  const len = t.length;
  const order = shuffleInPlace([...idx]);

  const steps = order.length;
  const active = new Set();
  let lastActiveCount = 0;

  await animateTimed(durationMs, frameMs, (progress) => {
    if (sid !== getSession()) return; // annulé

    const shouldBeActive = Math.floor(progress * steps);
    for (let k = lastActiveCount; k < shouldBeActive; k += 1) {
      const i = order[k];
      if (i !== undefined) active.add(i);
    }

    if (mode === "lock" && typeof onLockDelta === "function") {
      const activeCount = active.size;
      if (activeCount > lastActiveCount) {
        onLockDelta(activeCount - lastActiveCount);
      }
    }

    lastActiveCount = shouldBeActive;

    const out = [];
    for (let i = 0; i < len; i += 1) {
      const c = t[i];
      if (c === " ") {
        out.push(" ");
        continue;
      }
      if (mode === "lock") out.push(active.has(i) ? c : randomCharExcept(c));
      else out.push(active.has(i) ? randomCharExcept(c) : c);
    }

    renderFixedCells(out, (i, ch) => {
      if (i >= len) return "char--transparent";
      if (ch === " ") return "";
      return charClassFor(t, i, ch);
    });
  });

  if (sid !== getSession()) return; // annulé

  if (mode === "lock") {
    renderFixedCells(t.split(""), (i, ch) => {
      if (i >= len) return "char--transparent";
      if (ch === " ") return "";
      return "char--lit";
    });
  }

  onDone?.({ t });
}

export function lockLettersRandom(text, opts = {}) {
  const isTarget = String(text).toLowerCase() === String(CONFIG.target).toLowerCase();

  return scrambleStep(text, {
    mode: "lock",
    durationMs: opts.durationMs,
    frameMs: opts.frameMs,
    onLockDelta: (delta) => {
      if (delta > 0) {
        setPulseColor(isTarget ? "red" : "white");
        pulseDot();
      }
    },
  });
}

export function unlockToScramble(text, opts = {}) {
  return scrambleStep(text, {
    mode: "unlock",
    durationMs: opts.durationMs,
    frameMs: opts.frameMs,
  });
}

export function renderFullWidthScrambleLikeTarget(target) {
  // Affiche un scramble plein largeur (maxLen) pour éviter tout pop
  const t = String(target).toUpperCase();
  const out = [];
  for (let i = 0; i < maxLen; i += 1) {
    const expected = i < t.length ? t[i] : " ";
    out.push(expected === " " ? " " : randomCharExcept(expected));
  }
  renderFixedCells(out, (i, ch) => (ch === " " ? "" : "char--dim"));
}
