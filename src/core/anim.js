import { clamp01 } from "./time.js";

export function animateTimed(durationMs, frameMs, onFrame) {
  const duration = Math.max(0, durationMs);
  const endAt = performance.now() + duration;

  return new Promise((resolve) => {
    let lastFrameAt = 0;
    const tick = (ts) => {
      if (ts - lastFrameAt < frameMs) {
        requestAnimationFrame(tick);
        return;
      }
      lastFrameAt = ts;

      const now = performance.now();
      const progress = duration <= 0 ? 1 : clamp01(1 - (endAt - now) / duration);
      onFrame(progress);

      if (progress >= 1) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

