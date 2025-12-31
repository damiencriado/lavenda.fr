// Configuration centrale

export const CONFIG = {
  items: ["Laurent", "Lavande", "Lavenda", "Avenir", "Damien"],
  target: "Lavenda",

  timing: {
    wordLockMs: 1000,
    settleEaseMs: 4000,
    holdWordMs: 400,
    scrambleFrameMs: 28,
    betweenUnlockFactor: 0.35,
    betweenUnlockMinMs: 300,
  },

  boot: {
    blinkCount: 3,
    blinkTotalMs: 3000,
    onColor: "white",
    offColor: "gray",
  },

  dot: {
    finalBlinkMs: 1500,
  },

  scrambleChars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",

  font: {
    family: "Screener W01SC Bold",
    loadSamplePx: 16,
    timeoutMs: 2500,
  },

  finalGlitch: {
    enabled: true,
    maxOneGlitchEveryMs: 5000,
    minOneGlitchEveryMs: 2000,
    glitchMs: 520,
    reacquireMs: 380,
    maxConcurrent: 2,
  },

  failure: {
    maxClicks: 3,
    windowMs: 1000,

    blinkCount: 3,
    blinkMs: 200,

    holdAfterMs: 1000,
    unlockOutMs: 650,
  },
};

