import { applyDotColor } from "./dom.js";

let pulseTimer = null;
let currentPulseColor = "white";

export function setPulseColor(color) {
  currentPulseColor = color;
}

export function pulseDot() {
  if (pulseTimer) {
    clearTimeout(pulseTimer);
    pulseTimer = null;
  }

  applyDotColor(currentPulseColor);
  pulseTimer = setTimeout(() => {
    pulseTimer = null;
    applyDotColor("gray");
  }, 80);
}

export function cancelPulse() {
  if (pulseTimer) {
    clearTimeout(pulseTimer);
    pulseTimer = null;
  }
}
