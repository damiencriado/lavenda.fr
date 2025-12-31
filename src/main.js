import { waitForFont } from "./core/font.js";
import { cancelPulse } from "./ui/dotPulse.js";
import { startGlowFlicker, stopGlowFlicker } from "./ui/glowFlicker.js";
import { bootProgram } from "./programs/boot.js";
import { stopFinalGlitchMode } from "./features/finalGlitch.js";

(async function main() {
  startGlowFlicker();

  await waitForFont();
  document.body.classList.remove("is-preparing");

  await bootProgram();
})().finally(() => {
  cancelPulse();
  document.body.classList.remove("booting");
});

window.addEventListener("beforeunload", () => {
  cancelPulse();
  stopGlowFlicker();
  stopFinalGlitchMode();
});
