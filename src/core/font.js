import { CONFIG } from "../config.js";

export async function waitForFont() {
  if (!document.fonts || !document.fonts.load) return;

  const sample = `${CONFIG.font.loadSamplePx}px "${CONFIG.font.family}"`;

  try {
    await Promise.race([
      (async () => {
        await document.fonts.load(sample);
        await document.fonts.ready;
      })(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("font-timeout")), CONFIG.font.timeoutMs)),
    ]);
  } catch {
    // ignore: on ne bloque pas l'app si la font met trop longtemps
  }
}

