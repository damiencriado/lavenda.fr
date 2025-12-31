import { CONFIG } from "../config.js";
import { rng } from "./rng.js";

export function textIndices(text) {
  const t = String(text).toUpperCase();
  const idx = [];
  for (let i = 0; i < t.length; i += 1) {
    if (t[i] !== " ") idx.push(i);
  }
  return { t, idx };
}

export function isCorrectAtIndex(targetText, i, shownChar) {
  const t = String(targetText).toUpperCase();
  const expected = i < t.length ? t[i] : " ";
  const shown = String(shownChar || " ").toUpperCase();
  if (expected === " ") return true;
  return shown === expected;
}

export function charClassFor(expectedText, i, shownChar) {
  if (!expectedText) return "";
  return isCorrectAtIndex(expectedText, i, shownChar) ? "char--lit" : "char--dim";
}

export const randomChar = () => CONFIG.scrambleChars[Math.floor(rng() * CONFIG.scrambleChars.length)];

export function randomCharExcept(expectedChar) {
  const expected = String(expectedChar || "").toUpperCase();
  if (!expected || expected === " ") return randomChar();

  for (let k = 0; k < 20; k += 1) {
    const c = randomChar();
    if (String(c).toUpperCase() !== expected) return c;
  }
  return randomChar();
}

export function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

