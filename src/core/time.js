export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const clamp01 = (v) => Math.max(0, Math.min(1, v));

