import { CONFIG } from "../config.js";

export const dot = document.getElementById("dot");
export const label = document.getElementById("label");

// largeur fixe pour éviter les shifts selon la longueur
export const maxLen = CONFIG.items.reduce((m, w) => Math.max(m, String(w).length), 0);
if (label) {
  label.style.display = "inline-block";
  label.style.width = `${maxLen}ch`;
  label.style.textAlign = "left";
}

export function setWord(text) {
  if (!label) return;
  label.textContent = text;
}

export function renderFixedCells(chars, getClassForIndex) {
  if (!label) return;
  const arr = Array.isArray(chars) ? chars : String(chars).split("");

  let html = "";
  for (let i = 0; i < maxLen; i += 1) {
    const ch = i < arr.length ? arr[i] : " ";
    const cls = typeof getClassForIndex === "function" ? getClassForIndex(i, ch) : "";

    const cellClasses = `char-cell ${cls}`;
    const cell = ch === " " ? "&nbsp;" : ch;
    html += `<span class=\"${cellClasses}\">${cell}</span>`;
  }
  label.innerHTML = html;
}

export function applyDotColor(color) {
  if (!dot) return;
  dot.classList.remove("dot--red", "dot--white", "dot--gray", "dot--orange");
  if (color === "red") dot.classList.add("dot--red");
  else if (color === "white") dot.classList.add("dot--white");
  else if (color === "orange") dot.classList.add("dot--orange");
  else dot.classList.add("dot--gray");
}

export function getDisplayedText() {
  if (!label) return "";

  const cells = label.querySelectorAll?.(".char-cell");
  if (cells && cells.length > 0) {
    let s = "";
    cells.forEach((el) => {
      const t = el.textContent || " ";
      s += t === "\u00A0" ? " " : t;
    });
    return s;
  }

  return label.textContent || "";
}

function isExactMatchPadded(displayed, target) {
  const d = String(displayed || "").toUpperCase();
  const t = String(target || "").toUpperCase();

  if (d.slice(0, t.length) !== t) return false;

  const rest = d.slice(t.length);
  return !/[\S]/.test(rest);
}

export function syncDotForExpectedWord(expectedWord, { matchedColor, unmatchedColor = "gray" } = {}) {
  const displayed = getDisplayedText();
  const ok = isExactMatchPadded(displayed, expectedWord);
  applyDotColor(ok ? matchedColor : unmatchedColor);
  return ok;
}

