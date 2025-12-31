import { rng } from "../core/rng.js";

let glowFlickerTimer = null;

export function startGlowFlicker() {
  if (glowFlickerTimer) return;

  glowFlickerTimer = setInterval(() => {
    const jitter = 0.85 + rng() * 0.35; // [0.85..1.20]
    document.documentElement.style.setProperty("--glow-jitter", jitter.toFixed(3));
  }, 70);
}

export function stopGlowFlicker() {
  if (glowFlickerTimer) {
    clearInterval(glowFlickerTimer);
    glowFlickerTimer = null;
  }
  document.documentElement.style.setProperty("--glow-jitter", "1");
}
