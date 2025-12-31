import { CONFIG } from "../config.js";
import { sleep } from "../core/time.js";
import { bumpSession } from "../core/runtime.js";
import { applyDotColor, setWord } from "../ui/dom.js";
import { wordsProgram } from "./words.js";

async function bootDotBlink() {
  const { blinkCount, blinkTotalMs, onColor, offColor } = CONFIG.boot;

  const half = Math.round(blinkTotalMs / (blinkCount * 2));
  for (let i = 0; i < blinkCount; i += 1) {
    applyDotColor(onColor);
    await sleep(half);
    applyDotColor(offColor);
    await sleep(half);
  }
}

export async function bootProgram() {
  bumpSession();

  document.body.classList.add("booting");

  applyDotColor("gray");
  setWord("");

  await bootDotBlink();

  setWord(
    CONFIG.items.find((w) => w.toLowerCase() !== CONFIG.target.toLowerCase()) || CONFIG.items[0] || CONFIG.target
  );
  applyDotColor("gray");

  document.body.classList.remove("booting");

  bumpSession();
  await wordsProgram();
}
